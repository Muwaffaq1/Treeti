// Web Push with Web Crypto only, so it runs unchanged on Cloudflare Workers and Node.
// Message encryption follows RFC 8291 (aes128gcm); sender identification follows RFC 8292 (VAPID).
export type PushTarget={endpoint:string;p256dh:string;auth:string};
export type VapidKeys={publicKey:string;privateKey:string;subject:string};

const encoder=new TextEncoder();
export const fromBase64Url=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
export const toBase64Url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const concat=(...parts:Uint8Array[])=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const part of parts){out.set(part,at);at+=part.length;}return out;};
const buffer=(bytes:Uint8Array)=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
// An uncompressed P-256 public point is 0x04 || x || y; a private key is the 32-byte scalar d.
const jwk=(publicKey:Uint8Array,privateKey?:Uint8Array):JsonWebKey=>({kty:'EC',crv:'P-256',x:toBase64Url(publicKey.slice(1,33)),y:toBase64Url(publicKey.slice(33,65)),...(privateKey?{d:toBase64Url(privateKey)}:{}),ext:true});
async function hkdf(salt:Uint8Array,ikm:Uint8Array,info:Uint8Array,length:number){
  const key=await crypto.subtle.importKey('raw',buffer(ikm),'HKDF',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:buffer(salt),info:buffer(info)},key,length*8));
}

/** Encrypts one message for one device. `fixed` exists only so the RFC 8291 example can be reproduced in tests. */
export async function encryptPush(target:PushTarget,payload:Uint8Array,fixed?:{salt:Uint8Array;publicKey:Uint8Array;privateKey:Uint8Array}){
  const receiver=fromBase64Url(target.p256dh),authSecret=fromBase64Url(target.auth);
  if(receiver.length!==65||receiver[0]!==4||authSecret.length!==16)throw new Error('PUSH_SUBSCRIPTION_INVALID');
  let senderPublic:Uint8Array,senderPrivate:CryptoKey;
  if(fixed){senderPublic=fixed.publicKey;senderPrivate=await crypto.subtle.importKey('jwk',jwk(fixed.publicKey,fixed.privateKey),{name:'ECDH',namedCurve:'P-256'},false,['deriveBits']);}
  else{const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);senderPublic=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));senderPrivate=pair.privateKey;}
  const receiverKey=await crypto.subtle.importKey('jwk',jwk(receiver),{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:receiverKey},senderPrivate,256));
  const ikm=await hkdf(authSecret,shared,concat(encoder.encode('WebPush: info\0'),receiver,senderPublic),32);
  const salt=fixed?.salt??crypto.getRandomValues(new Uint8Array(16));
  const contentKey=await hkdf(salt,ikm,encoder.encode('Content-Encoding: aes128gcm\0'),16),nonce=await hkdf(salt,ikm,encoder.encode('Content-Encoding: nonce\0'),12);
  const key=await crypto.subtle.importKey('raw',buffer(contentKey),'AES-GCM',false,['encrypt']);
  // 0x02 marks the final (only) record.
  const sealed=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:buffer(nonce)},key,buffer(concat(payload,new Uint8Array([2])))));
  return concat(salt,new Uint8Array([0,0,16,0]),new Uint8Array([senderPublic.length]),senderPublic,sealed);
}

/** The Authorization header value proving these notifications come from this application. */
export async function vapidAuthorization(endpoint:string,keys:VapidKeys,now=Date.now()){
  const publicKey=fromBase64Url(keys.publicKey),signer=await crypto.subtle.importKey('jwk',jwk(publicKey,fromBase64Url(keys.privateKey)),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const part=(value:object)=>toBase64Url(encoder.encode(JSON.stringify(value)));
  const unsigned=`${part({typ:'JWT',alg:'ES256'})}.${part({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+12*3600,sub:keys.subject})}`;
  const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},signer,buffer(encoder.encode(unsigned))));
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${keys.publicKey}`;
}

/** Sends one notification. `gone` means the device has unsubscribed and its record should be removed. */
export async function sendPush(target:PushTarget,message:object,keys:VapidKeys,send:typeof fetch=fetch):Promise<'sent'|'gone'|'failed'>{
  try{
    const body=await encryptPush(target,encoder.encode(JSON.stringify(message)));
    const response=await send(target.endpoint,{method:'POST',headers:{Authorization:await vapidAuthorization(target.endpoint,keys),'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'86400',Urgency:'normal'},body:buffer(body),signal:AbortSignal.timeout(8000)});
    return response.status===404||response.status===410?'gone':response.ok?'sent':'failed';
  }catch{return 'failed';}
}

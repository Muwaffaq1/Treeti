import {describe,it,expect} from 'vitest';
import {encryptPush,fromBase64Url,sendPush,toBase64Url,vapidAuthorization} from '@/lib/web-push';

// RFC 8291, Appendix A.
const example={
  plaintext:'When I grow up, I want to be a watermelon',
  senderPrivate:'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',senderPublic:'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  receiverPublic:'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',auth:'BTBZMqHH6r4Tts7J_aSIgg',salt:'DGv6ra1nlYgDCS1FRnbzlw',
  body:'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const target={endpoint:'https://fcm.googleapis.com/fcm/send/example',p256dh:example.receiverPublic,auth:example.auth};
async function vapidKeys(){
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']),jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
  return {keys:{publicKey:toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),privateKey:jwk.d!,subject:'https://usetreeti.xyz'},verifier:pair.publicKey};
}

describe('web push',()=>{
 it('reproduces the RFC 8291 encryption example byte for byte',async()=>{
  const body=await encryptPush(target,new TextEncoder().encode(example.plaintext),{salt:fromBase64Url(example.salt),publicKey:fromBase64Url(example.senderPublic),privateKey:fromBase64Url(example.senderPrivate)});
  expect(toBase64Url(body)).toBe(example.body);
 });
 it('uses a fresh salt and sender key for every message',async()=>{
  const payload=new TextEncoder().encode('hello'),one=await encryptPush(target,payload),two=await encryptPush(target,payload);
  expect(toBase64Url(one)).not.toBe(toBase64Url(two));expect(one.length).toBe(two.length);
 });
 it('rejects a malformed subscription instead of sending something a device cannot read',async()=>{
  await expect(encryptPush({...target,auth:'c2hvcnQ'},new Uint8Array([1]))).rejects.toThrow('PUSH_SUBSCRIPTION_INVALID');
 });
 it('signs a short-lived VAPID token for the push service origin only',async()=>{
  const {keys,verifier}=await vapidKeys(),now=Date.UTC(2026,9,13),header=await vapidAuthorization(target.endpoint,keys,now);
  const [,token,key]=header.match(/^vapid t=([^,]+), k=(.+)$/)!,[head,claims,signature]=token.split('.');
  expect(key).toBe(keys.publicKey);expect(JSON.parse(new TextDecoder().decode(fromBase64Url(head)))).toEqual({typ:'JWT',alg:'ES256'});
  expect(JSON.parse(new TextDecoder().decode(fromBase64Url(claims)))).toEqual({aud:'https://fcm.googleapis.com',exp:now/1000+12*3600,sub:'https://usetreeti.xyz'});
  expect(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},verifier,fromBase64Url(signature),new TextEncoder().encode(`${head}.${claims}`))).toBe(true);
 });
 it('reports delivery, a retired device and failures without throwing',async()=>{
  const {keys}=await vapidKeys(),seen:{url:string;headers:Record<string,string>}[]=[];
  const respond=(status:number)=>(async(url:string|URL|Request,init?:RequestInit)=>{seen.push({url:String(url),headers:init!.headers as Record<string,string>});return new Response(null,{status});}) as typeof fetch;
  expect(await sendPush(target,{title:'treeti'},keys,respond(201))).toBe('sent');
  expect(seen[0].url).toBe(target.endpoint);expect(seen[0].headers['Content-Encoding']).toBe('aes128gcm');expect(seen[0].headers.Authorization).toMatch(/^vapid t=/);
  expect(await sendPush(target,{title:'treeti'},keys,respond(410))).toBe('gone');expect(await sendPush(target,{title:'treeti'},keys,respond(404))).toBe('gone');
  expect(await sendPush(target,{title:'treeti'},keys,respond(500))).toBe('failed');
  expect(await sendPush(target,{title:'treeti'},keys,(async()=>{throw new Error('offline');}) as typeof fetch)).toBe('failed');
 });
});

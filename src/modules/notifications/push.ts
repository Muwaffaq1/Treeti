import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Database} from '@/lib/database';
import {sendPush,type VapidKeys} from '@/lib/web-push';
import {DomainError} from '@/modules/agreements/domain';

// Only the browser vendors' push services are accepted, so a subscription cannot point the server at an arbitrary address.
const services=[/^fcm\.googleapis\.com$/,/^updates\.push\.services\.mozilla\.com$/,/\.push\.apple\.com$/,/\.notify\.windows\.com$/];
const key=z.string().regex(/^[A-Za-z0-9_-]+$/);
export const subscriptionSchema=z.object({endpoint:z.string().url().max(1000),keys:z.object({p256dh:key.min(80).max(100),auth:key.min(16).max(30)})});
const maxDevices=8;

export function pushKeys():VapidKeys|null{
  const publicKey=process.env.VAPID_PUBLIC_KEY,privateKey=process.env.VAPID_PRIVATE_KEY;
  return publicKey&&privateKey?{publicKey,privateKey,subject:process.env.AHD_APP_URL?new URL(process.env.AHD_APP_URL).origin:'https://usetreeti.xyz'}:null;
}
export function allowedEndpoint(endpoint:string){try{const url=new URL(endpoint);return url.protocol==='https:'&&!url.username&&!url.password&&services.some(s=>s.test(url.hostname));}catch{return false;}}

export async function saveSubscription(db:Database,userId:string,input:unknown){
  const {endpoint,keys}=subscriptionSchema.parse(input);
  if(!allowedEndpoint(endpoint))throw new DomainError('PUSH_SERVICE_UNSUPPORTED','This browser’s notification service is not supported yet.',422);
  await db.transaction(async tx=>{
    // A device belongs to whoever signed in on it last.
    await tx.query('insert into push_subscriptions (id,user_id,endpoint,p256dh,auth) values ($1,$2,$3,$4,$5) on conflict (endpoint) do update set user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth',[randomUUID(),userId,endpoint,keys.p256dh,keys.auth]);
    await tx.query('delete from push_subscriptions where user_id=$1 and id not in (select id from push_subscriptions where user_id=$1 order by created_at desc, id limit $2)',[userId,maxDevices]);
  });
}
export async function removeSubscription(db:Database,userId:string,input:unknown){
  const {endpoint}=z.object({endpoint:z.string().url().max(1000)}).parse(input);
  await db.query('delete from push_subscriptions where user_id=$1 and endpoint=$2',[userId,endpoint]);
}
export type PushMessage={title:string;body:string;url:string;tag:string};
/** Notifies every device a person enabled. Never throws: a notification must not undo the work that caused it. */
export async function pushToUser(db:Database,userId:string,message:PushMessage,send:typeof fetch=fetch){
  const keys=pushKeys();if(!keys)return {sent:0,removed:0};
  let sent=0,removed=0;
  try{
    const devices=await db.query<{id:string;endpoint:string;p256dh:string;auth:string}>('select id,endpoint,p256dh,auth from push_subscriptions where user_id=$1 order by created_at desc limit $2',[userId,maxDevices]);
    for(const device of devices){
      const result=await sendPush(device,message,keys,send);
      if(result==='sent'){sent++;await db.query('update push_subscriptions set last_sent_at=now() where id=$1',[device.id]);}
      else if(result==='gone'){removed++;await db.query('delete from push_subscriptions where id=$1',[device.id]);}
    }
  }catch{}
  return {sent,removed};
}

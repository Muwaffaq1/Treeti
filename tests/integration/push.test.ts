import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,afterEach,describe,it,expect,vi} from 'vitest';
import type {Database} from '@/lib/database';
import {allowedEndpoint,pushToUser,removeSubscription,saveSubscription} from '@/modules/notifications/push';
import {toBase64Url} from '@/lib/web-push';

const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
let pg:PGlite,db:Database,device=0;
async function subscription(host='fcm.googleapis.com'){
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  return {endpoint:`https://${host}/send/${++device}`,keys:{p256dh:toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))),auth:toBase64Url(crypto.getRandomValues(new Uint8Array(16)))}};
}
const rows=()=>db.query<{user_id:string;endpoint:string;last_sent_at:string|null}>('select user_id,endpoint,last_sent_at from push_subscriptions order by created_at,endpoint');
beforeAll(async()=>{
 pg=new PGlite();await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 await pg.exec(await readFile('supabase/migrations/202610130008_push_subscriptions.sql','utf8'));
 const wrap=(connection:{query:PGlite['query']}):Database=>({async query<T>(sql:string,params:unknown[]=[]){return (await connection.query<T>(sql,params)).rows;},async transaction<T>(work:(tx:Database)=>Promise<T>){return pg.transaction(tx=>work(wrap(tx)));}});
 db=wrap(pg);
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign']);
 vi.stubEnv('VAPID_PUBLIC_KEY',toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey))));vi.stubEnv('VAPID_PRIVATE_KEY',(await crypto.subtle.exportKey('jwk',pair.privateKey)).d!);
},30000);
afterEach(async()=>{await pg.exec('delete from push_subscriptions');});
afterAll(async()=>{vi.unstubAllEnvs();await pg?.close();});

describe('device notifications',()=>{
 it('only accepts the browser vendors’ push services over https',async()=>{
  for(const ok of ['https://fcm.googleapis.com/fcm/send/a','https://updates.push.services.mozilla.com/wpush/v2/a','https://web.push.apple.com/a','https://wns2-par02p.notify.windows.com/w/?token=a'])expect(allowedEndpoint(ok)).toBe(true);
  for(const bad of ['http://fcm.googleapis.com/a','https://example.com/a','https://fcm.googleapis.com.evil.test/a','https://user:pw@fcm.googleapis.com/a','https://127.0.0.1/a','not a url'])expect(allowedEndpoint(bad)).toBe(false);
  await expect(saveSubscription(db,alice,await subscription('example.com'))).rejects.toMatchObject({code:'PUSH_SERVICE_UNSUPPORTED'});
  await expect(saveSubscription(db,alice,{endpoint:'https://fcm.googleapis.com/a',keys:{p256dh:'short',auth:'short'}})).rejects.toThrow();
  expect(await rows()).toHaveLength(0);
 });
 it('stores one row per device, hands a shared device to whoever signed in last, and keeps the newest eight',async()=>{
  const phone=await subscription();
  await saveSubscription(db,alice,phone);await saveSubscription(db,alice,phone);expect(await rows()).toHaveLength(1);
  await saveSubscription(db,bob,phone);expect((await rows()).map(r=>r.user_id)).toEqual([bob]);
  for(let i=0;i<10;i++)await saveSubscription(db,alice,await subscription());
  expect((await rows()).filter(r=>r.user_id===alice)).toHaveLength(8);
  await removeSubscription(db,alice,{endpoint:phone.endpoint});expect((await rows()).some(r=>r.endpoint===phone.endpoint)).toBe(true);
  await removeSubscription(db,bob,{endpoint:phone.endpoint});expect((await rows()).some(r=>r.endpoint===phone.endpoint)).toBe(false);
 });
 it('notifies only that person’s devices, forgets retired ones and never throws',async()=>{
  const live=await subscription(),retired=await subscription(),other=await subscription();
  await saveSubscription(db,alice,live);await saveSubscription(db,alice,retired);await saveSubscription(db,bob,other);
  const called:string[]=[],send=(async(url:string|URL|Request)=>{called.push(String(url));return new Response(null,{status:String(url)===retired.endpoint?410:201});}) as typeof fetch;
  expect(await pushToUser(db,alice,{title:'treeti',body:'A repayment has been confirmed by both parties.',url:'/agreements/x',tag:'event-1'},send)).toEqual({sent:1,removed:1});
  expect(called.sort()).toEqual([live.endpoint,retired.endpoint].sort());
  const left=await rows();expect(left.map(r=>r.endpoint).sort()).toEqual([live.endpoint,other.endpoint].sort());expect(left.find(r=>r.endpoint===live.endpoint)!.last_sent_at).not.toBeNull();
  expect(await pushToUser(db,alice,{title:'treeti',body:'x',url:'/app',tag:'t'},(async()=>{throw new Error('offline');}) as typeof fetch)).toEqual({sent:0,removed:0});
  vi.stubEnv('VAPID_PRIVATE_KEY','');expect(await pushToUser(db,alice,{title:'treeti',body:'x',url:'/app',tag:'t'},send)).toEqual({sent:0,removed:0});
 });
 it('cannot be read or written from a browser connection',async()=>{
  await saveSubscription(db,alice,await subscription());
  await pg.exec('set role authenticated');
  await expect(pg.query('select * from push_subscriptions')).rejects.toThrow(/permission denied/);
  await expect(pg.exec("insert into push_subscriptions (id,user_id,endpoint,p256dh,auth) values (gen_random_uuid(),gen_random_uuid(),'https://x','a','b')")).rejects.toThrow(/permission denied/);
  await pg.exec('reset role');
 });
});

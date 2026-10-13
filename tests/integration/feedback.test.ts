import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,afterEach,describe,it,expect,vi} from 'vitest';
import type {Database} from '@/lib/database';
import {listFeedback,ownerUserIds,saveFeedback} from '@/modules/feedback/feedback';

const owner='11111111-1111-4111-8111-111111111111',maryam='33333333-3333-4333-8333-333333333333',unverified='55555555-5555-4555-8555-555555555555',gone='99999999-9999-4999-8999-999999999999';
let pg:PGlite,db:Database;
beforeAll(async()=>{
 pg=new PGlite();await pg.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users (id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);');
 await pg.exec(await readFile('supabase/migrations/202610130009_feedback.sql','utf8'));
 await pg.query('insert into auth.users values ($1,$2,now(),$3),($4,$5,now(),$6),($7,$8,null,$9)',[owner,'Owner@Example.test',{full_name:'Owner Person'},maryam,'maryam@example.test',{full_name:'Maryam Bello'},unverified,'second@example.test',{}]);
 const wrap=(connection:{query:PGlite['query']}):Database=>({async query<T>(sql:string,params:unknown[]=[]){return (await connection.query<T>(sql,params)).rows;},async transaction<T>(work:(tx:Database)=>Promise<T>){return pg.transaction(tx=>work(wrap(tx)));}});
 db=wrap(pg);
},30000);
afterEach(async()=>{vi.unstubAllEnvs();await pg.exec('delete from feedback');});
afterAll(async()=>{await pg?.close();});

describe('feedback records',()=>{
 it('stores what was sent and lists it newest first with who sent it',async()=>{
  await saveFeedback(db,maryam,{rating:4,message:'  I could not find custom installments.  ',page:'/agreements/new'});
  await pg.exec("update feedback set created_at=now()-interval '1 hour'");
  await saveFeedback(db,gone,{rating:5});
  const list=await listFeedback(db);
  expect(list.map(f=>[f.rating,f.message,f.page,f.from,f.contact])).toEqual([[5,'',null,'',''],[4,'I could not find custom installments.','/agreements/new','Maryam Bello','maryam@example.test']]);
  expect(list.every(f=>!Number.isNaN(Date.parse(f.createdAt)))).toBe(true);expect(await listFeedback(db,1)).toHaveLength(1);
 });
 it('refuses empty or oversized feedback, in code and in the table',async()=>{
  await expect(saveFeedback(db,maryam,{})).rejects.toThrow();await expect(saveFeedback(db,maryam,{rating:9})).rejects.toThrow();
  await expect(pg.query("insert into feedback (id,user_id,message) values (gen_random_uuid(),$1,'')",[maryam])).rejects.toThrow(/check/);
  await expect(pg.query('insert into feedback (id,user_id,rating) values (gen_random_uuid(),$1,6)',[maryam])).rejects.toThrow(/check/);
  expect(await listFeedback(db)).toEqual([]);
 });
 it('alerts only verified operator accounts',async()=>{
  expect(await ownerUserIds(db)).toEqual([]);
  vi.stubEnv('AHD_OWNER_EMAILS','owner@example.test, second@example.test, nobody@example.test');
  expect(await ownerUserIds(db)).toEqual([owner]);
 });
 it('cannot be read or written from a browser connection',async()=>{
  await saveFeedback(db,maryam,{message:'Private.'});
  await pg.exec('set role authenticated');
  await expect(pg.query('select * from feedback')).rejects.toThrow(/permission denied/);
  await expect(pg.exec("insert into feedback (id,user_id,message) values (gen_random_uuid(),gen_random_uuid(),'x')")).rejects.toThrow(/permission denied/);
  await pg.exec('reset role');
 });
});

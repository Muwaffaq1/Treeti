import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import type {Database} from '@/lib/database';
import {operatorNumbers,statusLabel} from '@/modules/feedback/numbers';

let pg:PGlite,db:Database;
const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
beforeAll(async()=>{
 pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;create table auth.users (id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb,created_at timestamptz not null default now());`);
 await pg.exec(await readFile('supabase/migrations/202610080001_core.sql','utf8'));
 // Two people joined before launch and one on launch day (Lagos time), plus one today.
 await pg.query(`insert into auth.users (id,created_at) values ($1,'2026-10-10T10:00:00Z'),($2,'2026-10-12T10:00:00Z'),($3,'2026-10-14T09:00:00Z'),(gen_random_uuid(),'2026-10-15T20:00:00Z')`,users);
 const add=(n:number,by:string,status:string,minor:number,at:string)=>pg.query(`insert into agreements (id,public_id,created_by,status,original_principal_minor,remaining_balance_minor,created_at,settled_at) values (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7)`,[`TREETI-2026-${String(n).padStart(5,'0')}`,by,status,minor,status==='SETTLED'?0:minor,at,status==='SETTLED'?at:null]);
 await add(1,users[0],'SETTLED',30000000,'2026-10-11T10:00:00Z');
 await add(2,users[0],'ACTIVE',5000000,'2026-10-14T08:00:00Z');
 await add(3,users[1],'AWAITING_BORROWER',2000000,'2026-10-14T23:30:00Z');   // 15 Oct in Lagos
 await add(4,users[2],'DECLINED',1000000,'2026-10-15T12:00:00Z');
 const wrap=(c:{query:PGlite['query']}):Database=>({async query<T>(sql:string,params:unknown[]=[]){return (await c.query<T>(sql,params)).rows;},async transaction<T>(work:(tx:Database)=>Promise<T>){return pg.transaction(tx=>work(wrap(tx)));}});
 db=wrap(pg);
},30000);
afterAll(async()=>{await pg?.close();});

describe('operator numbers',()=>{
 it('count agreements, people and the recorded amount, with launch and today in Lagos time',async()=>{
  const n=await operatorNumbers(db,new Date('2026-10-15T21:00:00Z'));
  expect(n.agreements).toEqual({total:4,sinceLaunch:3,today:2,byStatus:{SETTLED:1,ACTIVE:1,AWAITING_BORROWER:1,DECLINED:1}});
  expect(n.people).toEqual({total:4,sinceLaunch:2,creators:3,repeatCreators:1});
  expect(n.recordedMinor).toBe('35000000');
  expect(n.days).toHaveLength(7);
  expect(n.days[0]).toEqual({day:'2026-10-15',signups:1,agreements:2});
  expect(n.days[1]).toEqual({day:'2026-10-14',signups:1,agreements:1});
  expect(n.days.at(-1)!.day).toBe('2026-10-09');
 });
 it('work on an empty service and name every status plainly',async()=>{
  const empty=new PGlite();await empty.exec(`create schema auth;create table auth.users (id uuid primary key,created_at timestamptz not null default now());create table agreements (status text,created_by uuid,original_principal_minor bigint,created_at timestamptz);`);
  const n=await operatorNumbers({async query<T>(sql:string,p:unknown[]=[]){return (await empty.query<T>(sql,p)).rows;},async transaction(){throw new Error('unused');}},new Date('2026-10-15T12:00:00Z'));
  expect(n.agreements).toEqual({total:0,sinceLaunch:0,today:0,byStatus:{}});expect(n.recordedMinor).toBe('0');expect(n.days.every(d=>d.signups===0&&d.agreements===0)).toBe(true);
  await empty.close();
  for(const s of ['AWAITING_BORROWER','CHANGES_REQUESTED','AWAITING_APPROVAL','AWAITING_WITNESSES','ACTIVE','SETTLEMENT_PENDING','SETTLED','DECLINED','CANCELLED','DRAFT'])expect(statusLabel(s)).not.toBe(s);
 });
});

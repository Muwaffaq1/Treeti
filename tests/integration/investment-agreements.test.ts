import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import type {Database} from '@/lib/database';
import type {Actor} from '@/modules/agreements/types';
import {PostgresInvestmentAgreementRepository} from '@/modules/investment-agreements/repository';
import {signAgreement} from '@/modules/investment-agreements/model';

const abdullah:Actor={userId:'11111111-1111-4111-8111-111111111111',name:'Abdullah Musa',contacts:['abdullah@example.test'],demo:false};
const aisha:Actor={userId:'55555555-5555-4555-8555-555555555555',name:'Aisha Suleiman',contacts:['aisha@example.test'],demo:false};
let pg:PGlite,db:Database,repo:PostgresInvestmentAgreementRepository;
beforeAll(async()=>{
 pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;create function auth.uid() returns uuid language sql as 'select null::uuid';
  create function public.prevent_evidence_change() returns trigger language plpgsql as $$ begin raise exception 'Evidence is append-only'; end $$;`);
 await pg.exec(await readFile('supabase/migrations/202610110007_private_investments.sql','utf8'));
 await pg.exec(await readFile('supabase/migrations/202611150011_investment_agreements.sql','utf8'));
 const wrap=(connection:{query:PGlite['query']}):Database=>({async query<T>(sql:string,params:unknown[]=[]){return (await connection.query<T>(sql,params)).rows;},async transaction<T>(work:(tx:Database)=>Promise<T>){return pg.transaction(tx=>work(wrap(tx)));}});
 db=wrap(pg);repo=new PostgresInvestmentAgreementRepository(db);
},30000);
afterAll(async()=>{await pg?.close();});

describe('investment agreements in PostgreSQL',()=>{
 it('stores, joins, signs, finalizes once and gives each partner a linked investment',async()=>{
  const input={terms:{venture:'Sister’s shop in Kano',currency:'NGN',startDate:'2026-11-01'},me:{capitalMinor:'20000000',profitShare:60},partners:[{name:'Aisha Suleiman',contact:'aisha@example.test',capitalMinor:'10000000',profitShare:40}],signature:'Abdullah Musa',affirmed:true};
  const created=await repo.create(input,abdullah,'key-1');
  expect((await repo.create(input,abdullah,'key-1')).agreement.id).toBe(created.agreement.id);
  const token=created.links![0].token;
  const [row]=await db.query<{data:string}>('select data::text from investment_agreements');expect(row.data).not.toContain(token);
  expect((await repo.byToken(token))?.id).toBe(created.agreement.id);
  await expect(repo.join(token,{...aisha,contacts:['other@example.test']})).rejects.toMatchObject({code:'WRONG_ACCOUNT'});
  await repo.join(token,aisha);
  expect((await repo.list(aisha)).map(a=>a.id)).toEqual([created.agreement.id]);
  await expect(repo.change(created.agreement.id,{...aisha,userId:'99999999-9999-4999-8999-999999999999'},{},signAgreement)).rejects.toMatchObject({code:'NOT_FOUND'});
  const done=await repo.change(created.agreement.id,aisha,{expectedVersionId:created.agreement.currentVersionId,signature:'Aisha Suleiman',affirmed:true},signAgreement);
  expect(done.agreement.status).toBe('ACTIVE');
  const records=await db.query<{owner_id:string;data:{myShare:number;agreementId:string;contributions:{amountMinor:string}[]}}>('select owner_id,data from personal_investments order by owner_id');
  expect(records.map(r=>[r.owner_id,r.data.myShare,r.data.contributions[0].amountMinor])).toEqual([[abdullah.userId,60,'20000000'],[aisha.userId,40,'10000000']]);
  expect(records.every(r=>r.data.agreementId===created.agreement.id)).toBe(true);
  const events=await db.query<{type:string}>('select type from investment_agreement_events order by sequence');
  expect(events.map(e=>e.type)).toEqual(['CREATED','SIGNED','JOINED','SIGNED','FINALIZED']);
  await expect(db.query("update investment_agreements set status='CANCELLED',revision=revision+1,data=jsonb_set(jsonb_set(data,'{status}','\"CANCELLED\"'),'{revision}',to_jsonb(revision+1)) where id=$1",[created.agreement.id])).rejects.toThrow(/closed investment agreement/);
 });
});

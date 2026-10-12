import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import type {Database} from '@/lib/database';
import {PostgresRepository} from '@/modules/agreements/repository';
import {PostgresDebtRepository} from '@/modules/debts/repository';
import {PostgresInvestmentRepository} from '@/modules/investments/repository';
import {deliverDebtReminders} from '@/modules/debts/reminder-worker';
import {claimBatch} from '@/modules/notifications/worker';
import {recurringPlan} from '@/modules/agreements/repayment-plan';
import {people,input,terms} from '../helpers';
let pg:PGlite,db:Database,repo:PostgresRepository;
beforeAll(async()=>{
 pg=new PGlite();await pg.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 await pg.exec(await readFile('supabase/migrations/202610080001_core.sql','utf8'));
 await pg.exec(await readFile('supabase/migrations/202610080003_private_debts.sql','utf8'));
 await pg.exec(await readFile('supabase/migrations/202610080004_debt_reminders.sql','utf8'));
 await pg.exec(await readFile('supabase/migrations/202610080005_digital_witnesses.sql','utf8'));
 await pg.exec(await readFile('supabase/migrations/202610110006_currencies_and_debt_edits.sql','utf8'));
 await pg.exec(await readFile('supabase/migrations/202610110007_private_investments.sql','utf8'));
 const wrap=(connection:{query:PGlite['query']}):Database=>({async query<T>(sql:string,params:unknown[]=[]){return (await connection.query<T>(sql,params)).rows;},async transaction<T>(work:(tx:Database)=>Promise<T>){return pg.transaction(tx=>work(wrap(tx)));}});
 db=wrap(pg);repo=new PostgresRepository(db);
},30000);
afterAll(async()=>{await pg?.close();});
describe('PostgreSQL repository and database protections',()=>{
 it('persists a draft atomically and replays the same request without duplicates',async()=>{const one=await repo.create(input,people[0],'create_atomic_0001'),two=await repo.create(input,people[0],'create_atomic_0001');expect(two).toEqual(one);expect((await db.query('select id from agreements'))).toHaveLength(1);expect((await repo.get(one.agreement.id))?.versions).toEqual(one.agreement.versions);await expect(repo.create({...input,terms:{...terms,principalMinor:'1'}},people[0],'create_atomic_0001')).rejects.toThrow('different action');});
 it('rejects mutation and deletion of evidence even by the service connection',async()=>{await expect(pg.exec("update agreement_versions set principal_minor=1")).rejects.toThrow('append-only');await expect(pg.exec('delete from agreement_events')).rejects.toThrow('append-only');await expect(pg.exec('update agreement_versions set interest_minor=5')).rejects.toThrow();});
 it('rolls back failed transitions without events or used verification',async()=>{const a=(await repo.list(people[0]))[0],events=a.events.length;await expect(repo.command(a.id,{action:'finalize',expectedVersionId:a.currentVersionId},people[0],'bad_finalize_0001')).rejects.toThrow();expect((await repo.get(a.id))?.events).toHaveLength(events);expect(await db.query('select id from consumed_verifications')).toHaveLength(0);});
 it('limits raw reads to parties and prohibits direct browser mutation',async()=>{const a=(await repo.list(people[0]))[0];
   await pg.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${people[4].userId}',false)`);expect((await pg.query('select * from agreements')).rows).toHaveLength(0);await expect(pg.exec('insert into agreement_events (id) values (gen_random_uuid())')).rejects.toThrow('permission');
   await pg.exec(`select set_config('request.jwt.claim.sub','${people[0].userId}',false)`);expect((await pg.query('select * from agreements')).rows).toHaveLength(1);await pg.exec('reset role');
   // A witness sees terms through the sanitized server projection, never raw JSON contacts.
   await db.query('insert into agreement_participants(id,agreement_id,user_id,role,version_ids,data) values (gen_random_uuid(),$1,$2,$3,$4,$5)',[a.id,people[2].userId,'WITNESS',[a.currentVersionId],'{}']);
   await pg.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${people[2].userId}',false)`);for(const table of ['agreements','agreement_versions','repayments','evidence_manifests'])expect((await pg.query(`select * from ${table}`)).rows).toHaveLength(0);expect((await pg.query('select * from agreement_participants')).rows).toHaveLength(1);await pg.exec('reset role');
 });
});
it('claims a delivery wakeup only for its agreement and respects the processing lease',async()=>{
 const first=(await repo.create(input,people[0],'wake_first_agreement_unique')).agreement,second=(await repo.create(input,people[0],'wake_second_agreement_unique')).agreement;
 const batch=await claimBatch(db,first.id);
 expect(batch.length).toBeGreaterThan(0);expect(batch.every(row=>row.agreement_id===first.id)).toBe(true);
 expect(await claimBatch(db,first.id)).toHaveLength(0);
 expect((await db.query<{status:string}>('select status from outbox_events where agreement_id=$1',[second.id])).every(row=>row.status==='PENDING')).toBe(true);
 await db.query("update outbox_events set lease_until=now()-interval '1 minute' where agreement_id=$1",[first.id]);
 expect((await claimBatch(db,first.id)).length).toBe(batch.length);
});
it('commits approvals, finalization, external repayment, and mutual settlement without repeated action codes',async()=>{
 let a=(await repo.create({...input,terms:{...terms,requiredWitnesses:0}},people[0],'lifecycle_create_0001')).agreement;
 let counter=0;
 const command=async(actor:typeof people[number],action:string,extra:Record<string,unknown>={})=>{
  const stepUp={id:crypto.randomUUID(),contact:actor.contacts[0],level:'EMAIL_OTP',agreementId:a.id,versionId:a.currentVersionId,action,expiresAt:new Date(Date.now()+300000).toISOString()};
  const result=await repo.command(a.id,{action,expectedVersionId:a.currentVersionId,...extra},actor,`lifecycle_${++counter}_unique_key`,['approve','confirm-repayment','settle'].includes(action)?stepUp:undefined);a=result.agreement;return {result,stepUp};
 };
 const sent=await command(people[0],'send');a=await repo.claim(sent.result.invitation!.token,people[1]);
 const tokenData=JSON.stringify(await db.query('select data,response from outbox_events cross join idempotency_keys'));
 expect(tokenData).not.toContain(sent.result.invitation!.token);
 const approved=await command(people[1],'approve',{affirmed:true,signature:'Borrower'});
 // Session approvals never consume a fresh verification grant.
 expect(await db.query('select id from consumed_verifications where id=$1',[approved.stepUp.id])).toHaveLength(0);
 await command(people[0],'approve',{affirmed:true,signature:'Lender'});await command(people[0],'finalize');expect(a.manifest).not.toBeNull();
 await command(people[1],'repayment',{amountMinor:'30000000',date:new Date().toISOString().slice(0,10),method:'Bank transfer',reference:'LIFECYCLE-FULL'});
 const payment=a.repayments[0];const confirmed=await command(people[0],'confirm-repayment',{targetId:payment.id});expect(a.status).toBe('SETTLEMENT_PENDING');
 // Old client grants are ignored for routine actions; the verified session and current state govern them.
 expect(await db.query('select id from consumed_verifications where id=$1',[confirmed.stepUp.id])).toHaveLength(0);
 await command(people[0],'settle',{affirmed:true});await command(people[1],'settle',{affirmed:true});expect(a.status).toBe('SETTLED');expect(a.balanceMinor).toBe('0');
 const persisted=await repo.get(a.id);expect(persisted?.settlements).toHaveLength(2);expect(persisted?.manifest?.version.terms.principalMinor).toBe('30000000');
});

describe('owner-only private debts',()=>{
 it('persists payments exactly once and rejects excess and non-owner writes',async()=>{
  const debts=new PostgresDebtRepository(db),input={person:'Maryam Bello',currency:'USD',amountMinor:'100000',date:'2026-09-01',note:'Personal record'};
  const first=await debts.createDebt(input,people[0],'private_create_unique01');expect(await debts.createDebt(input,people[0],'private_create_unique01')).toEqual(first);
  expect(await debts.listDebts(people[4])).toEqual([]);
  await expect(debts.payDebt(first.id,{amountMinor:'1',date:'2026-10-01'},people[4],'private_foreign_payment')).rejects.toThrow('unavailable');
  const payment={amountMinor:'75000',date:'2026-10-01',note:'Transfer'};
  await debts.payDebt(first.id,payment,people[0],'private_payment_unique01');await debts.payDebt(first.id,payment,people[0],'private_payment_unique01');
  expect((await debts.listDebts(people[0]))[0].payments).toHaveLength(1);
  await expect(debts.payDebt(first.id,{...payment,amountMinor:'25001'},people[0],'private_excess_payment')).rejects.toThrow('more than');
  await expect(db.query('insert into personal_debt_payments(id,debt_id,owner_id,amount_minor,payment_date,data) values(gen_random_uuid(),$1,$2,25001,$3,$4)',[first.id,people[0].userId,'2026-10-01','{}'])).rejects.toThrow('exceeds');
 });
 it('enforces owner-only raw reads and prohibits browser writes with RLS',async()=>{
  await pg.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${people[4].userId}',false)`);
  expect((await pg.query('select * from personal_debts')).rows).toHaveLength(0);expect((await pg.query('select * from personal_debt_payments')).rows).toHaveLength(0);
  await expect(pg.exec('insert into personal_debts(id) values(gen_random_uuid())')).rejects.toThrow('permission');
  await pg.exec(`select set_config('request.jwt.claim.sub','${people[0].userId}',false)`);expect((await pg.query('select * from personal_debts')).rows).toHaveLength(1);expect((await pg.query('select * from personal_debt_payments')).rows).toHaveLength(1);await pg.exec('reset role');
 });
 it('stores reminder changes idempotently, enforces ownership and suppresses paid reminders',async()=>{
  const debts=new PostgresDebtRepository(db),debt=(await debts.listDebts(people[0]))[0],when=new Date(Date.now()+86400000).toISOString();
  const input={remindAt:when,timeZone:'Africa/Lagos',email:false};
  const saved=await debts.setDebtReminder(debt.id,input,people[0],'reminder_first_unique01');expect((await debts.setDebtReminder(debt.id,input,people[0],'reminder_first_unique01')).reminder?.id).toBe(saved.reminder?.id);
  expect((await debts.listDebts(people[0]))[0].reminder?.timeZone).toBe('Africa/Lagos');
  await expect(debts.setDebtReminder(debt.id,input,people[4],'reminder_foreign_unique')).rejects.toThrow('unavailable');
  await pg.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${people[4].userId}',false)`);expect((await pg.query('select * from personal_debt_reminders')).rows).toHaveLength(0);await expect(pg.exec("update personal_debt_reminders set status='CANCELLED'")).rejects.toThrow('permission');await pg.exec('reset role');
  await debts.payDebt(debt.id,{amountMinor:'25000',date:'2026-10-01'},people[0],'private_pay_last_unique');expect((await debts.listDebts(people[0]))[0].reminder).toBeNull();expect((await db.query<{status:string}>('select status from personal_debt_reminders where debt_id=$1',[debt.id]))[0].status).toBe('CANCELLED');
 });
 it('delivers due email reminders once, retries failures and never emails paid debts',async()=>{
  const debts=new PostgresDebtRepository(db),debt=await debts.createDebt({person:'Private person',currency:'NGN',amountMinor:'10000',date:'2026-10-01'},people[0],'reminder_email_debt_unique');
  await db.query("insert into personal_debt_reminders(debt_id,owner_id,id,remind_at,time_zone,email_contact) values($1,$2,gen_random_uuid(),now()-interval '1 minute','Africa/Lagos','owner@example.test')",[debt.id,people[0].userId]);
  const sent:string[]=[];
  expect((await deliverDebtReminders(db,async()=>{throw new Error('transport');})).sent).toBe(0);
  expect((await deliverDebtReminders(db,async(to,key)=>{sent.push(to+key);})).sent).toBe(1);expect(sent[0]).toContain('owner@example.test');expect((await deliverDebtReminders(db,async()=>{throw new Error('duplicate');})).considered).toBe(0);
  await debts.payDebt(debt.id,{amountMinor:'10000',date:'2026-10-08'},people[0],'reminder_email_pay_unique');expect((await deliverDebtReminders(db,async()=>{throw new Error('paid');})).considered).toBe(0);
 });
 it('scopes scheduled wakeups to the saved reminder and ignores early, rescheduled and cancelled events',async()=>{
  const debts=new PostgresDebtRepository(db),first=await debts.createDebt({person:'First sample',currency:'NGN',amountMinor:'10000',date:'2026-10-01'},people[0],'scoped_first_debt_unique'),second=await debts.createDebt({person:'Second sample',currency:'NGN',amountMinor:'10000',date:'2026-10-01'},people[0],'scoped_second_debt_unique');
  const old=crypto.randomUUID(),next=crypto.randomUUID(),other=crypto.randomUUID();
  await db.query("insert into personal_debt_reminders(debt_id,owner_id,id,remind_at,time_zone,email_contact) values($1,$2,$3,now()+interval '1 hour','Africa/Lagos','owner@example.test'),($4,$2,$5,now()-interval '1 minute','Africa/Lagos','owner@example.test')",[first.id,people[0].userId,old,second.id,other]);
  const send=async()=>{};
  expect((await deliverDebtReminders(db,send,old)).considered).toBe(0);
  await db.query("update personal_debt_reminders set id=$1,remind_at=now()-interval '1 minute' where debt_id=$2",[next,first.id]);
  expect((await deliverDebtReminders(db,send,old)).considered).toBe(0);
  expect(await deliverDebtReminders(db,async()=>{throw new Error('transport');},next)).toMatchObject({considered:1,sent:0,retryable:1});
  expect((await deliverDebtReminders(db,send,next)).sent).toBe(1);
  expect((await deliverDebtReminders(db,send,next)).considered).toBe(0);
  expect((await db.query<{status:string}>('select status from personal_debt_reminders where id=$1',[other]))[0].status).toBe('SCHEDULED');
  await db.query("update personal_debt_reminders set status='CANCELLED' where id=$1",[other]);
  expect((await deliverDebtReminders(db,send,other)).considered).toBe(0);
 });
});

it('persists two independent digital witness acknowledgments and finalizes their exact version',async()=>{
 let a=(await repo.create({...input,terms:{...terms,requiredWitnesses:2}},people[0],'digital_witness_create_unique')).agreement,counter=0;
 const command=async(actor:typeof people[number],action:string,extra:Record<string,unknown>={})=>{
  const stepUp={id:crypto.randomUUID(),contact:actor.contacts[0],level:'EMAIL_OTP',agreementId:a.id,versionId:a.currentVersionId,action,expiresAt:new Date(Date.now()+300000).toISOString()};
  const result=await repo.command(a.id,{action,expectedVersionId:a.currentVersionId,...extra},actor,`digital_witness_${++counter}_unique`,['approve','attest'].includes(action)?stepUp:undefined);a=result.agreement;return result;
 };
 const sent=await command(people[0],'send');a=await repo.claim(sent.invitation!.token,people[1]);
 for(const actor of [people[0],people[1]])await command(actor,'approve',{affirmed:true,signature:actor.name});
 const invited=await command(people[0],'invite-witnesses',{witnesses:people.slice(2,4).map(actor=>({name:actor.name,contact:actor.contacts[0]}))});
 for(let index=0;index<2;index++){
  const actor=people[index+2];a=await repo.claim(invited.invitations![index].token,actor);await command(actor,'attest',{educated:true,affirmed:true,signature:actor.name});
  if(index===0)await expect(command(people[0],'finalize')).rejects.toThrow('not complete');
 }
 await command(people[0],'finalize');
 const stored=await repo.get(a.id);expect(stored?.manifest?.attestations).toHaveLength(2);expect(stored?.attestations.every(w=>w.type==='DIGITAL_ACKNOWLEDGEMENT'&&w.presence==='DOCUMENT_REVIEW')).toBe(true);
 expect((await db.query<{attestation_type:string}>('select attestation_type from witness_attestations where agreement_id=$1',[a.id])).map(row=>row.attestation_type)).toEqual(['DIGITAL_ACKNOWLEDGEMENT','DIGITAL_ACKNOWLEDGEMENT']);
});

it('round-trips installment evidence and appends plan revisions without rewriting earlier JSON',async()=>{
 const installments=recurringPlan('100001','2027-01-31',3,'MONTHLY');
 const scheduleTerms={...terms,principalMinor:'100001',dueDate:'2027-03-31',repaymentType:'INSTALLMENTS' as const,installments};
 const a=(await repo.create({...input,terms:scheduleTerms},people[0],'installment_persistence_01')).agreement;
 expect((await repo.get(a.id))?.versions[0]).toEqual(a.versions[0]);
 const updated=await repo.command(a.id,{action:'version',expectedVersionId:a.currentVersionId,reason:'Change first due date',terms:{...scheduleTerms,installments:recurringPlan('100001','2027-02-28',3,'MONTHLY'),dueDate:'2027-04-28'}},people[0],'installment_revision_01');
 const loaded=await repo.get(a.id);expect(loaded?.versions).toEqual(updated.agreement.versions);expect(loaded?.versions[0]).toEqual(a.versions[0]);
 const rows=await db.query<{data:{terms:{installments:unknown}}}>('select data from agreement_versions where agreement_id=$1 order by version_number',[a.id]);expect(rows[0].data.terms.installments).toEqual(installments);
 await expect(db.query("update agreement_versions set data='{}' where agreement_id=$1",[a.id])).rejects.toThrow('append-only');
});

it('shows an existing borrower a private pending inbox without claiming or approving; review links the account',async()=>{
  let a=(await repo.create(input,people[0],'pending_inbox_create_unique')).agreement;
  const sent=await repo.command(a.id,{action:'send',expectedVersionId:a.currentVersionId},people[0],'pending_inbox_send_unique');a=sent.agreement;
  const id=sent.invitation!.invitationId;
  const pending=(await repo.pendingInvitations({...people[1],contacts:[' PERSON1@EXAMPLE.TEST ']})).find(i=>i.id===id);
  expect(pending).toEqual({id,publicId:a.publicId,lenderName:people[0].name,createdAt:a.invitations[0].createdAt});
  expect((await repo.list(people[1])).some(row=>row.id===a.id)).toBe(false);
  expect((await repo.get(a.id))?.participants.find(p=>p.role==='BORROWER')?.userId).toBeNull();
  expect((await repo.pendingInvitations(people[4])).some(i=>i.id===id)).toBe(false);
  await expect(repo.claimPending(id,people[4])).rejects.toThrow('Verify the email');
  const opened=await repo.claimPending(id,people[1]);expect(opened.approvals).toHaveLength(0);expect(opened.status).toBe('AWAITING_BORROWER');
  expect(opened.participants.find(p=>p.role==='BORROWER')?.userId).toBe(people[1].userId);
  expect((await repo.pendingInvitations(people[1])).some(i=>i.id===id)).toBe(false);
  expect((await repo.list(people[1])).some(row=>row.id===a.id)).toBe(true);
  expect((await repo.claimPending(id,people[1])).events).toEqual(opened.events);
});
it('hides expired, revoked and stale inbox invitations and rejects opening them',async()=>{
  for(const kind of ['expired','revoked','stale'] as const){
    let a=(await repo.create(input,people[0],`pending_${kind}_create_unique`)).agreement;
    const sent=await repo.command(a.id,{action:'send',expectedVersionId:a.currentVersionId},people[0],`pending_${kind}_send_unique`);a=sent.agreement;
    const before=structuredClone(a),invitation=a.invitations[0];
    if(kind==='expired')invitation.expiresAt='2000-01-01T00:00:00.000Z';
    if(kind==='revoked')invitation.status='REVOKED';
    if(kind==='stale')invitation.versionId=crypto.randomUUID();
    await repo.persist(db,a,before);
    expect((await repo.pendingInvitations(people[1])).some(i=>i.id===invitation.id)).toBe(false);
    await expect(repo.claimPending(invitation.id,people[1])).rejects.toThrow('no longer active');
  }
});


it('atomically agrees and sends, auto-finalizes, and preserves explicit final-payment consent exactly once',async()=>{
 let a=(await repo.create({...input,terms:{...terms,requiredWitnesses:0}},people[0],'simple_create_unique')).agreement;
 const sentInput={action:'agree-and-send',expectedVersionId:a.currentVersionId,affirmed:true,signature:people[0].name};
 await expect(repo.command(a.id,{...sentInput,affirmed:false},people[0],'simple_invalid_send')).rejects.toThrow('confirm');expect((await repo.get(a.id))?.approvals).toHaveLength(0);
 const sent=await repo.command(a.id,sentInput,people[0],'simple_send_unique');await repo.command(a.id,sentInput,people[0],'simple_send_unique');a=await repo.claim(sent.invitation!.token,people[1]);
 expect(a.approvals).toHaveLength(1);expect(a.invitations).toHaveLength(1);
 a=(await repo.command(a.id,{action:'approve',expectedVersionId:a.currentVersionId,affirmed:true,signature:people[1].name},people[1],'simple_approve_unique')).agreement;
 expect(a.status).toBe('ACTIVE');expect(a.events.filter(e=>e.type==='AGREEMENT_FINALIZED')).toHaveLength(1);const manifest=structuredClone(a.manifest);
 const recorded={action:'repayment',expectedVersionId:a.currentVersionId,amountMinor:a.balanceMinor,date:new Date().toISOString().slice(0,10),method:'Cash',closeAgreement:true};
 a=(await repo.command(a.id,recorded,people[1],'simple_payment_unique')).agreement;await repo.command(a.id,recorded,people[1],'simple_payment_unique');expect(a.settlements).toHaveLength(0);
 const confirmed={action:'confirm-repayment',expectedVersionId:a.currentVersionId,targetId:a.repayments[0].id,closeAgreement:true};
 a=(await repo.command(a.id,confirmed,people[0],'simple_confirm_unique')).agreement;await repo.command(a.id,confirmed,people[0],'simple_confirm_unique');
 const persisted=await repo.get(a.id);expect(persisted?.status).toBe('SETTLED');expect(persisted?.settlements).toHaveLength(2);expect(persisted?.repaymentConfirmations).toHaveLength(1);expect(persisted?.manifest).toEqual(manifest);expect(await db.query('select id from consumed_verifications where agreement_id=$1',[a.id])).toHaveLength(0);
});

it('persists non-NGN agreement units through approval, schedules and repayment',async()=>{
 const t={...terms,currency:'USD',requiredWitnesses:0,principalMinor:'100001',repaymentType:'INSTALLMENTS',installments:recurringPlan('100001','2027-01-31',3,'MONTHLY'),dueDate:'2027-03-31'};
 let a=(await repo.create({...input,terms:t},people[0],'currency_create_unique01')).agreement;
 const sent=await repo.command(a.id,{action:'agree-and-send',expectedVersionId:a.currentVersionId,affirmed:true,signature:people[0].name},people[0],'currency_send_unique01');a=await repo.claim(sent.invitation!.token,people[1]);a=(await repo.command(a.id,{action:'approve',expectedVersionId:a.currentVersionId,affirmed:true,signature:people[1].name},people[1],'currency_accept_unique01')).agreement;
 expect((await db.query<{currency:string}>('select currency from agreements where id=$1',[a.id]))[0].currency).toBe('USD');expect(a.manifest?.version.terms.currency).toBe('USD');const hash=a.manifest?.hash;
 a=(await repo.command(a.id,{action:'repayment',expectedVersionId:a.currentVersionId,amountMinor:'10001',date:'2026-10-11',method:'Cash'},people[1],'currency_pay_unique01')).agreement;
 a=(await repo.command(a.id,{action:'confirm-repayment',expectedVersionId:a.currentVersionId,targetId:a.repayments[0].id},people[0],'currency_confirm_unique01')).agreement;expect(a.balanceMinor).toBe('90000');expect(a.manifest?.hash).toBe(hash);
});
it('serializes private-debt corrections, preserves revisions/payments, and rejects stale or unauthorized updates',async()=>{
 const debts=new PostgresDebtRepository(db),data={person:'Editable private lender',currency:'EUR',amountMinor:'100001',date:'2026-09-01',note:'Before correction',installments:recurringPlan('100001','2027-01-31',3,'MONTHLY')};
 const original=await debts.createDebt(data,people[0],'editable_debt_create_unique');const paid=await debts.payDebt(original.id,{amountMinor:'40000',date:'2026-10-01'},people[0],'editable_debt_pay_unique');
 const edit={...data,person:'Corrected private lender',amountMinor:'90000',installments:recurringPlan('90000','2027-01-31',3,'MONTHLY'),expectedRevision:0};const corrected=await debts.editDebt(original.id,edit,people[0],'editable_debt_edit_unique');expect(await debts.editDebt(original.id,edit,people[0],'editable_debt_edit_unique')).toEqual(corrected);expect(corrected.payments).toEqual(paid.payments);
 expect((await debts.listDebts(people[0])).find(d=>d.id===original.id)?.amountMinor).toBe('90000');expect(await db.query('select revision from personal_debt_revisions where debt_id=$1',[original.id])).toHaveLength(2);
 await expect(debts.editDebt(original.id,edit,people[0],'editable_debt_stale_unique')).rejects.toThrow('changed since');await expect(debts.editDebt(original.id,{...edit,expectedRevision:1},people[4],'editable_debt_foreign_unique')).rejects.toThrow('unavailable');
 await expect(debts.editDebt(original.id,{...edit,amountMinor:'39999',installments:undefined,expectedRevision:1},people[0],'editable_debt_below_paid')).rejects.toThrow('cannot be less');
 await expect(db.query("update personal_debts set principal_minor=39999,data=jsonb_set(jsonb_set(data,'{revision}','2'),'{amountMinor}','\"39999\"') where id=$1",[original.id])).rejects.toThrow('below');
 await expect(db.query('delete from personal_debt_revisions where debt_id=$1',[original.id])).rejects.toThrow('append-only');await expect(db.query("update personal_debt_payments set amount_minor=1 where debt_id=$1",[original.id])).rejects.toThrow('append-only');
 await pg.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${people[4].userId}',false)`);expect((await pg.query('select * from personal_debt_revisions')).rows).toHaveLength(0);await expect(pg.exec("update personal_debts set note='unauthorized'")).rejects.toThrow('permission');await pg.exec('reset role');
});

it('persists private investments with idempotency, exact contributions and correction history',async()=>{
 const investments=new PostgresInvestmentRepository(db),input={name:'Business capital',currency:'GBP',amountMinor:'130001',date:'2026-10-01'};
 const record=await investments.createInvestment(input,people[0],'investment_create_unique_01');
 expect(await investments.createInvestment(input,people[0],'investment_create_unique_01')).toEqual(record);
 const contribution={action:'contribute',amountMinor:'25025',date:'2026-10-05',expectedRevision:0};
 const next=await investments.changeInvestment(record.id,contribution,people[0],'investment_contrib_unique_01');
 expect(next.contributions).toHaveLength(2);
 expect(await investments.changeInvestment(record.id,contribution,people[0],'investment_contrib_unique_01')).toEqual(next);
 await expect(investments.changeInvestment(record.id,contribution,people[0],'investment_stale_unique_01')).rejects.toThrow('changed since');
 const corrected=await investments.changeInvestment(record.id,{action:'edit-contribution',contributionId:next.contributions[0].id,amountMinor:'100000',date:'2026-09-01',expectedRevision:1},people[0],'investment_edit_unique_01');
 expect(corrected.contributions[1]).toEqual(next.contributions[1]);
 await expect(investments.changeInvestment(record.id,{action:'edit',name:'Business',currency:'NGN',expectedRevision:2},people[0],'investment_currency_unique_01')).rejects.toThrow('currency cannot change');
 expect((await db.query('select revision from personal_investment_revisions where investment_id=$1 order by revision',[record.id]))).toEqual([{revision:0},{revision:1},{revision:2}]);
 expect((await investments.listInvestments(people[0])).find(r=>r.id===record.id)).toEqual(corrected);
 await expect(pg.exec("update personal_investment_revisions set data='{}'")).rejects.toThrow('append-only');
 await expect(db.query('delete from personal_investments where id=$1',[record.id])).rejects.toThrow('append-only');
});
it('isolates investment ownership in repositories and direct RLS reads, and preserves archived history',async()=>{
 const investments=new PostgresInvestmentRepository(db),record=await investments.createInvestment({name:'Owner-only fund',currency:'NGN',amountMinor:'10000',date:'2026-10-01'},people[4],'investment_owner_unique_01');
 expect((await investments.listInvestments(people[0])).some(r=>r.id===record.id)).toBe(false);
 await expect(investments.changeInvestment(record.id,{action:'archive',archived:true,expectedRevision:0},people[0],'investment_other_unique_01')).rejects.toThrow('unavailable');
 await pg.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${people[0].userId}',false)`);
 try{
  expect((await pg.query('select * from personal_investments where id=$1',[record.id])).rows).toHaveLength(0);
  expect((await pg.query('select * from personal_investment_revisions where investment_id=$1',[record.id])).rows).toHaveLength(0);
  await expect(pg.exec('update personal_investments set revision=revision+1')).rejects.toThrow('permission');
 }finally{await pg.exec('reset role');}
 const archived=await investments.changeInvestment(record.id,{action:'archive',archived:true,expectedRevision:0},people[4],'investment_archive_unique_01');
 expect(archived.contributions).toEqual(record.contributions);
 await expect(investments.changeInvestment(record.id,{action:'contribute',amountMinor:'1',date:'2026-10-01',expectedRevision:1},people[4],'investment_archived_add_unique')).rejects.toThrow('Restore');
 expect((await investments.changeInvestment(record.id,{action:'archive',archived:false,expectedRevision:1},people[4],'investment_restore_unique_01')).archived).toBe(false);
});

it('persists an idempotent resend with an encrypted token and unchanged financial terms',async()=>{
 const original=(await repo.create(input,people[0],'resend_create_unique_key')).agreement;
 const sent=await repo.command(original.id,{action:'send',expectedVersionId:original.currentVersionId},people[0],'resend_initial_unique_key');
 const a=await repo.claim(sent.invitation!.token,people[1]),body={action:'resend-invitation',expectedVersionId:a.currentVersionId,targetId:a.participants.find(p=>p.role==='LENDER')!.id};
 const one=await repo.command(a.id,body,people[1],'resend_once_unique_key'),two=await repo.command(a.id,body,people[1],'resend_once_unique_key');
 expect(two.agreement).toEqual(one.agreement);expect(two.invitation).toBeUndefined();expect(one.agreement.versions).toEqual(a.versions);expect(one.agreement.approvals).toEqual(a.approvals);expect(one.agreement.status).toBe(a.status);
 const rows=await db.query<{data:{payload:{invitationId:string}};encrypted_delivery:unknown}>('select data,encrypted_delivery from outbox_events where agreement_id=$1 and event_type=$2',[a.id,'INVITATION_DELIVERY']);
 expect(rows).toHaveLength(2);expect(rows.find(r=>r.data.payload.invitationId===one.invitation!.invitationId)!.encrypted_delivery).toBeTruthy();
 expect(JSON.stringify(await db.query('select data,response from outbox_events cross join idempotency_keys'))).not.toContain(one.invitation!.token);
 await expect(repo.command(a.id,body,people[1],'resend_duplicate_unique_key')).rejects.toThrow('wait one minute');
 expect((await repo.get(a.id))!.events.filter(e=>e.type==='INVITATION_RESENT')).toHaveLength(1);
});

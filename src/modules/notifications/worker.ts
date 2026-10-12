import { randomUUID } from 'node:crypto';
import {z} from 'zod';
import { Resend } from 'resend';
import { database, type Database } from '@/lib/database';
import { decryptDelivery } from '@/lib/session';
import { PostgresRepository } from '@/modules/agreements/repository';
import { ensureArtifact, verifyIntegrity } from '@/modules/documents/service';
import type { Aggregate, Outbox, Participant } from '@/modules/agreements/types';
import {processPersonalDebtReminders} from '@/modules/debts/reminder-worker';
import {inngest} from './client';
export {inngest} from './client';
export const messages: Record<string,string> = {
  BORROWER_INVITED:'An agreement is ready for the borrower to review.',
  BORROWER_APPROVED:'The borrower has confirmed the proposed terms.', LENDER_APPROVED:'The lender has confirmed the proposed terms.',
  BORROWER_REQUESTED_CHANGE:'A change has been requested. Review the note together.', AGREEMENT_DECLINED:'The borrower has declined this proposal.',
  VERSION_CREATED:'Updated terms are ready for review. Earlier records are preserved.',
  WITNESS_ATTESTED:'A witness response has been recorded.', WITNESS_DECLINED:'A witness is unable to attest. Review the next step together.',
  AGREEMENT_FINALIZED:'Both parties have a finalized agreement record.', AGREEMENT_CANCELLED:'This proposal has been cancelled. Its history is preserved.',
  REPAYMENT_PROPOSED:'A repayment record is ready for the other party to check.', REPAYMENT_CONFIRMED:'A repayment has been confirmed by both parties.',
  REPAYMENT_DISPUTED:'A repayment needs further checking. The confirmed balance has not changed.',
  FORGIVENESS_PROPOSED:'The lender has offered forgiveness. The borrower can review and acknowledge it.', FORGIVENESS_CONFIRMED:'Forgiveness has been acknowledged and the recorded balance updated.',
  SETTLEMENT_ACKNOWLEDGED:'One party has acknowledged settlement.', AGREEMENT_SETTLED:'Both parties have acknowledged settlement. The settlement record is ready.',
  DUE_SOON:'The recorded repayment date is approaching. Review the agreement together if circumstances have changed.',
  DUE_TODAY:'Today is the recorded repayment date. Repayments are made outside treeti and recorded together.',
  DATE_PASSED:'The recorded repayment date has passed. Review any unconfirmed repayments together.',
};
export function recipients(a:Aggregate,type:string):Participant[]{
  return a.participants.filter(p=>p.userId&&(p.role!=='WITNESS'||(['AGREEMENT_FINALIZED','AGREEMENT_CANCELLED'].includes(type)&&p.versionIds.includes(a.currentVersionId))));
}
type Claimed = {id:string;agreement_id:string;event_type:string;data:Outbox;encrypted_delivery:{iv:string;tag:string;body:string}|null;attempts:number};
export async function claimBatch(db:Database,agreementId?:string){
  return db.transaction(tx=>tx.query<Claimed>(`with picked as (
    select id from outbox_events where attempts < 8 and ($1::uuid is null or agreement_id=$1) and (status='PENDING' or (status='PROCESSING' and lease_until<now()))
    order by data->>'createdAt', id for update skip locked limit 20
  ) update outbox_events o set status='PROCESSING',lease_until=now()+interval '10 minutes',attempts=attempts+1
    from picked where o.id=picked.id returning o.*`,[agreementId??null]));
}
async function deliver(to:string,message:string,url:string,key:string){
  if(!to.includes('@'))throw new Error('SMS_TRANSPORT_REQUIRED');
  if(!process.env.RESEND_API_KEY||!process.env.AHD_EMAIL_FROM)throw new Error('EMAIL_TRANSPORT_REQUIRED');
  const {error}=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.AHD_EMAIL_FROM,to,subject:'An update to your treeti record',text:`${message}\n\nOpen your private record: ${url}\n\nAhd records agreements. It does not hold or transfer money. A witness is not a guarantor.`},{idempotencyKey:key});
  if(error)throw new Error('EMAIL_DELIVERY_FAILED');
}
export async function processOutbox(agreementId?:string){
  if(!process.env.SUPABASE_DB_URL)return {configured:false,processed:0};
  const db=database(),repo=new PostgresRepository(db),batch=await claimBatch(db,agreementId);
  const base=new URL(process.env.AHD_APP_URL!).origin;
  let processed=0,retryable=0;
  for(const row of batch){
    try{
      const a=await repo.get(row.agreement_id);if(!a)throw new Error('AGREEMENT_UNAVAILABLE');
      if(row.event_type==='DOCUMENT_GENERATION'){
        if(!verifyIntegrity(a))throw new Error('EVIDENCE_INTEGRITY_FAILED');
        await ensureArtifact(a,row.data.payload.settlement?'settlement':'pdf');
      }else if(row.event_type==='INVITATION_DELIVERY'){
        const i=a.invitations.find(i=>i.id===row.data.payload.invitationId);
        if(i&&i.status==='PENDING'&&i.expiresAt>new Date().toISOString()&&i.versionId===a.currentVersionId&&!['CANCELLED','DECLINED'].includes(a.status)){
          if(!row.encrypted_delivery)throw new Error('DELIVERY_TOKEN_UNAVAILABLE');
          const {token}=decryptDelivery<{token:string}>(row.encrypted_delivery),p=a.participants.find(p=>p.id===i.participantId)!;
          await deliver(i.destination,p.role==='WITNESS'?'You are invited to review an agreement as a witness. Read the terms and confirm whether you agree to act as a witness. You are not responsible for repayment.':'You are invited to review a proposed interest-free agreement. Read the terms, request changes, or decline before deciding.',`${base}/invite/${token}`,row.id);
        }
      }else{
        const message=messages[row.event_type];
        if(message){
          for(const p of recipients(a,row.event_type)){
            const eventId=String(row.data.payload.eventId??row.id);
            await db.query('insert into notifications (id,user_id,agreement_id,event_id,message) values ($1,$2,$3,$4,$5) on conflict (user_id,event_id) do nothing',[randomUUID(),p.userId,a.id,eventId,message]);
            // Phone identities receive the in-app update. Email delivery is optional
            // for lifecycle updates; invitation delivery is separately retried.
            if(p.contact.includes('@')&&process.env.RESEND_API_KEY)await deliver(p.contact,message,`${base}/agreements/${a.id}`,`${row.id}-${p.id}`);
          }
          if(row.event_type==='REPAYMENT_CONFIRMED'&&a.manifest&&verifyIntegrity(a)){
            const event=a.events.find(e=>e.id===row.data.payload.eventId);
            if(event?.payload.repaymentId)await ensureArtifact(a,'receipt',String(event.payload.repaymentId));
          }
        }
      }
      await db.query("update outbox_events set status='PROCESSED',processed_at=now(),lease_until=null,encrypted_delivery=null,last_error=null where id=$1",[row.id]);processed++;
    }catch(error){
      const label=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'WORKER_OPERATION_FAILED';
      await db.query("update outbox_events set status=$1,lease_until=null,last_error=$2 where id=$3",[row.attempts>=8?'FAILED':'PENDING',label,row.id]);
      if(row.attempts<8)retryable++;
    }
  }
  return {configured:true,processed,total:batch.length,retryable};
}
export async function enqueueReminders(){
  if(!process.env.SUPABASE_DB_URL)return {configured:false};
  const db=database();
  // Africa/Lagos calendar dates, no client time or accidental interest accrual.
  return db.transaction(async tx=>{
    const rows=await tx.query<{id:string;due_date:string;kind:string}>(`select a.id,v.due_date::text,case
      when v.due_date=(now() at time zone 'Africa/Lagos')::date+3 then 'DUE_SOON'
      when v.due_date=(now() at time zone 'Africa/Lagos')::date then 'DUE_TODAY' else 'DATE_PASSED' end as kind
      from agreements a join agreement_versions v on v.id=a.current_version_id
      where a.status='ACTIVE' and a.remaining_balance_minor>0 and v.due_date in (
      (now() at time zone 'Africa/Lagos')::date+3,(now() at time zone 'Africa/Lagos')::date,(now() at time zone 'Africa/Lagos')::date-1)`);
    for(const row of rows){
      const id=randomUUID(),inserted=await tx.query('insert into reminders (id,agreement_id,reminder_type,target_date) values ($1,$2,$3,$4) on conflict do nothing returning id',[id,row.id,row.kind,row.due_date]);
      if(inserted.length)await tx.query('insert into outbox_events (id,agreement_id,event_type,data) values ($1,$2,$3,$4)',[id,row.id,row.kind,JSON.stringify({id,eventType:row.kind,participantId:null,destination:null,payload:{agreementId:row.id,eventId:id},createdAt:new Date().toISOString()})]);
    }return {configured:true,considered:rows.length};
  });
}
const jobTrigger=(id:string,cron:string)=>process.env.AHD_JOB_SCHEDULES==='true'?[{event:`ahd/jobs/${id}`},{cron}]:[{event:`ahd/jobs/${id}`}];
const jobScope=z.object({agreementId:z.string().uuid().optional(),reminderId:z.string().uuid().optional()});
export const functions=[
  // Beta budget: two single-step sweeps every five minutes; see ADR 004.
  inngest.createFunction({id:'personal-debt-reminders',concurrency:1,retries:3},jobTrigger('personal-debt-reminders','*/5 * * * *'),async({event,step})=>{
    const {reminderId}=jobScope.parse(event.data);
    return step.run('deliver-owner-reminders',async()=>{const result=await processPersonalDebtReminders(reminderId);if('retryable' in result&&result.retryable)throw new Error('REMINDER_RETRY_REQUIRED');return result;});
  }),
  inngest.createFunction({id:'deliver-outbox',concurrency:1,retries:3},jobTrigger('deliver-outbox','*/5 * * * *'),async({event,step})=>{
    const {agreementId}=jobScope.parse(event.data);
    return step.run('claim-and-deliver',async()=>{const result=await processOutbox(agreementId);if(('retryable' in result&&result.retryable)||('total' in result&&result.total===20))throw new Error('OUTBOX_RETRY_REQUIRED');return result;});
  }),
  inngest.createFunction({id:'gentle-date-reminders',concurrency:1,retries:3},jobTrigger('gentle-date-reminders','0 8 * * *'),async({step})=>step.run('enqueue-once',enqueueReminders)),
];

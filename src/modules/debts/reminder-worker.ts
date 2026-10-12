import {Resend} from 'resend';
import {database,type Database} from '@/lib/database';
type Claim={id:string;debt_id:string;email_contact:string;attempts:number};
export type ReminderEmail=(to:string,key:string)=>Promise<void>;

export async function deliverDebtReminders(db:Database,send:ReminderEmail,reminderId?:string){
  const batch=await db.transaction(tx=>tx.query<Claim>(`with picked as (
    select r.debt_id from personal_debt_reminders r join personal_debts d on d.id=r.debt_id
    where r.email_contact is not null and r.remind_at<=now() and r.attempts<8
      and ($1::uuid is null or r.id=$1)
      and (r.status='SCHEDULED' or (r.status='PROCESSING' and r.lease_until<now()))
      and d.principal_minor>coalesce((select sum(p.amount_minor) from personal_debt_payments p where p.debt_id=d.id),0)
    order by r.remind_at for update of r skip locked limit 20
  ) update personal_debt_reminders r set status='PROCESSING',lease_until=now()+interval '10 minutes',attempts=attempts+1
    from picked where r.debt_id=picked.debt_id returning r.id,r.debt_id,r.email_contact,r.attempts`,[reminderId??null]));
  let sent=0,retryable=0;
  for(const row of batch){
    // Rescheduling or cancelling changes the reminder ID/state. Do not deliver an old claim.
    const [current]=await db.query(`select r.id from personal_debt_reminders r join personal_debts d on d.id=r.debt_id where r.id=$1 and r.status='PROCESSING' and r.remind_at<=now() and d.principal_minor>coalesce((select sum(amount_minor) from personal_debt_payments where debt_id=d.id),0)`,[row.id]);
    if(!current)continue;
    try{
      await send(row.email_contact,`personal-reminder-${row.id}`);
      await db.query("update personal_debt_reminders set status='SENT',email_sent_at=now(),lease_until=null where id=$1 and status='PROCESSING'",[row.id]);sent++;
    }catch{
      await db.query("update personal_debt_reminders set status=$2,lease_until=null where id=$1 and status='PROCESSING'",[row.id,row.attempts>=8?'FAILED':'SCHEDULED']);
      if(row.attempts<8)retryable++;
    }
  }
  return {considered:batch.length,sent,retryable};
}
export async function processPersonalDebtReminders(reminderId?:string){
  if(!process.env.SUPABASE_DB_URL||!process.env.RESEND_API_KEY||!process.env.AHD_EMAIL_FROM||!process.env.AHD_APP_URL)return {configured:false};
  const base=new URL(process.env.AHD_APP_URL).origin,resend=new Resend(process.env.RESEND_API_KEY);
  return {configured:true,...await deliverDebtReminders(database(),async(to,key)=>{
    const {error}=await resend.emails.send({from:process.env.AHD_EMAIL_FROM!,to,subject:'A moment to review your treeti record',text:`You asked for a reminder to review your private repayment plans.\n\nOpen My debts: ${base}/debts\n\nThis reminder is only for you. Payments happen outside treeti.`},{idempotencyKey:key});
    if(error)throw new Error('EMAIL_DELIVERY_FAILED');
  },reminderId)};
}

import {randomUUID} from 'node:crypto';
import {database,type Database} from '@/lib/database';
import type {Actor} from '@/modules/agreements/types';
import {DomainError} from '@/modules/agreements/domain';
import {DemoRepository} from '@/modules/agreements/demo';
import {PostgresRepository} from '@/modules/agreements/repository';
import {createDebt,editDebt,recordDebtPayment,type DebtPayment,type PersonalDebt} from './model';
import {makeReminder,type DebtReminder} from './reminders';

export interface DebtRepository {
  listDebts(actor:Actor):Promise<PersonalDebt[]>;
  createDebt(input:unknown,actor:Actor,key:string):Promise<PersonalDebt>;
  editDebt(id:string,input:unknown,actor:Actor,key:string):Promise<PersonalDebt>;
  payDebt(id:string,input:unknown,actor:Actor,key:string):Promise<PersonalDebt>;
  setDebtReminder(id:string,input:unknown,actor:Actor,key:string):Promise<PersonalDebt>;
}
export function debtRepository(demo:boolean,workspace?:string):DebtRepository {
  if(demo){if(!workspace)throw new DomainError('AUTH_REQUIRED','Open the demonstration to continue.',401);return new DemoRepository(workspace);}
  return new PostgresDebtRepository(database());
}
export class PostgresDebtRepository implements DebtRepository {
  constructor(private db:Database){}
  async load(db:Database,id:string,ownerId:string,lock=false):Promise<PersonalDebt|null>{
    const [row]=await db.query<{data:PersonalDebt}>(`select data from personal_debts where id=$1 and owner_id=$2${lock?' for update':''}`,[id,ownerId]);
    if(!row)return null;
    const payments=await db.query<{data:DebtPayment}>('select data from personal_debt_payments where debt_id=$1 and owner_id=$2 order by created_at,id',[id,ownerId]);
    const [reminder]=await db.query<{id:string;remind_at:string;time_zone:string;email_contact:string|null;email_sent_at:string|null;status:string}>("select id,remind_at::text,time_zone,email_contact,email_sent_at::text,status from personal_debt_reminders where debt_id=$1 and owner_id=$2 and status!='CANCELLED'",[id,ownerId]);
    const current:DebtReminder|null=reminder?{id:reminder.id,remindAt:new Date(reminder.remind_at).toISOString(),timeZone:reminder.time_zone,email:!!reminder.email_contact,emailSentAt:reminder.email_sent_at,emailFailed:reminder.status==='FAILED'}:null;
    return {...row.data,payments:payments.map(p=>p.data),reminder:current};
  }
  async listDebts(actor:Actor){return this.db.transaction(async db=>{const rows=await db.query<{id:string}>('select id from personal_debts where owner_id=$1 order by created_at desc,id',[actor.userId]);return (await Promise.all(rows.map(r=>this.load(db,r.id,actor.userId)))).filter((d):d is PersonalDebt=>!!d);});}
  async createDebt(input:unknown,actor:Actor,key:string){return this.db.transaction(db=>new PostgresRepository(db).idempotent(db,actor,key,'private-debt-create',input,async()=>{
    const now=await new PostgresRepository(db).now(db),debt=createDebt(input,actor.userId,randomUUID(),now);
    await db.query('insert into personal_debts(id,owner_id,person,currency,principal_minor,debt_date,note,created_at,data) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[debt.id,debt.ownerId,debt.person,debt.currency,debt.amountMinor,debt.date,debt.note,now,JSON.stringify(debt)]);
    return debt;
  }));}
  async payDebt(id:string,input:unknown,actor:Actor,key:string){return this.db.transaction(db=>new PostgresRepository(db).idempotent(db,actor,key,'private-debt-payment',{id,input},async()=>{
    const debt=await this.load(db,id,actor.userId,true);if(!debt)throw new DomainError('NOT_FOUND','This private debt is unavailable.',404);
    const now=await new PostgresRepository(db).now(db),next=recordDebtPayment(debt,input,actor.userId,randomUUID(),now),payment=next.payments.at(-1)!;
    await db.query('insert into personal_debt_payments(id,debt_id,owner_id,amount_minor,payment_date,created_at,data) values($1,$2,$3,$4,$5,$6,$7)',[payment.id,id,actor.userId,payment.amountMinor,payment.date,now,JSON.stringify(payment)]);
    if(!next.reminder)await db.query("update personal_debt_reminders set status='CANCELLED',lease_until=null where debt_id=$1 and owner_id=$2",[id,actor.userId]);
    return next;
  }));}
  async editDebt(id:string,input:unknown,actor:Actor,key:string){return this.db.transaction(db=>new PostgresRepository(db).idempotent(db,actor,key,'private-debt-edit',{id,input},async()=>{
    const debt=await this.load(db,id,actor.userId,true);if(!debt)throw new DomainError('NOT_FOUND','This private debt is unavailable.',404);
    const next=editDebt(debt,input,actor.userId,await new PostgresRepository(db).now(db));
    // Payments live in their immutable ledger; the editable row contains metadata only.
    const data={...next,payments:[]};delete data.reminder;
    await db.query('update personal_debts set person=$1,currency=$2,principal_minor=$3,debt_date=$4,note=$5,data=$6 where id=$7 and owner_id=$8',[next.person,next.currency,next.amountMinor,next.date,next.note,JSON.stringify(data),id,actor.userId]);
    if(!next.reminder)await db.query("update personal_debt_reminders set status='CANCELLED',lease_until=null where debt_id=$1 and owner_id=$2",[id,actor.userId]);
    return next;
  }));}
  async setDebtReminder(id:string,input:unknown,actor:Actor,key:string){return this.db.transaction(db=>new PostgresRepository(db).idempotent(db,actor,key,'private-debt-reminder',{id,input},async()=>{
    const debt=await this.load(db,id,actor.userId,true);if(!debt)throw new DomainError('NOT_FOUND','This private debt is unavailable.',404);
    const reminder=makeReminder(debt,input,randomUUID(),await new PostgresRepository(db).now(db));
    if(!reminder){await db.query("update personal_debt_reminders set status='CANCELLED',lease_until=null where debt_id=$1 and owner_id=$2",[id,actor.userId]);return {...debt,reminder:null};}
    const email=actor.contacts.find(c=>c.includes('@'));
    if(reminder.email&&(!email||!process.env.RESEND_API_KEY||!process.env.AHD_EMAIL_FROM))throw new DomainError('EMAIL_UNAVAILABLE','Email reminders need a verified email and connected delivery service. Save an in-app reminder instead.',422);
    await db.query(`insert into personal_debt_reminders(debt_id,owner_id,id,remind_at,time_zone,email_contact) values($1,$2,$3,$4,$5,$6)
      on conflict(debt_id) do update set id=excluded.id,remind_at=excluded.remind_at,time_zone=excluded.time_zone,email_contact=excluded.email_contact,email_sent_at=null,status='SCHEDULED',attempts=0,lease_until=null`,[id,actor.userId,reminder.id,reminder.remindAt,reminder.timeZone,reminder.email?email:null]);
    return {...debt,reminder};
  }));}
}

import {z} from 'zod';
import {calendarDate} from '@/lib/calendar';
import {DomainError} from '@/lib/domain-error';
import type {DebtReminder} from './reminders';
import {currencies} from '@/lib/currencies';
import {calendarDateSchema,installmentPlanSchema,validateInstallmentPlan} from '@/lib/installment-schema';

export const debtCurrencies=currencies;
const amount=z.string().regex(/^[1-9]\d{0,13}$/).refine(v=>/^[1-9]\d{0,13}$/.test(v)&&BigInt(v)<=99999999999999n,'Amount is too large.');
const date=calendarDateSchema;
const debtFields=z.object({person:z.string().trim().min(2,'Add the person you owe.').max(120),currency:z.enum(debtCurrencies),amountMinor:amount,date,note:z.string().trim().max(2000).default(''),dueDate:date.optional(),installments:installmentPlanSchema.optional()}).strict();
function validateDebt(v:z.infer<typeof debtFields>,ctx:z.RefinementCtx){
 if(v.dueDate&&v.dueDate<v.date)ctx.addIssue({code:'custom',path:['dueDate'],message:'Choose a repayment date on or after the debt date.'});
 if(v.dueDate&&v.installments)ctx.addIssue({code:'custom',path:['dueDate'],message:'Choose a single repayment or an installment plan.'});
 if(v.installments)validateInstallmentPlan(v.installments,v.amountMinor,v.date,(path,message)=>ctx.addIssue({code:'custom',path:['installments',...path],message}));
}
export const debtInput=debtFields.superRefine(validateDebt);
export const debtEditInput=debtFields.extend({expectedRevision:z.number().int().nonnegative()}).superRefine(validateDebt);
export const paymentInput=z.object({amountMinor:amount,date,note:z.string().trim().max(2000).default('')}).strict();
export type DebtPayment=z.infer<typeof paymentInput>&{id:string;createdAt:string};
export type PersonalDebt=z.infer<typeof debtInput>&{id:string;ownerId:string;createdAt:string;payments:DebtPayment[];reminder?:DebtReminder|null;revision?:number;updatedAt?:string};
export function debtRemaining(debt:PersonalDebt){return (BigInt(debt.amountMinor)-debt.payments.reduce((sum,p)=>sum+BigInt(p.amountMinor),0n)).toString();}
export function debtTotals(debts:PersonalDebt[]){const totals=new Map<string,bigint>();for(const debt of debts)totals.set(debt.currency,(totals.get(debt.currency)??0n)+BigInt(debtRemaining(debt)));return [...totals].map(([currency,amountMinor])=>({currency,amountMinor:amountMinor.toString()}));}
export function debtMoney(minor:string,currency:string){const value=BigInt(minor);return `${currency} ${(value/100n).toLocaleString('en-NG')}${value%100n?'.'+(value%100n).toString().padStart(2,'0'):''}`;}
export function createDebt(input:unknown,ownerId:string,id:string,now:string):PersonalDebt{const data=debtInput.parse(input);if(data.date>calendarDate(now))throw new DomainError('DATE_FUTURE','Choose a debt date of today or earlier.',422);return {...data,id,ownerId,createdAt:now,payments:[]};}
export function editDebt(debt:PersonalDebt,input:unknown,ownerId:string,now:string):PersonalDebt{
 if(debt.ownerId!==ownerId)throw new DomainError('NOT_FOUND','This private debt is unavailable.',404);
 const {expectedRevision,...data}=debtEditInput.parse(input);
 if(expectedRevision!==(debt.revision??0))throw new DomainError('DEBT_CHANGED','This debt changed since you opened it. Load the latest record and try again.',409);
 if(data.date>calendarDate(now))throw new DomainError('DATE_FUTURE','Choose a debt date of today or earlier.',422);
 const paid=debt.payments.reduce((n,p)=>n+BigInt(p.amountMinor),0n);
 if(BigInt(data.amountMinor)<paid)throw new DomainError('AMOUNT_BELOW_PAID','The original amount cannot be less than the payments already recorded.',422);
 if(debt.payments.length&&data.currency!==debt.currency)throw new DomainError('CURRENCY_HAS_PAYMENTS','The currency cannot change after a payment is recorded.',422);
 if(debt.payments.some(p=>p.date<data.date))throw new DomainError('DATE_AFTER_PAYMENT','Choose a debt date on or before the earliest recorded payment.',422);
 const {dueDate:_dueDate,installments:_installments,...previous}=debt;void _dueDate;void _installments;
 const next={...previous,...data,revision:expectedRevision+1,updatedAt:now};
 return debtRemaining(next)==='0'?{...next,reminder:null}:next;
}
export function recordDebtPayment(debt:PersonalDebt,input:unknown,ownerId:string,id:string,now:string):PersonalDebt{
  if(debt.ownerId!==ownerId)throw new DomainError('NOT_FOUND','This private debt is unavailable.',404);
  const payment=paymentInput.parse(input);
  if(payment.date>calendarDate(now))throw new DomainError('DATE_FUTURE','Choose a payment date of today or earlier.',422);
  if(payment.date<debt.date)throw new DomainError('DATE_BEFORE_DEBT','Choose a payment date on or after the debt date.',422);
  if(BigInt(payment.amountMinor)>BigInt(debtRemaining(debt)))throw new DomainError('PAYMENT_EXCEEDS_BALANCE','This payment is more than the remaining amount. Check the amount and try again.',422);
  const next={...debt,payments:[...debt.payments,{...payment,id,createdAt:now}]};
  return debtRemaining(next)==='0'?{...next,reminder:null}:next;
}

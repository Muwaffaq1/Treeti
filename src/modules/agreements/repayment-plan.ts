import type {Aggregate, Installment, InstallmentPlan, Terms} from './types';
import {money} from '@/lib/money';

export function installmentDate(first: string, index: number, frequency: 'WEEKLY'|'MONTHLY'): string {
  const date = new Date(`${first}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(first) || Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==first) throw new Error('Choose a valid first payment date.');
  if (frequency==='WEEKLY') date.setUTCDate(date.getUTCDate()+index*7);
  else {
    const day=date.getUTCDate();
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth()+index);
    const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
    date.setUTCDate(Math.min(day,last));
  }
  const result=date.toISOString().slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(result))throw new Error('Choose payment dates before the year 10000.');
  return result;
}

export function recurringPlan(principalMinor:string, first:string, count:number, frequency:'WEEKLY'|'MONTHLY'):InstallmentPlan {
  if(!Number.isInteger(count)||count<2||count>60)throw new Error('Choose between 2 and 60 payments.');
  const principal=BigInt(principalMinor),each=principal/BigInt(count);
  if(each<1n)throw new Error('The amount must cover at least one minor currency unit per payment.');
  return {frequency,payments:Array.from({length:count},(_,i)=>({dueDate:installmentDate(first,i,frequency),amountMinor:(i===count-1?principal-each*BigInt(count-1):each).toString()}))};
}

export function repaymentLabel(terms:Terms):string {
  if(terms.repaymentType==='SINGLE')return 'Single repayment';
  return terms.installments?.frequency==='WEEKLY'?'Weekly installments':terms.installments?.frequency==='MONTHLY'?'Monthly installments':'Custom installments';
}

export function repaymentWording(terms:Terms):string {
  if(terms.repaymentType==='SINGLE')return `The principal is to be repaid in a single repayment by ${terms.dueDate}.`;
  return `The principal is to be repaid in ${terms.installments!.payments.length} installments (${repaymentLabel(terms).toLowerCase()}): ${terms.installments!.payments.map((p,i)=>`${i+1}. ${money(p.amountMinor,terms.currency)} due ${p.dueDate}`).join('; ')}. Final repayment is due by ${terms.dueDate}.`;
}

/** Confirmed payments clear the earliest scheduled amounts first. No proposed payment affects progress. */
export function installmentProgress(a:Aggregate, payments:Installment[]) {
  const cleared=a.repayments.filter(p=>p.status==='CONFIRMED').reduce((n,p)=>n+BigInt(p.amountMinor),0n)
    +a.adjustments.filter(p=>a.adjustmentConfirmations.some(c=>c.adjustmentId===p.id)).reduce((n,p)=>n+BigInt(p.amountMinor),0n);
  return allocateInstallments(payments,cleared.toString());
}
export function allocateInstallments(payments:Installment[],clearedMinor:string){
  let cleared=BigInt(clearedMinor);
  return payments.map(payment=>{const amount=BigInt(payment.amountMinor),applied=cleared>amount?amount:cleared;cleared-=applied;return {...payment,clearedMinor:applied.toString(),remainingMinor:(amount-applied).toString()};});
}

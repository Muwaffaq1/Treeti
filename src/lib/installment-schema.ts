import {z} from 'zod';
import {installmentDate} from '@/modules/agreements/repayment-plan';
import type {InstallmentPlan} from '@/modules/agreements/types';
export const calendarDateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Choose a valid calendar date.');
const amount=z.string().regex(/^[1-9]\d{0,13}$/).refine(v=>/^[1-9]\d{0,13}$/.test(v)&&BigInt(v)<=99999999999999n,'Amount is too large.');
export const installmentPlanSchema=z.object({frequency:z.enum(['WEEKLY','MONTHLY','CUSTOM']),payments:z.array(z.object({dueDate:calendarDateSchema,amountMinor:amount}).strict()).min(2).max(60)}).strict();
export function validateInstallmentPlan(plan:InstallmentPlan,principal:string,start:string,issue:(path:(string|number)[],message:string)=>void){
 let sum=0n;
 plan.payments.forEach((p,i)=>{
  if(amount.safeParse(p.amountMinor).success)sum+=BigInt(p.amountMinor);
  if(p.dueDate<start)issue(['payments',i,'dueDate'],'Payments cannot be due before the original date.');
  if(i&&p.dueDate<=plan.payments[i-1].dueDate)issue(['payments',i,'dueDate'],'Choose payment dates in increasing order.');
  if(plan.frequency!=='CUSTOM'&&calendarDateSchema.safeParse(plan.payments[0].dueDate).success){
   try{if(p.dueDate!==installmentDate(plan.payments[0].dueDate,i,plan.frequency))issue(['payments',i,'dueDate'],'Payment dates must match the selected frequency.');}catch{issue([],'Choose a valid payment schedule.');}
  }
 });
 if(amount.safeParse(principal).success&&sum!==BigInt(principal))issue([],'The installment amounts must add up to the full original amount.');
}

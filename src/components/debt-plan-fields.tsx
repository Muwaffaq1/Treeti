'use client';
import {Field,Button} from './ui';
import {parseMoney,moneyInput,groupMoneyInput} from '@/lib/money';
import {recurringPlan} from '@/modules/agreements/repayment-plan';
import {formatMoneyChange} from './money-input';
import type {PersonalDebt} from '@/modules/debts/model';
import type {InstallmentPlan} from '@/modules/agreements/types';
export type DebtPlanDraft={type:'NONE'|'SINGLE'|'WEEKLY'|'MONTHLY'|'CUSTOM';dueDate:string;firstDate:string;count:string;payments:{dueDate:string;amount:string}[]};
export function debtPlanDraft(debt?:PersonalDebt):DebtPlanDraft{return {type:debt?.installments?.frequency??(debt?.dueDate?'SINGLE':'NONE'),dueDate:debt?.dueDate??'',firstDate:debt?.installments?.payments[0]?.dueDate??'',count:String(debt?.installments?.payments.length??2),payments:debt?.installments?.payments.map(p=>({dueDate:p.dueDate,amount:groupMoneyInput(moneyInput(p.amountMinor))}))??[{dueDate:'',amount:''},{dueDate:'',amount:''}]};}
export function buildDebtPlan(draft:DebtPlanDraft,amount:string):{dueDate?:string;installments?:InstallmentPlan}{
 if(draft.type==='NONE')return {};
 if(draft.type==='SINGLE')return {dueDate:draft.dueDate};
 return {installments:draft.type==='CUSTOM'?{frequency:'CUSTOM',payments:draft.payments.map(p=>({dueDate:p.dueDate,amountMinor:parseMoney(p.amount)}))}:recurringPlan(parseMoney(amount),draft.firstDate,Number(draft.count),draft.type)};
}
export function DebtPlanFields({draft,onChange,amount,date,currency}:{draft:DebtPlanDraft;onChange:(value:DebtPlanDraft)=>void;amount:string;date:string;currency:string}){
 function update(values:Partial<DebtPlanDraft>){onChange({...draft,...values});}
 function payment(index:number,values:Partial<DebtPlanDraft['payments'][number]>){update({payments:draft.payments.map((p,i)=>i===index?{...p,...values}:p)});}
 return <section className="debt-plan-fields" aria-label="Private repayment plan">
  <Field label="Repayment plan (optional)" hint="Track the plan you agreed outside treeti. It does not invite anyone or send a payment."><select value={draft.type} onChange={e=>update({type:e.target.value as DebtPlanDraft['type']})}><option value="NONE">Not set</option><option value="SINGLE">Single repayment</option><option value="WEEKLY">Weekly installments</option><option value="MONTHLY">Monthly installments</option><option value="CUSTOM">Custom installments</option></select></Field>
  {draft.type==='SINGLE'&&<Field label="Repayment date"><input type="date" value={draft.dueDate} onChange={e=>update({dueDate:e.target.value})} min={date} required/></Field>}
  {(draft.type==='WEEKLY'||draft.type==='MONTHLY')&&<div className="form-grid"><Field label="First payment date"><input type="date" value={draft.firstDate} onChange={e=>update({firstDate:e.target.value})} min={date} required/></Field><Field label="Number of payments" hint="Between 2 and 60. The final payment includes any rounding difference."><input type="number" inputMode="numeric" value={draft.count} onChange={e=>update({count:e.target.value})} min={2} max={60} step={1} required/></Field></div>}
  {draft.type==='CUSTOM'&&<div className="custom-installments"><p className="quiet-note">Use 2–60 payments. The amounts must add up to the original amount, including payments already recorded.</p>{draft.payments.map((p,i)=><div className="custom-installment" key={i}><div className="section-heading"><h3>Payment {i+1}</h3>{draft.payments.length>2&&<Button type="button" variant="ghost" aria-label={`Remove payment ${i+1}`} onClick={()=>update({payments:draft.payments.filter((_,j)=>j!==i)})}>Remove</Button>}</div><div className="form-grid"><Field label={`Payment ${i+1} date`}><input type="date" value={p.dueDate} onChange={e=>payment(i,{dueDate:e.target.value})} min={date} required/></Field><Field label={`Payment ${i+1} amount (${currency})`}><input value={p.amount} onChange={e=>{formatMoneyChange(e);payment(i,{amount:e.target.value});}} inputMode="decimal" placeholder="e.g. 5,000.00" required/></Field></div></div>)}<Button type="button" variant="secondary" disabled={draft.payments.length>=60} onClick={()=>update({payments:[...draft.payments,{dueDate:'',amount:''}]})}>Add payment</Button><Button type="button" variant="ghost" disabled={!amount} onClick={()=>{try{const principal=BigInt(parseMoney(amount)),each=principal/BigInt(draft.payments.length);if(each<1n)return;update({payments:draft.payments.map((p,i)=>({...p,amount:groupMoneyInput(moneyInput((i===draft.payments.length-1?principal-each*BigInt(i):each).toString()))}))});}catch{}}}>Split equally</Button></div>}
 </section>;
}

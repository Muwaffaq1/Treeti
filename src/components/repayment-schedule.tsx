import type {Aggregate,Terms,InstallmentPlan} from '@/modules/agreements/types';
import {allocateInstallments,installmentProgress,repaymentLabel} from '@/modules/agreements/repayment-plan';
import {calendarDate} from '@/lib/calendar';
import {money} from '@/lib/money';
import {formatDate} from './agreement-utils';

export function RepaymentSchedule({terms,agreement}:{terms:Terms;agreement?:Aggregate}) {
  if(!terms.installments)return null;
  const rows=agreement?installmentProgress(agreement,terms.installments.payments):terms.installments.payments;
  return <ScheduleRows rows={rows} currency={terms.currency} title={repaymentLabel(terms)} note={agreement?'Confirmed payments and acknowledged forgiveness clear the earliest scheduled amounts first.':'Amounts add up to the principal. Payments happen outside treeti.'}/>;
}
export function PrivateDebtSchedule({plan,currency,paidMinor}:{plan:InstallmentPlan;currency:string;paidMinor:string}){
 const title=plan.frequency==='WEEKLY'?'Weekly installments':plan.frequency==='MONTHLY'?'Monthly installments':'Custom installments';
 return <ScheduleRows rows={allocateInstallments(plan.payments,paidMinor)} currency={currency} title={title} note="Your recorded payments clear the earliest scheduled amounts first. This plan is only visible to you."/>;
}
function ScheduleRows({rows,currency,title,note}:{rows:({dueDate:string;amountMinor:string;remainingMinor?:string})[];currency:string;title:string;note:string}){
 return <section className="repayment-schedule" aria-label="Installment schedule"><h3>{title}</h3><p className="quiet-note">{note}</p><ol>{rows.map((p,i)=>{
    const remaining='remainingMinor' in p?String(p.remainingMinor):undefined;
    const status=remaining==='0'?'Cleared':remaining&&p.dueDate<calendarDate()?'Past due':remaining&&remaining!==p.amountMinor?'Partly cleared':'Scheduled';
    return <li key={`${i}-${p.dueDate}`}><div><span>Payment {i+1}</span><strong>{formatDate(p.dueDate)}</strong></div><div><strong>{money(p.amountMinor,currency)}</strong>{remaining!==undefined&&<small>{status}{remaining!=='0'?` · ${money(remaining,currency)} remaining`:''}</small>}</div></li>;
  })}</ol></section>;
}

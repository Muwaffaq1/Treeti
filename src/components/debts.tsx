'use client';
import {useEffect,useState} from 'react';
import {Bell,CheckCircle2,LockKeyhole,Plus,Pencil,WalletCards,UsersRound} from '@/components/icons';
import {money} from '@/lib/money';
import {allocateInstallments} from '@/modules/agreements/repayment-plan';
import {Amount,Panel,RingAvatar,fitChars,longAmount} from './kit';
import {calendarDate} from '@/lib/calendar';
import {debtRemaining,debtTotals,type PersonalDebt} from '@/modules/debts/model';
import {api,apiBase} from './client-api';
import {formatDate} from './agreement-utils';
import {DisclosureSummary} from './ui';
import {PrivateDebtSchedule} from './repayment-schedule';
import {DebtReminderForm,ReminderOnCard} from './debt-reminder';
import {DebtBlanks,PaymentBlanks} from './record-blanks';

export function DebtTracker({initial,demo,emailAvailable=false}:{initial:PersonalDebt[];demo:boolean;emailAvailable?:boolean}){
  const [debts,setDebts]=useState(initial),[success,setSuccess]=useState(''),[paymentFor,setPaymentFor]=useState<string|null>(null);
  const [adding,setAdding]=useState(false),[editing,setEditing]=useState<PersonalDebt|null>(null),[paying,setPaying]=useState(false);
  const totals=debtTotals(debts);
  const [reminderFor,setReminderFor]=useState<string|null>(null),[now,setNow]=useState(0),reminderDebt=debts.find(d=>d.id===reminderFor),dueReminders=debts.filter(d=>d.reminder&&Date.parse(d.reminder.remindAt)<=now&&debtRemaining(d)!=='0');
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000),first=setTimeout(()=>setNow(Date.now()),0);return ()=>{clearInterval(timer);clearTimeout(first);};},[]);
  function openDebt(){setSuccess('');setAdding(true);}
  // "New" → "A debt" lands here with ?new=1: open the form once, then tidy the address.
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('new')!=='1')return;window.history.replaceState(null,'',window.location.pathname);openDebt();
   
  },[]);
  function openEdit(debt:PersonalDebt){setSuccess('');setEditing(debt);}
  async function latestDebt(id:string){const {debts:latest}=await api<{debts:PersonalDebt[]}>(`${apiBase(demo)}/debts`);setDebts(latest);return latest.find(d=>d.id===id);}
  function openPayment(debt:PersonalDebt){setSuccess('');setPaymentFor(debt.id);setPaying(true);}
  const outstanding=debts.filter(d=>debtRemaining(d)!=='0'),paidBack=debts.filter(d=>debtRemaining(d)==='0');
  const [detailFor,setDetailFor]=useState<string|null>(null),detail=debts.find(d=>d.id===detailFor);
  const today=calendarDate(),next=nextPayment(outstanding,today),main=totals.find(t=>t.currency==='NGN')??totals[0],others=totals.filter(t=>t!==main&&t.amountMinor!=='0');
  const people=new Set(outstanding.map(d=>d.person.trim().toLowerCase())).size;
  return <div className="ledger">
    <DebtBlanks open={adding} onOpenChange={setAdding} demo={demo} onSaved={debt=>{setDebts(current=>[debt,...current]);setSuccess(`Your private record for ${debt.person} is saved.`);}}/>
    <DebtBlanks open={!!editing} onOpenChange={o=>{if(!o)setEditing(null);}} demo={demo} debt={editing} onReload={()=>editing?latestDebt(editing.id):Promise.resolve(undefined)} onSaved={debt=>{setDebts(current=>current.map(d=>d.id===debt.id?debt:d));setSuccess(`Your record for ${debt.person} is updated. Recorded payments are unchanged.`);}}/>
    <PaymentBlanks open={paying} onOpenChange={setPaying} demo={demo} debts={outstanding} startId={paymentFor} nextPartOf={nextPart} labelOf={d=>nextLabel(d,today)} onSaved={(debt,before)=>{setDebts(current=>current.map(d=>d.id===debt.id?debt:d));setSuccess(debtRemaining(debt)==='0'?`Your record for ${debt.person} is paid back in full.${before.reminder?' Your treeti reminder was removed. If you added a calendar event, remove it in your calendar too.':''}`:`Payment saved. ${money(debtRemaining(debt),debt.currency)} remains for ${debt.person}.`);}}/>
    <header className="ledger-head">
      <h1>My debts</h1>
      <p className="ledger-private"><LockKeyhole size={14} aria-hidden/>Only you can see these</p>
      {debts.length>0&&<section className="ledger-total" aria-label="Outstanding totals by currency">
        <p className="ledger-amount" style={main?fitChars(money(main.amountMinor,main.currency)):undefined}>{main&&<Amount text={money(main.amountMinor,main.currency)} currency={main.currency}/>}</p>
        {others.length>0&&<p className="ledger-others">{others.map(t=>money(t.amountMinor,t.currency)).join(' + ')}</p>}
        <p className="ledger-caption">{outstanding.length?`left to repay, across ${people===1?'1 person':`${people} people`}`:'Everything is paid back'}</p>
      </section>}
      {next&&(daysTo(today,next.dueDate)<0
        ?<p className="ledger-next">Your payment of <strong>{money(next.amountMinor,next.currency)}</strong> to <span className="ledger-name">{next.person}</span> was due on <strong>{shortDue(next.dueDate)}</strong>.</p>
        :<p className="ledger-next">Your next payment is <strong>{money(next.amountMinor,next.currency)}</strong> to <span className="ledger-name">{next.person}</span> <strong>{whenText(next.dueDate,today)}</strong>.</p>)}
    </header>
    <div role="status">{success&&<div className="success-notice"><CheckCircle2 size={18}/>{success}<button onClick={()=>setSuccess('')}>Dismiss</button></div>}</div>
    {dueReminders.length>0&&<section className="reminder-list" aria-label="Reminders ready to review">{dueReminders.map(debt=><div key={debt.id}><Bell size={22} aria-hidden/><div><h2>Your reminder for {debt.person}</h2><p>Take a moment to review your repayment plans. {money(debtRemaining(debt),debt.currency)} remains in your record.</p><a href={`#debt-${debt.id}`} onClick={e=>{e.preventDefault();setDetailFor(debt.id);}}>Review private record</a></div></div>)}</section>}
    {!debts.length&&<section className="agreements-empty"><span className="agreements-empty-icon" aria-hidden><WalletCards size={28}/></span><h2>A clear picture of what remains</h2><p>Add who you owe and how much. Record each repayment to see what’s left. Only you can see it.</p><div className="agreements-empty-actions"><button type="button" className="button button-primary" onClick={openDebt}>Add a debt</button></div></section>}
    {([['Still to repay',outstanding],['Paid back',paidBack]] as const).filter(([,list])=>list.length).map(([title,list])=><section key={title} className="agreements-group ledger-group" aria-labelledby={`ledger-${title.replace(/\s/g,'-')}`}>
      <h2 className="kit-overline agreements-group-title" id={`ledger-${title.replace(/\s/g,'-')}`}>{title} · {list.length}</h2>
      <ul>{list.map(debt=><li key={debt.id}><DebtRow debt={debt} today={today} now={now} onOpen={()=>setDetailFor(debt.id)}/></li>)}</ul>
    </section>)}
    {debts.length>0&&<div className="ledger-dock">
      {outstanding.length>0&&<button type="button" className="brief-cta" onClick={()=>openPayment([...outstanding].sort((x,y)=>(nextDue(x)?.dueDate??'9999').localeCompare(nextDue(y)?.dueDate??'9999'))[0])}>Record a payment</button>}
      <button type="button" className="button sign-tertiary ledger-add" onClick={openDebt}><Plus size={16} aria-hidden/>Add a debt</button>
    </div>}
    <p className="quiet-note debt-footnote">The people you name, including witnesses, aren’t told or asked to confirm. Shared agreements stay in Agreements.</p>

    <Panel open={!!detail} onOpenChange={o=>{if(!o)setDetailFor(null);}} title={detail?.person??'Debt'} description={detail?`${detail.currency} · Owed since ${formatDate(detail.date)}`:undefined}>
      {detail&&(()=>{const left=debtRemaining(detail),paid=(BigInt(detail.amountMinor)-BigInt(left)).toString(),settled=left==='0';return <div className="ledger-detail" id={`debt-${detail.id}`}>
        <dl className="debt-amounts ledger-amounts"><div><dt>Left</dt><dd>{money(left,detail.currency)}</dd></div><div><dt>Borrowed</dt><dd>{money(detail.amountMinor,detail.currency)}</dd></div><div><dt>Paid back</dt><dd>{money(paid,detail.currency)}</dd></div></dl>
        {!!detail.witnesses?.length&&<p className="debt-witnessed"><UsersRound size={14} aria-hidden/>Witnessed by {listNames(detail.witnesses)}</p>}
        {detail.note&&<p className="debt-note">{detail.note}</p>}
        <ReminderOnCard debt={detail} demo={demo} now={now} onEdit={()=>{setDetailFor(null);setReminderFor(detail.id);}}/>
        {detail.payments.length>0&&<details className="debt-history"><DisclosureSummary>{detail.payments.length} {detail.payments.length===1?'payment':'payments'} recorded</DisclosureSummary>{detail.payments.map(payment=><div className="debt-payment" key={payment.id}><span>{formatDate(payment.date)}{payment.note&&<small>{payment.note}</small>}</span><strong>{money(payment.amountMinor,detail.currency)}</strong></div>)}</details>}
        {detail.installments&&<details className="debt-plan-details"><DisclosureSummary>Repayment plan</DisclosureSummary><PrivateDebtSchedule plan={detail.installments} currency={detail.currency} paidMinor={paid}/></details>}
        {detail.dueDate&&<p className="quiet-note">Repay by {formatDate(detail.dueDate)}</p>}
        <div className="ledger-detail-actions">
          {!settled&&<button type="button" className="button button-primary sign-primary" onClick={()=>{setDetailFor(null);openPayment(detail);}} aria-label={`Record a payment to ${detail.person}`}>Record a payment</button>}
          <div className="ledger-detail-row">{!settled&&<button type="button" className="button sign-secondary" onClick={()=>{setDetailFor(null);setReminderFor(detail.id);}} aria-label={`${detail.reminder?'Change':'Add'} reminder for ${detail.person}`}><Bell size={16} aria-hidden/>{detail.reminder?'Reminder':'Remind me'}</button>}<button type="button" className="button sign-secondary" onClick={()=>{setDetailFor(null);openEdit(detail);}} aria-label={`Edit debt for ${detail.person}`}><Pencil size={16} aria-hidden/>Edit</button></div>
        </div>
      </div>;})()}
    </Panel>

    {reminderDebt&&<DebtReminderForm key={reminderDebt.id} debt={reminderDebt} demo={demo} emailAvailable={emailAvailable} onClose={()=>setReminderFor(null)} onSave={debt=>{setDebts(current=>current.map(d=>d.id===debt.id?debt:d));setReminderFor(null);setSuccess(debt.reminder?'Reminder saved. Add it to your calendar for an alert while treeti is closed.':'Reminder removed from treeti. If you added a calendar event, remove it in your calendar too.');}}/>}
  </div>;
}
function listNames(names:string[]){return names.length<2?names.join(''):`${names.slice(0,-1).join(', ')} and ${names.at(-1)}`;}

const shortDay=(date:string)=>new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
const daysTo=(from:string,to:string)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
const shortDue=(date:string)=>formatDate(date).replace(/ \d{4}$/,'');
function whenText(date:string,today:string){const d=daysTo(today,date);if(d<0)return `overdue since ${shortDue(date)}`;if(d===0)return 'today';if(d===1)return 'tomorrow';if(d<7)return `on ${shortDay(date)}`;if(d<=31)return `in ${d} days`;return `on ${shortDue(date)}`;}
/** The next unpaid part of a plan, after payments so far. */
function nextPart(debt:PersonalDebt){if(!debt.installments)return null;const paid=BigInt(debt.amountMinor)-BigInt(debtRemaining(debt));const parts=allocateInstallments(debt.installments.payments,paid.toString());return parts.find(p=>p.remainingMinor!=='0')?.remainingMinor??null;}
function nextDue(debt:PersonalDebt){if(debt.installments){const paid=BigInt(debt.amountMinor)-BigInt(debtRemaining(debt));const part=allocateInstallments(debt.installments.payments,paid.toString()).find(p=>p.remainingMinor!=='0');return part?{dueDate:part.dueDate,amountMinor:part.remainingMinor}:null;}return debt.dueDate?{dueDate:debt.dueDate,amountMinor:debtRemaining(debt)}:null;}
function nextPayment(debts:PersonalDebt[],today:string){const list=debts.map(d=>({d,n:nextDue(d)})).filter(x=>x.n).sort((a,b)=>a.n!.dueDate.localeCompare(b.n!.dueDate));const first=list[0];void today;return first?{person:first.d.person,currency:first.d.currency,...first.n!}:null;}
function progressOf(debt:PersonalDebt){const total=BigInt(debt.amountMinor),left=BigInt(debtRemaining(debt));return total>0n?Number(total-left)/Number(total):0;}
function countLabel(debt:PersonalDebt){const left=debtRemaining(debt),paid=BigInt(debt.amountMinor)-BigInt(left);if(left==='0')return 'Paid back';if(debt.installments){const parts=allocateInstallments(debt.installments.payments,paid.toString());return `${parts.filter(p=>p.remainingMinor==='0').length} of ${parts.length} paid`;}return paid>0n?`${money(paid.toString(),debt.currency)} repaid`:'Nothing repaid yet';}
function nextLabel(debt:PersonalDebt,today:string){const n=nextDue(debt);if(!n)return countLabel(debt);const w=whenText(n.dueDate,today).replace(/^on /,'');const overdue=w.startsWith('overdue');return debt.installments?`Next ${money(n.amountMinor,debt.currency)} · ${w}`:overdue?`O${w.slice(1)}`:`Due ${w}`;}
function DebtRow({debt,today,now,onOpen}:{debt:PersonalDebt;today:string;now:number;onOpen:()=>void}){
  const left=debtRemaining(debt),settled=left==='0',n=nextDue(debt),count=countLabel(debt);
  const nextText=settled?`Borrowed ${money(debt.amountMinor,debt.currency)}`:n?`${debt.installments?'next':'due'} ${whenText(n.dueDate,today).replace(/^on /,'')}`:'';
  const reminderDue=debt.reminder&&Date.parse(debt.reminder.remindAt)<=now;
  return <article className={`ledger-row${settled?' settled':''}`} aria-label={debt.person}>
    <button type="button" className="agreement-row ledger-row-button" onClick={onOpen} aria-haspopup="dialog">
      <span className="agreement-row-avatar"><RingAvatar name={debt.person} fraction={progressOf(debt)}/></span>
      <span className="agreement-row-person"><span className="agreement-row-name">{debt.person}</span></span>
      <span className="agreement-row-progress"><span className="agreement-row-meta"><span className={settled?'kit-count':count.startsWith('Nothing')?'kit-count-quiet':'kit-count'}>{count}</span>{nextText&&<span> · {nextText}</span>}</span>
        {debt.reminder&&!settled&&<span className={`ledger-reminder${reminderDue?' due':''}`}><Bell size={12} aria-hidden/>{reminderDue?'Reminder now':`Reminder ${shortReminder(debt.reminder.remindAt,debt.reminder.timeZone)}`}</span>}</span>
      <span className={`agreement-row-left${longAmount(money(settled?debt.amountMinor:left,debt.currency))?' long':''}`}><span className="agreement-row-amount"><Amount text={money(settled?debt.amountMinor:left,debt.currency)} currency={debt.currency}/></span><span className="agreement-row-caption">{settled?'paid back':'left'}</span></span>
    </button>
  </article>;
}
function shortReminder(iso:string,timeZone:string){return new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)).replace(',','');}

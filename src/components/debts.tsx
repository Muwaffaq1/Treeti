'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,CheckCircle2,LockKeyhole,Plus,Pencil,WalletCards,UserRound,NotebookPen,UsersRound,X} from '@/components/icons';
import {money} from '@/lib/money';
import {allocateInstallments} from '@/modules/agreements/repayment-plan';
import {Avatar,Amount,Panel,RingAvatar} from './kit';
import {installmentPlanSchema} from '@/lib/installment-schema';
import {calendarDate} from '@/lib/calendar';
import {parseMoney,moneyInput,groupMoneyInput} from '@/lib/money';
import {formatMoneyChange} from './money-input';
import {debtCurrencies,debtWitnessLimit,debtRemaining,debtTotals,type PersonalDebt} from '@/modules/debts/model';
import {api,apiBase} from './client-api';
import {formatDate} from './agreement-utils';
import {Button,DisclosureSummary,ErrorMessage,Field,Modal} from './ui';
import {PrivateDebtSchedule} from './repayment-schedule';
import {DebtPlanFields,debtPlanDraft,buildDebtPlan} from './debt-plan-fields';
import {DebtReminderForm,ReminderOnCard} from './debt-reminder';

export function DebtTracker({initial,demo,emailAvailable=false}:{initial:PersonalDebt[];demo:boolean;emailAvailable?:boolean}){
  const [debts,setDebts]=useState(initial),[showForm,setShowForm]=useState(false),[person,setPerson]=useState(''),[currency,setCurrency]=useState('NGN'),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate()),[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(''),[paymentFor,setPaymentFor]=useState<string|null>(null),[paymentAmount,setPaymentAmount]=useState(''),[paymentDate,setPaymentDate]=useState(calendarDate()),[paymentNote,setPaymentNote]=useState('');
  const [editing,setEditing]=useState<PersonalDebt|null>(null),[plan,setPlan]=useState(()=>debtPlanDraft()),[witnesses,setWitnesses]=useState<string[]>([]),[addedWitness,setAddedWitness]=useState(false);
  const lastRequest=useRef<{body:string;key:string}|null>(null),paymentDebt=debts.find(d=>d.id===paymentFor),totals=debtTotals(debts);
  const [reminderFor,setReminderFor]=useState<string|null>(null),[now,setNow]=useState(0),reminderDebt=debts.find(d=>d.id===reminderFor),dueReminders=debts.filter(d=>d.reminder&&Date.parse(d.reminder.remindAt)<=now&&debtRemaining(d)!=='0');
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000),first=setTimeout(()=>setNow(Date.now()),0);return ()=>{clearInterval(timer);clearTimeout(first);};},[]);
  function requestKey(body:unknown){const text=JSON.stringify(body);if(lastRequest.current?.body!==text)lastRequest.current={body:text,key:crypto.randomUUID()};return lastRequest.current!.key;}
  function openDebt(){setEditing(null);setPlan(debtPlanDraft());setWitnesses([]);setAddedWitness(false);setPerson('');setAmount('');setNote('');setDate(calendarDate());setCurrency('NGN');setError('');setShowForm(true);lastRequest.current=null;}
  // "New" → "A debt" lands here with ?new=1: open the form once, then tidy the address.
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('new')!=='1')return;window.history.replaceState(null,'',window.location.pathname);openDebt();
   
  },[]);
  function openEdit(debt:PersonalDebt){setEditing(debt);setPerson(debt.person);setCurrency(debt.currency);setAmount(groupMoneyInput(moneyInput(debt.amountMinor)));setDate(debt.date);setNote(debt.note);setWitnesses(debt.witnesses??[]);setAddedWitness(false);setPlan(debtPlanDraft(debt));setError('');setShowForm(true);lastRequest.current=null;}
  async function reloadEdit(){try{const {debts:latest}=await api<{debts:PersonalDebt[]}>(`${apiBase(demo)}/debts`);setDebts(latest);const debt=latest.find(d=>d.id===editing?.id);if(debt)openEdit(debt);}catch(e){setError((e as Error).message);}}
  function openPayment(debt:PersonalDebt){setPaymentFor(debt.id);setPaymentAmount('');setPaymentNote('');setPaymentDate(calendarDate());setError('');lastRequest.current=null;}
  async function addDebt(){if(busy)return;setBusy(true);setError('');try{
    const body={person,currency,amountMinor:parseMoney(amount),date,note,witnesses:witnesses.map(w=>w.trim()).filter(Boolean),...buildDebtPlan(plan,amount),...(editing?{expectedRevision:editing.revision??0}:{})};
    const {debt}=await api<{debt:PersonalDebt}>(`${apiBase(demo)}/debts${editing?`/${editing.id}/edit`:""}`,body,requestKey({id:editing?.id,...body}));
    setDebts(current=>editing?current.map(d=>d.id===debt.id?debt:d):[debt,...current]);setShowForm(false);setSuccess(editing?`Your record for ${debt.person} is updated. Recorded payments are unchanged.`:`Your private record for ${debt.person} is saved.`);lastRequest.current=null;
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function addPayment(){if(!paymentDebt||busy)return;setBusy(true);setError('');try{
    const body={amountMinor:parseMoney(paymentAmount),date:paymentDate,note:paymentNote};
    const {debt}=await api<{debt:PersonalDebt}>(`${apiBase(demo)}/debts/${paymentDebt.id}/payments`,body,requestKey({id:paymentDebt.id,...body}));
    setDebts(current=>current.map(d=>d.id===debt.id?debt:d));setPaymentFor(null);setSuccess(debtRemaining(debt)==='0'?`Your record for ${debt.person} is paid back in full.${paymentDebt.reminder?' Your treeti reminder was removed. If you added a calendar event, remove it in your calendar too.':''}`:`Payment saved. ${money(debtRemaining(debt),debt.currency)} remains for ${debt.person}.`);lastRequest.current=null;
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  let previewPlan;try{const result=installmentPlanSchema.safeParse(buildDebtPlan(plan,amount).installments);if(result.success)previewPlan=result.data;}catch{}
  const outstanding=debts.filter(d=>debtRemaining(d)!=='0'),paidBack=debts.filter(d=>debtRemaining(d)==='0');
  const [detailFor,setDetailFor]=useState<string|null>(null),detail=debts.find(d=>d.id===detailFor);
  const today=calendarDate(),next=nextPayment(outstanding,today),main=totals.find(t=>t.currency==='NGN')??totals[0],others=totals.filter(t=>t!==main&&t.amountMinor!=='0');
  const people=new Set(outstanding.map(d=>d.person.trim().toLowerCase())).size;
  return <div className="ledger">
    <header className="ledger-head">
      <h1>My debts</h1>
      <p className="ledger-private"><LockKeyhole size={14} aria-hidden/>Only you can see these</p>
      {debts.length>0&&<section className="ledger-total" aria-label="Outstanding totals by currency">
        <p className="ledger-amount">{main&&<Amount text={money(main.amountMinor,main.currency)} currency={main.currency}/>}</p>
        {others.length>0&&<p className="ledger-others">{others.map(t=>money(t.amountMinor,t.currency)).join(' + ')}</p>}
        <p className="ledger-caption">{outstanding.length?`left to repay, across ${people===1?'1 person':`${people} people`}`:'Everything is paid back'}</p>
      </section>}
      {next&&<p className="ledger-next">Your next payment is <strong>{money(next.amountMinor,next.currency)}</strong> to <span className="ledger-name">{next.person}</span> <strong>{whenText(next.dueDate,today)}</strong>.</p>}
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

    <Panel open={!!paymentDebt} onOpenChange={value=>{if(!busy&&!value){setPaymentFor(null);setError('');}}} title="Record a payment" description="Just for your records. They aren’t told.">
      {paymentDebt&&(()=>{const left=debtRemaining(paymentDebt);let after:string|null=null;try{const rest=BigInt(left)-BigInt(parseMoney(paymentAmount));after=rest<0n?null:rest===0n?'Paid back in full':`${money(rest.toString(),paymentDebt.currency)} left`;}catch{}
        return <form className="ask-form ledger-pay" onSubmit={e=>{e.preventDefault();void addPayment();}}>
          <p className="ledger-sentence">I paid <span className={paymentAmount?'kit-blank kit-blank-filled':'kit-blank'}>{paymentAmount?`${paymentDebt.currency==='NGN'?'₦':paymentDebt.currency+' '}${paymentAmount}`:'how much'}</span> to <span className="kit-blank kit-blank-filled">{paymentDebt.person}</span> on <span className="kit-blank kit-blank-filled">{paymentDate===calendarDate()?'today':formatDate(paymentDate)}</span>.</p>
          {outstanding.length>1&&<fieldset className="ledger-picker"><legend className="create-field-label">Who did you pay?</legend>{outstanding.map(d=><label key={d.id} className="ledger-option"><input type="radio" name="pay-to" checked={d.id===paymentDebt.id} onChange={()=>{setPaymentFor(d.id);setPaymentAmount('');}}/><Avatar name={d.person} size={32}/><span><strong>{d.person}</strong><small>{nextLabel(d,today)}</small></span><span className="ledger-option-left">{money(debtRemaining(d),d.currency)}<small>left</small></span></label>)}</fieldset>}
          <label className="create-field"><span className="create-field-label">{`Amount paid (${paymentDebt.currency})`}</span><input value={paymentAmount} onChange={e=>{formatMoneyChange(e);setPaymentAmount(e.target.value);}} required inputMode="decimal" placeholder="5,000" maxLength={20}/></label>
          <div className="kit-chips" role="group" aria-label="Quick amounts"><button type="button" className="kit-chip" aria-pressed={paymentAmount===groupMoneyInput(moneyInput(left))} onClick={()=>setPaymentAmount(groupMoneyInput(moneyInput(left)))}>All {money(left,paymentDebt.currency)}</button>{nextPart(paymentDebt)&&<button type="button" className="kit-chip" aria-pressed={paymentAmount===groupMoneyInput(moneyInput(nextPart(paymentDebt)!))} onClick={()=>setPaymentAmount(groupMoneyInput(moneyInput(nextPart(paymentDebt)!)))}>Next part {money(nextPart(paymentDebt)!,paymentDebt.currency)}</button>}</div>
          <label className="create-field"><span className="create-field-label">Payment date</span><input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} required min={paymentDebt.date} max={calendarDate()}/></label>
          <details className="ledger-note-field"><DisclosureSummary>Add a note</DisclosureSummary><label className="create-field"><span className="sr-only">Note (optional)</span><textarea className="ask-text" value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} placeholder="Bank transfer reference" maxLength={2000} rows={2}/></label></details>
          {after&&<p className="ledger-after">Afterwards: <strong>{after}</strong></p>}
          <ErrorMessage message={error}/>
          <button type="submit" className="button button-primary sign-primary" disabled={busy} aria-busy={busy}>Save payment</button>
        </form>;})()}
    </Panel>
    <Modal open={showForm} onOpenChange={value=>{if(!busy){setShowForm(value);setError('');}}} title={editing?"Edit private debt":"Add a private debt"} description={editing?"Correct your personal record. Recorded payments will stay unchanged.":"Record the original amount you owe. You can add earlier repayments afterwards."}>
      <form className="dialog-form" onSubmit={e=>{e.preventDefault();void addDebt();}}>
        <Field label="Who do you owe?" icon={UserRound}><input value={person} onChange={e=>setPerson(e.target.value)} placeholder="e.g. Maryam Bello" required minLength={2} maxLength={120} autoComplete="off"/></Field>
        <div className="form-grid"><Field label="Currency" hint={editing?.payments.length?"Currency is fixed because payments have been recorded.":undefined}><select disabled={!!editing?.payments.length} value={currency} onChange={e=>setCurrency(e.target.value)}>{debtCurrencies.map(item=><option key={item}>{item}</option>)}</select></Field><Field label="Original amount" hint="Up to two decimal places."><input value={amount} onChange={e=>{formatMoneyChange(e);setAmount(e.target.value);}} inputMode="decimal" placeholder="e.g. 50,000.00" required maxLength={20}/></Field></div>
        <Field label="Debt date" hint="When you first owed this amount."><input type="date" value={date} onChange={e=>setDate(e.target.value)} required max={calendarDate()}/></Field>
        <DebtPlanFields draft={plan} onChange={setPlan} amount={amount} date={date} currency={currency}/>
        {previewPlan&&<PrivateDebtSchedule plan={previewPlan} currency={currency} paidMinor={editing?(BigInt(editing.amountMinor)-BigInt(debtRemaining(editing))).toString():'0'}/>}
        <fieldset className="debt-witnesses"><legend>Witnesses (optional)</legend><p className="quiet-note">Names only, for your own record. Witnesses aren’t contacted.</p>
          {witnesses.map((witness,index)=><div className="debt-witness" key={index}><Field label={`Witness ${index+1}’s full name`} icon={UsersRound}><input value={witness} onChange={e=>setWitnesses(current=>current.map((w,i)=>i===index?e.target.value:w))} required minLength={2} maxLength={120} autoComplete="off" placeholder="e.g. Yusuf Ali" autoFocus={addedWitness&&index===witnesses.length-1}/></Field><Button type="button" variant="ghost" onClick={()=>setWitnesses(current=>current.filter((_,i)=>i!==index))} aria-label={`Remove witness ${index+1}`}><X size={16} aria-hidden/>Remove</Button></div>)}
          {witnesses.length<debtWitnessLimit&&<Button type="button" variant="secondary" onClick={()=>{setAddedWitness(true);setWitnesses(current=>[...current,'']);}}><Plus size={16} aria-hidden/>{witnesses.length?'Add another witness':'Add a witness'}</Button>}
        </fieldset>
        <Field label="Note (optional)" icon={NotebookPen}><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="A little context for your record" maxLength={2000} rows={3}/></Field>
        <ErrorMessage message={error}/>{editing&&error.includes("changed since")&&<Button type="button" variant="secondary" onClick={()=>void reloadEdit()}>Load latest record</Button>}<div className="dialog-actions"><Button type="button" variant="ghost" onClick={()=>setShowForm(false)} disabled={busy}>Cancel</Button><Button type="submit" busy={busy}>{editing?"Save changes":"Save private debt"}</Button></div>
      </form>
    </Modal>
    {reminderDebt&&<DebtReminderForm key={reminderDebt.id} debt={reminderDebt} demo={demo} emailAvailable={emailAvailable} onClose={()=>setReminderFor(null)} onSave={debt=>{setDebts(current=>current.map(d=>d.id===debt.id?debt:d));setReminderFor(null);setSuccess(debt.reminder?'Reminder saved. Add it to your calendar for an alert while treeti is closed.':'Reminder removed from treeti. If you added a calendar event, remove it in your calendar too.');}}/>}
  </div>;
}
function listNames(names:string[]){return names.length<2?names.join(''):`${names.slice(0,-1).join(', ')} and ${names.at(-1)}`;}

const shortDay=(date:string)=>new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
const daysTo=(from:string,to:string)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
function whenText(date:string,today:string){const d=daysTo(today,date);if(d<0)return `(was due ${formatDate(date).replace(/ \d{4}$/,'')})`;if(d===0)return 'today';if(d===1)return 'tomorrow';if(d<7)return `on ${shortDay(date)}`;if(d<=31)return `in ${d} days`;return `on ${formatDate(date).replace(/ \d{4}$/,'')}`;}
/** The next unpaid part of a plan, after payments so far. */
function nextPart(debt:PersonalDebt){if(!debt.installments)return null;const paid=BigInt(debt.amountMinor)-BigInt(debtRemaining(debt));const parts=allocateInstallments(debt.installments.payments,paid.toString());return parts.find(p=>p.remainingMinor!=='0')?.remainingMinor??null;}
function nextDue(debt:PersonalDebt){if(debt.installments){const paid=BigInt(debt.amountMinor)-BigInt(debtRemaining(debt));const part=allocateInstallments(debt.installments.payments,paid.toString()).find(p=>p.remainingMinor!=='0');return part?{dueDate:part.dueDate,amountMinor:part.remainingMinor}:null;}return debt.dueDate?{dueDate:debt.dueDate,amountMinor:debtRemaining(debt)}:null;}
function nextPayment(debts:PersonalDebt[],today:string){const list=debts.map(d=>({d,n:nextDue(d)})).filter(x=>x.n).sort((a,b)=>a.n!.dueDate.localeCompare(b.n!.dueDate));const first=list[0];void today;return first?{person:first.d.person,currency:first.d.currency,...first.n!}:null;}
function progressOf(debt:PersonalDebt){const total=BigInt(debt.amountMinor),left=BigInt(debtRemaining(debt));return total>0n?Number(total-left)/Number(total):0;}
function countLabel(debt:PersonalDebt){const left=debtRemaining(debt),paid=BigInt(debt.amountMinor)-BigInt(left);if(left==='0')return 'Paid back';if(debt.installments){const parts=allocateInstallments(debt.installments.payments,paid.toString());return `${parts.filter(p=>p.remainingMinor==='0').length} of ${parts.length} paid`;}return paid>0n?`${money(paid.toString(),debt.currency)} repaid`:'Nothing repaid yet';}
function nextLabel(debt:PersonalDebt,today:string){const n=nextDue(debt);if(!n)return countLabel(debt);const w=whenText(n.dueDate,today).replace(/^on /,'');return debt.installments?`Next ${money(n.amountMinor,debt.currency)} · ${w}`:`Due ${w}`;}
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
      <span className="agreement-row-left"><span className="agreement-row-amount"><Amount text={money(settled?debt.amountMinor:left,debt.currency)} currency={debt.currency}/></span><span className="agreement-row-caption">{settled?'paid back':'left'}</span></span>
    </button>
  </article>;
}
function shortReminder(iso:string,timeZone:string){return new Intl.DateTimeFormat('en-GB',{timeZone,weekday:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(iso)).replace(',','');}

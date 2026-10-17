'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,CheckCircle2,LockKeyhole,Plus,Pencil,WalletCards,UserRound,Banknote,NotebookPen,UsersRound,X} from 'lucide-react';
import {installmentPlanSchema} from '@/lib/installment-schema';
import {calendarDate} from '@/lib/calendar';
import {parseMoney,moneyInput,groupMoneyInput} from '@/lib/money';
import {formatMoneyChange} from './money-input';
import {debtCurrencies,debtWitnessLimit,debtMoney,debtRemaining,debtTotals,type PersonalDebt} from '@/modules/debts/model';
import {api,apiBase} from './client-api';
import {formatDate} from './agreement-utils';
import {Button,DisclosureSummary,ErrorMessage,Field,Modal} from './ui';
import {PrivateDebtSchedule} from './repayment-schedule';
import {DebtPlanFields,debtPlanDraft,buildDebtPlan} from './debt-plan-fields';
import {DebtReminderForm,ReminderOnCard} from './debt-reminder';

export function DebtTracker({initial,demo,emailAvailable=false}:{initial:PersonalDebt[];demo:boolean;emailAvailable?:boolean}){
  const [debts,setDebts]=useState(initial),[showForm,setShowForm]=useState(false),[person,setPerson]=useState(''),[currency,setCurrency]=useState('NGN'),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate()),[note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState(''),[filter,setFilter]=useState('All'),[paymentFor,setPaymentFor]=useState<string|null>(null),[paymentAmount,setPaymentAmount]=useState(''),[paymentDate,setPaymentDate]=useState(calendarDate()),[paymentNote,setPaymentNote]=useState('');
  const [editing,setEditing]=useState<PersonalDebt|null>(null),[plan,setPlan]=useState(()=>debtPlanDraft()),[witnesses,setWitnesses]=useState<string[]>([]),[addedWitness,setAddedWitness]=useState(false);
  const lastRequest=useRef<{body:string;key:string}|null>(null),paymentDebt=debts.find(d=>d.id===paymentFor),totals=debtTotals(debts),visible=debts.filter(d=>filter==='All'||(filter==='Outstanding'?debtRemaining(d)!=='0':debtRemaining(d)==='0'));
  const [reminderFor,setReminderFor]=useState<string|null>(null),[now,setNow]=useState(0),reminderDebt=debts.find(d=>d.id===reminderFor),dueReminders=debts.filter(d=>d.reminder&&Date.parse(d.reminder.remindAt)<=now&&debtRemaining(d)!=='0');
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000),first=setTimeout(()=>setNow(Date.now()),0);return ()=>{clearInterval(timer);clearTimeout(first);};},[]);
  function requestKey(body:unknown){const text=JSON.stringify(body);if(lastRequest.current?.body!==text)lastRequest.current={body:text,key:crypto.randomUUID()};return lastRequest.current!.key;}
  function openDebt(){setEditing(null);setPlan(debtPlanDraft());setWitnesses([]);setAddedWitness(false);setPerson('');setAmount('');setNote('');setDate(calendarDate());setCurrency('NGN');setError('');setShowForm(true);lastRequest.current=null;}
  function openEdit(debt:PersonalDebt){setEditing(debt);setPerson(debt.person);setCurrency(debt.currency);setAmount(groupMoneyInput(moneyInput(debt.amountMinor)));setDate(debt.date);setNote(debt.note);setWitnesses(debt.witnesses??[]);setAddedWitness(false);setPlan(debtPlanDraft(debt));setError('');setShowForm(true);lastRequest.current=null;}
  async function reloadEdit(){try{const {debts:latest}=await api<{debts:PersonalDebt[]}>(`${apiBase(demo)}/debts`);setDebts(latest);const debt=latest.find(d=>d.id===editing?.id);if(debt)openEdit(debt);}catch(e){setError((e as Error).message);}}
  function openPayment(debt:PersonalDebt){setPaymentFor(debt.id);setPaymentAmount('');setPaymentNote('');setPaymentDate(calendarDate());setError('');lastRequest.current=null;}
  async function addDebt(){if(busy)return;setBusy(true);setError('');try{
    const body={person,currency,amountMinor:parseMoney(amount),date,note,witnesses:witnesses.map(w=>w.trim()).filter(Boolean),...buildDebtPlan(plan,amount),...(editing?{expectedRevision:editing.revision??0}:{})};
    const {debt}=await api<{debt:PersonalDebt}>(`${apiBase(demo)}/debts${editing?`/${editing.id}/edit`:""}`,body,requestKey({id:editing?.id,...body}));
    setDebts(current=>editing?current.map(d=>d.id===debt.id?debt:d):[debt,...current]);setShowForm(false);setFilter('All');setSuccess(editing?`Your record for ${debt.person} is updated. Recorded payments are unchanged.`:`Your private record for ${debt.person} is saved.`);lastRequest.current=null;
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function addPayment(){if(!paymentDebt||busy)return;setBusy(true);setError('');try{
    const body={amountMinor:parseMoney(paymentAmount),date:paymentDate,note:paymentNote};
    const {debt}=await api<{debt:PersonalDebt}>(`${apiBase(demo)}/debts/${paymentDebt.id}/payments`,body,requestKey({id:paymentDebt.id,...body}));
    setDebts(current=>current.map(d=>d.id===debt.id?debt:d));setPaymentFor(null);setSuccess(debtRemaining(debt)==='0'?`Your record for ${debt.person} is paid back in full.${paymentDebt.reminder?' Your treeti reminder was removed. If you added a calendar event, remove it in your calendar too.':''}`:`Payment saved. ${debtMoney(debtRemaining(debt),debt.currency)} remains for ${debt.person}.`);lastRequest.current=null;
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  let previewPlan;try{const result=installmentPlanSchema.safeParse(buildDebtPlan(plan,amount).installments);if(result.success)previewPlan=result.data;}catch{}
  return <>
    <div className="page-heading"><div><h1>Debts I’m tracking.</h1><p className="lede">Keep track of money you owe, including loans agreed outside treeti.</p></div><Button onClick={openDebt}><Plus size={18}/>Add a debt</Button></div>
    <aside className="private-ledger-note" aria-label="Private debt records"><span className="private-ledger-icon" aria-hidden><LockKeyhole size={20}/></span><div><h2>Only visible to you</h2><p>Payments you record update your balance immediately. The people you name, including any witnesses, aren’t invited or asked to confirm.</p></div></aside>
    <div role="status">{success&&<div className="success-notice"><CheckCircle2 size={18}/>{success}<button onClick={()=>setSuccess('')}>Dismiss</button></div>}</div>
    {dueReminders.length>0&&<section className="reminder-list" aria-label="Reminders ready to review">{dueReminders.map(debt=><div key={debt.id}><Bell size={22} aria-hidden/><div><h2>Your reminder for {debt.person}</h2><p>Take a moment to review your repayment plans. {debtMoney(debtRemaining(debt),debt.currency)} remains in your record.</p><a href={`#debt-${debt.id}`} onClick={()=>setFilter('All')}>Review private record</a></div></div>)}</section>}
    {debts.length>0&&<section aria-label="Outstanding totals by currency" className="debt-summary">{totals.map(total=>{const count=debts.filter(d=>d.currency===total.currency&&debtRemaining(d)!=='0').length;return <div key={total.currency}><span>Outstanding · {total.currency}</span><strong>{debtMoney(total.amountMinor,total.currency)}</strong><small>{count} open {count===1?'record':'records'}</small></div>;})}</section>}
    {debts.length>0&&<div className="section-heading debt-toolbar"><h2>Private records <span className="count">{debts.length}</span></h2><div className="filter-tabs" aria-label="Filter private debts">{['All','Outstanding','Paid back'].map(f=><button key={f} aria-pressed={f===filter} className={f===filter?'active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>}
    {!debts.length&&<section className="empty-state"><span className="empty-icon"><WalletCards size={30}/></span><h3>A clear picture of what remains.</h3><p>Add a person, the amount and currency. Record each repayment to see what you’ve paid back and what’s left.</p><Button variant="secondary" onClick={openDebt}>Add your first debt <Plus size={16}/></Button></section>}
    {debts.length>0&&!visible.length&&<section className="panel inline-empty"><WalletCards size={25}/><p>{filter==='Paid back'?'No debts paid back in full yet.':'No outstanding debts in your private records.'}</p></section>}
    <div className="debt-grid">{visible.map(debt=>{const left=debtRemaining(debt),paid=(BigInt(debt.amountMinor)-BigInt(left)).toString(),settled=left==='0';return <article className={`panel debt-card${settled?' settled':''}`} key={debt.id} id={`debt-${debt.id}`}>
      <div className="debt-card-top"><div><p className="debt-record-meta">{debt.currency} · Debt date {formatDate(debt.date)}</p><h2>{debt.person}</h2>{!!debt.witnesses?.length&&<p className="debt-witnessed"><UsersRound size={14} aria-hidden/>Witnessed by {listNames(debt.witnesses)}</p>}</div><span className={`status-badge ${settled?'status-active':'status-awaiting_approval'}`}><span className="status-dot"/>{settled?'Paid back':'Outstanding'}</span></div>
      <div className="debt-amounts"><div><span>Remaining</span><strong>{debtMoney(left,debt.currency)}</strong></div><div><span>Original amount</span><strong>{debtMoney(debt.amountMinor,debt.currency)}</strong></div><div><span>Paid back</span><strong>{debtMoney(paid,debt.currency)}</strong></div></div>
      {debt.note&&(debt.note.length>180?<details className="debt-note-details"><DisclosureSummary>Read note</DisclosureSummary><p className="debt-note">{debt.note}</p></details>:<p className="debt-note">{debt.note}</p>)}
      {debt.payments.length>0&&<details className="debt-history"><DisclosureSummary>{debt.payments.length} {debt.payments.length===1?'payment':'payments'} recorded</DisclosureSummary>{debt.payments.map(payment=><div className="debt-payment" key={payment.id}><span>{formatDate(payment.date)}{payment.note&&<small>{payment.note}</small>}</span><strong>{debtMoney(payment.amountMinor,debt.currency)}</strong></div>)}</details>}
      {debt.installments&&<details className="debt-plan-details"><DisclosureSummary>View repayment plan</DisclosureSummary><PrivateDebtSchedule plan={debt.installments} currency={debt.currency} paidMinor={paid}/></details>}
      {debt.dueDate&&<p className="quiet-note">Repayment due {formatDate(debt.dueDate)}</p>}
      {debt.updatedAt&&<p className="quiet-note">Edited {formatDate(debt.updatedAt)}</p>}
      <ReminderOnCard debt={debt} demo={demo} now={now} onEdit={()=>setReminderFor(debt.id)}/>
      <div className="debt-card-actions">{!settled&&<><Button variant="secondary" onClick={()=>openPayment(debt)} aria-label={`Record a payment to ${debt.person}`}><Plus size={16}/>Record a payment</Button><Button variant="secondary" onClick={()=>setReminderFor(debt.id)} aria-label={`${debt.reminder?'Change':'Add'} reminder for ${debt.person}`}><Bell size={18} aria-hidden/>{debt.reminder?'Reminder':'Remind me'}</Button></>}<Button variant="ghost" onClick={()=>openEdit(debt)} aria-label={`Edit debt for ${debt.person}`}><Pencil size={16} aria-hidden/>Edit</Button></div>
    </article>;})}</div>
    <p className="quiet-note debt-footnote">These are your personal records. Shared agreements and their confirmations stay in Agreements.</p>
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
    <Modal open={!!paymentDebt} onOpenChange={value=>{if(!busy&&!value){setPaymentFor(null);setError('');}}} title={paymentDebt?`Record payment to ${paymentDebt.person}`:'Record a payment'} description="Record money you’ve already paid outside treeti. It reduces your private balance immediately.">
      {paymentDebt&&<form className="dialog-form" onSubmit={e=>{e.preventDefault();void addPayment();}}>
        <div className="confirmation-summary"><span>Remaining · {paymentDebt.currency}</span><strong>{debtMoney(debtRemaining(paymentDebt),paymentDebt.currency)}</strong></div>
        <Field label={`Amount paid (${paymentDebt.currency})`} icon={Banknote}><input value={paymentAmount} onChange={e=>{formatMoneyChange(e);setPaymentAmount(e.target.value);}} required inputMode="decimal" placeholder="e.g. 5,000.00" maxLength={20}/></Field>
        <Field label="Payment date"><input type="date" value={paymentDate} onChange={e=>setPaymentDate(e.target.value)} required min={paymentDebt.date} max={calendarDate()}/></Field>
        <Field label="Note (optional)"><textarea value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} placeholder="e.g. Bank transfer reference" maxLength={2000} rows={2}/></Field>
        <ErrorMessage message={error}/><div className="dialog-actions"><Button type="button" variant="ghost" disabled={busy} onClick={()=>setPaymentFor(null)}>Cancel</Button><Button type="submit" busy={busy}>Save payment</Button></div>
      </form>}
    </Modal>
    {reminderDebt&&<DebtReminderForm key={reminderDebt.id} debt={reminderDebt} demo={demo} emailAvailable={emailAvailable} onClose={()=>setReminderFor(null)} onSave={debt=>{setDebts(current=>current.map(d=>d.id===debt.id?debt:d));setReminderFor(null);setSuccess(debt.reminder?'Reminder saved. Add it to your calendar for an alert while treeti is closed.':'Reminder removed from treeti. If you added a calendar event, remove it in your calendar too.');}}/>}
  </>;
}
function listNames(names:string[]){return names.length<2?names.join(''):`${names.slice(0,-1).join(', ')} and ${names.at(-1)}`;}

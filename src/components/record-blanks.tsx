'use client';
// Private debts and investments are made AND changed as one sentence with blanks, like writing an agreement (owner, Nov 2026).
// Each blank opens a small panel; nothing is saved until the sentence reads right.
import * as Dialog from '@radix-ui/react-dialog';
import {Fragment,useEffect,useRef,useState,type ReactNode} from 'react';
import {calendarDate} from '@/lib/calendar';
import {currencies,currencyNames} from '@/lib/currencies';
import {groupMoneyInput,money,moneyInput,parseMoney} from '@/lib/money';
import {debtRemaining,debtWitnessLimit,type PersonalDebt} from '@/modules/debts/model';
import {investmentPartnerLimit,investmentTotal,type Investment,type InvestmentContribution,type InvestmentPartner} from '@/modules/investments/model';
import {api,apiBase} from './client-api';
import {formatDate} from './agreement-utils';
import {formatMoneyChange} from './money-input';
import {DebtPlanFields,buildDebtPlan,debtPlanDraft,type DebtPlanDraft} from './debt-plan-fields';
import {Avatar,Blank,Panel,longAmount,useKeyboardInset} from './kit';
import {ErrorMessage} from './ui';
import {X} from './icons';

type Sheet='amount'|'who'|'when'|'plan'|'witness'|'note'|'partners'|'currency'|null;
export const W=({children}:{children:ReactNode})=><span className="create-word">{children}</span>;
export const dateText=(d:string)=>d===calendarDate()?'today':formatDate(d);
export const amountText=(amount:string,currency:string)=>{try{return money(parseMoney(amount),currency);}catch{return '';}};
const currencyLabel=(c:string)=>c==='NGN'?'₦ Naira':`${c} · ${currencyNames[c as keyof typeof currencyNames]}`;
export const amountError='Enter an amount greater than zero, with up to two decimal places.';
const toInput=(minor:string)=>groupMoneyInput(moneyInput(minor));

/** These flows open from a plain button, not a Radix trigger, so remember it and hand focus back on close. */
function useReturnFocus(){const to=useRef<HTMLElement|null>(null);return {onOpenAutoFocus:()=>{to.current=document.activeElement as HTMLElement|null;},onCloseAutoFocus:(e:Event)=>{e.preventDefault();to.current?.focus();}};}
function useKey(){const last=useRef<{body:string;key:string}|null>(null);return (body:unknown)=>{const text=JSON.stringify(body);if(last.current?.body!==text)last.current={body:text,key:crypto.randomUUID()};return last.current.key;};}

/** The full-screen frame every record sentence shares. */
export function Flow({open,onOpenChange,kicker,title,sub,children,panels}:{open:boolean;onOpenChange:(o:boolean)=>void;kicker:string;title:string;sub:string;children:ReactNode;panels:ReactNode}){
  const returnFocus=useReturnFocus();
  useKeyboardInset(open);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Content className="sign-flow create-flow record-flow" aria-describedby={undefined} {...returnFocus}>
    <header className="sign-bar"><Dialog.Close className="detail-icon-button" aria-label="Close"><X size={18} aria-hidden/></Dialog.Close><p className="sign-kicker">{kicker}</p><span/></header>
    <div className="sign-body"><div className="sign-heading"><Dialog.Title className="sign-title">{title}</Dialog.Title><p>{sub}</p></div>{children}</div>
    {panels}
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
function CurrencyPill({value,onChange,locked}:{value:string;onChange:(c:string)=>void;locked?:string}){
  return <><label className="create-currency"><span className="sr-only">Currency</span><span className="create-currency-face" aria-hidden>{currencyLabel(value)}</span><select aria-label="Currency" value={value} disabled={!!locked} onChange={e=>onChange(e.target.value)}>{currencies.map(c=><option key={c} value={c}>{currencyLabel(c)}</option>)}</select></label>{locked&&<p className="record-hint">{locked}</p>}</>;
}
export function AmountInput({label,value,onChange,currency}:{label:string;value:string;onChange:(v:string)=>void;currency:string}){
  return <label className="create-amount-row"><span className="create-amount-sign" aria-hidden>{currency==='NGN'?'₦':currency}</span><input aria-label={label} value={value} onChange={e=>{formatMoneyChange(e);onChange(e.target.value);}} inputMode="decimal" placeholder="0" maxLength={20} autoComplete="off"/></label>;
}
export function DatePanel({open,onOpenChange,title,description,label,value,onChange,min,future=false}:{open:boolean;onOpenChange:(o:boolean)=>void;title:string;description?:string;label:string;value:string;onChange:(v:string)=>void;min?:string;future?:boolean}){
  const [error,setError]=useState('');
  return <Panel open={open} onOpenChange={onOpenChange} title={title} description={description}>
    <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(!value||(future?value<calendarDate():value>calendarDate())){setError(future?'Choose today or a later date.':'Choose a date on or before today.');return;}if(min&&value<min){setError(`Choose a date on or after ${formatDate(min)}.`);return;}setError('');onOpenChange(false);}}>
      <label className="create-field"><span className="create-field-label">{label}</span><input type="date" value={value} min={future?calendarDate():min} max={future?undefined:calendarDate()} onChange={e=>onChange(e.target.value)}/></label>
      <ErrorMessage message={error}/>
      <button type="submit" className="button button-primary sign-primary">Done</button>
    </form>
  </Panel>;
}
/** A few words in a panel: an optional note by default, or a required reason when `required` is set. */
export function NotePanel({open,onOpenChange,id,value,onChange,placeholder,title='Add a note',description='A little context, just for you.',label='Note (optional)',required=false}:{open:boolean;onOpenChange:(o:boolean)=>void;id:string;value:string;onChange:(v:string)=>void;placeholder:string;title?:string;description?:string;label?:string;required?:boolean}){
  const [error,setError]=useState('');
  return <Panel open={open} onOpenChange={onOpenChange} title={title} description={description}>
    <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(required&&!value.trim()){setError('Add a few words first.');return;}setError('');onOpenChange(false);}}>
      <label className="sr-only" htmlFor={id}>{label}</label>
      <textarea id={id} className="ask-text" rows={4} maxLength={2000} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>
      <ErrorMessage message={error}/>
      <button type="submit" className="button button-primary sign-primary">Done</button>
    </form>
  </Panel>;
}
const noteLink=(note:string,open:()=>void)=><button type="button" className="kit-link detail-link-button" onClick={open}>{note.trim()?'Edit your note':'+ Add a note (optional)'}</button>;
/** Shown under an error when someone else's tab changed the record first. */
const reloadButton=(error:string,reload?:()=>void)=>reload&&error.includes('changed since')?<button type="button" className="button button-secondary sign-secondary" onClick={reload}>Load latest record</button>:null;

/** "I owe ₦50,000 to Maryam since 1 Oct. I’ll repay it by 3 Feb." Pass `debt` to change an existing record. */
export function DebtBlanks({open,onOpenChange,demo,debt,onSaved,onReload}:{open:boolean;onOpenChange:(o:boolean)=>void;demo:boolean;debt?:PersonalDebt|null;onSaved:(d:PersonalDebt)=>void;onReload?:()=>Promise<PersonalDebt|undefined>}){
  const [sheet,setSheet]=useState<Sheet>(null),[person,setPerson]=useState(''),[currency,setCurrency]=useState('NGN'),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate());
  const [plan,setPlan]=useState<DebtPlanDraft>(()=>debtPlanDraft()),[witnesses,setWitnesses]=useState<string[]>([]),[witness,setWitness]=useState(''),[note,setNote]=useState('');
  const [done,setDone]=useState({amount:false,who:false,plan:false}),[error,setError]=useState(''),[panelError,setPanelError]=useState(''),[busy,setBusy]=useState(false),key=useKey();
  const [base,setBase]=useState<PersonalDebt|null>(null);
  function load(d?:PersonalDebt|null){setBase(d??null);setSheet(null);setPerson(d?.person??'');setCurrency(d?.currency??'NGN');setAmount(d?toInput(d.amountMinor):'');setDate(d?.date??calendarDate());setPlan(debtPlanDraft(d??undefined));setWitnesses(d?.witnesses??[]);setNote(d?.note??'');setDone({amount:!!d,who:!!d,plan:!!d});setError('');}
  useEffect(()=>{if(open)load(debt);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- start fresh only when the flow opens
  },[open]);
  const editing=!!base,ready=done.amount&&done.who,focus=sheet??(!done.amount?'amount':!done.who?'who':null);
  let planText='how';try{const p=buildDebtPlan(plan,amount);planText=p.installments?`in ${p.installments.payments.length} parts from ${formatDate(p.installments.payments[0].dueDate)}`:p.dueDate?`by ${formatDate(p.dueDate)}`:'when I can';}catch{}
  async function save(){if(busy)return;setBusy(true);setError('');try{
    const body={person,currency,amountMinor:parseMoney(amount),date,note,witnesses:witnesses.map(w=>w.trim()).filter(Boolean),...buildDebtPlan(plan,amount),...(base?{expectedRevision:base.revision??0}:{})};
    const {debt:saved}=await api<{debt:PersonalDebt}>(`${apiBase(demo)}/debts${base?`/${base.id}/edit`:''}`,body,key({id:base?.id,...body}));onSaved(saved);onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const title=editing?'Change your record':ready?'Read it back':'Write it down';
  const sub=editing?'Tap anything to change it. Payments you’ve recorded stay as they are.':ready?'Tap anything to change it. Only you can see this.':'Tap each blank. Only you can see this.';
  return <Flow open={open} onOpenChange={onOpenChange} kicker={editing?'Edit debt':'New debt'} title={title} sub={sub} panels={<>
    <Panel open={sheet==='amount'} onOpenChange={o=>setSheet(o?'amount':null)} title="How much do you owe?" description={editing?'The amount you first owed. It can’t be less than what you’ve paid back.':'The amount you first owed. Add earlier repayments after saving.'}>
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();try{parseMoney(amount);}catch{setPanelError(amountError);return;}setPanelError('');setDone(d=>({...d,amount:true}));setSheet(done.who?null:'who');}}>
        <CurrencyPill value={currency} onChange={setCurrency} locked={base?.payments.length?'Currency is fixed because payments have been recorded.':undefined}/>
        <AmountInput label="Original amount" value={amount} onChange={setAmount} currency={currency}/>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">{done.who?'Done':'Next: who'}</button>
      </form>
    </Panel>
    <Panel open={sheet==='who'} onOpenChange={o=>setSheet(o?'who':null)} title="Who do you owe?" description="Just a name for your record. They aren’t contacted.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(person.trim().length<2){setPanelError('Add the person you owe.');return;}setPanelError('');setDone(d=>({...d,who:true}));setSheet(null);}}>
        <label className="create-field"><span className="create-field-label" aria-hidden>Full name</span><span className="sr-only">Who do you owe?</span><input value={person} onChange={e=>setPerson(e.target.value)} maxLength={120} autoComplete="off" placeholder="Maryam Bello"/></label>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <DatePanel open={sheet==='when'} onOpenChange={o=>setSheet(o?'when':null)} title="Since when?" description="When you first owed this amount." label="Debt date" value={date} onChange={setDate}/>
    <Panel open={sheet==='plan'} onOpenChange={o=>setSheet(o?'plan':null)} title="How will you repay?" description="Optional. You can change it later.">
      <form className="ask-form record-plan" noValidate onSubmit={e=>{e.preventDefault();try{buildDebtPlan(plan,amount);setPanelError('');setDone(d=>({...d,plan:true}));setSheet(null);}catch(err){setPanelError((err as Error).message);}}}>
        <DebtPlanFields draft={plan} onChange={setPlan} amount={amount} date={date} currency={currency}/>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='witness'} onOpenChange={o=>setSheet(o?'witness':null)} title="Who witnessed it?" description="Names only, for your record. Witnesses aren’t contacted.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(witness.trim().length<2){setPanelError('Add the witness’s full name.');return;}setWitnesses(list=>[...list,witness.trim()]);setSheet(null);}}>
        <label className="create-field"><span className="create-field-label" aria-hidden>Full name</span><span className="sr-only">Witness’s full name</span><input value={witness} onChange={e=>setWitness(e.target.value)} maxLength={120} autoComplete="off" placeholder="Yusuf Ali"/></label>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Add witness</button>
      </form>
    </Panel>
    <NotePanel open={sheet==='note'} onOpenChange={o=>setSheet(o?'note':null)} id="debt-note" value={note} onChange={setNote} placeholder="Borrowed for the shop’s new freezer"/>
  </>}>
    <p className="create-sentence">
      <W>I owe</W> <Blank state={focus==='amount'?'current':done.amount?'filled':'empty'} label={done.amount?`Amount: ${amountText(amount,currency)}. Change`:'Choose how much you owe'} onClick={()=>setSheet('amount')}>{done.amount?amountText(amount,currency):'how much'}</Blank>{' '}
      <W>to</W> <Blank state={focus==='who'?'current':done.who?'filled':'empty'} label={done.who?`Person: ${person}. Change`:'Choose who you owe'} onClick={()=>setSheet('who')}>{done.who?person:'who'}</Blank>{' '}
      <W>since</W> <span className="create-nowrap"><Blank state={sheet==='when'?'current':'filled'} label={`Since ${dateText(date)}. Change`} onClick={()=>setSheet('when')}>{dateText(date)}</Blank><W>.</W></span>{' '}
      <W>I’ll repay</W> <span className="create-nowrap"><Blank state={sheet==='plan'?'current':done.plan?'filled':'empty'} label={`Repayment: ${planText}. Change`} onClick={()=>setSheet('plan')}>{done.plan?planText:'how'}</Blank><W>.</W></span>
      {witnesses.length>0&&<>{' '}<span className="create-witnessed">Witnessed by</span> {witnesses.map((w,i)=><Fragment key={i}>{i>0&&<W> and </W>}<span className="create-nowrap"><Blank state="filled" label={`Witness: ${w}. Remove`} onClick={()=>setWitnesses(list=>list.filter((_,k)=>k!==i))}><bdi>{w}</bdi></Blank>{i===witnesses.length-1&&<W>.</W>}</span></Fragment>)}</>}
    </p>
    <div className="create-links">
      {witnesses.length<debtWitnessLimit&&<button type="button" className="kit-link detail-link-button" onClick={()=>{setWitness('');setPanelError('');setSheet('witness');}}>{witnesses.length?'+ Add another witness':'+ Add witnesses (optional)'}</button>}
      {noteLink(note,()=>setSheet('note'))}
    </div>
    <ErrorMessage message={error}/>{reloadButton(error,onReload&&(async()=>{const latest=await onReload();if(latest)load(latest);}))}
    <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={!ready||busy} aria-busy={busy} onClick={()=>void save()}>{editing?'Save changes':'Save private debt'}</button><p className="sign-note">{!ready?'Fill the blanks to continue':editing?'Recorded payments stay unchanged.':'Witnesses aren’t contacted. The person you owe isn’t told.'}</p></div>
  </Flow>;
}

/** "I paid ₦5,000 to Maryam on today." */
export function PaymentBlanks({open,onOpenChange,demo,debts,startId,nextPartOf,labelOf,onSaved}:{open:boolean;onOpenChange:(o:boolean)=>void;demo:boolean;debts:PersonalDebt[];startId:string|null;nextPartOf:(d:PersonalDebt)=>string|null;labelOf:(d:PersonalDebt)=>string;onSaved:(after:PersonalDebt,before:PersonalDebt)=>void}){
  const [sheet,setSheet]=useState<Sheet>(null),[id,setId]=useState<string|null>(null),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate()),[note,setNote]=useState('');
  const [done,setDone]=useState(false),[error,setError]=useState(''),[panelError,setPanelError]=useState(''),[busy,setBusy]=useState(false),key=useKey();
  useEffect(()=>{if(open){setId(startId);setSheet(null);setAmount('');setDate(calendarDate());setNote('');setDone(false);setError('');}
  // eslint-disable-next-line react-hooks/exhaustive-deps -- start fresh only when the flow opens
  },[open]);
  const debt=debts.find(d=>d.id===id)??debts[0];
  if(!debt)return null;
  const left=debtRemaining(debt),next=nextPartOf(debt);let after:string|null=null;try{const rest=BigInt(left)-BigInt(parseMoney(amount));after=rest<0n?null:rest===0n?'Paid back in full':`${money(rest.toString(),debt.currency)} left`;}catch{}
  function checkAmount(){try{if(BigInt(parseMoney(amount))>BigInt(left)){setPanelError(`That’s more than the ${money(left,debt.currency)} left to repay.`);return false;}}catch{setPanelError(amountError);return false;}setPanelError('');return true;}
  async function save(){if(busy)return;if(!checkAmount()){setSheet('amount');return;}setBusy(true);setError('');try{
    const body={amountMinor:parseMoney(amount),date,note};
    const {debt:saved}=await api<{debt:PersonalDebt}>(`${apiBase(demo)}/debts/${debt.id}/payments`,body,key({id:debt.id,...body}));onSaved(saved,debt);onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Flow open={open} onOpenChange={o=>{if(!busy)onOpenChange(o);}} kicker="Record a payment" title={done?'Read it back':'Write it down'} sub="Just for your records. They aren’t told." panels={<>
    <Panel open={sheet==='amount'} onOpenChange={o=>setSheet(o?'amount':null)} title="How much did you pay?" description={`${money(left,debt.currency)} is left to repay ${debt.person}.`}>
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(checkAmount()){setDone(true);setSheet(null);}}}>
        <AmountInput label={`Amount paid (${debt.currency})`} value={amount} onChange={setAmount} currency={debt.currency}/>
        <div className="kit-chips record-chips" role="group" aria-label="Quick amounts"><button type="button" className="kit-chip" aria-pressed={amount===toInput(left)} onClick={()=>setAmount(toInput(left))}>All {money(left,debt.currency)}</button>{next&&next!==left&&<button type="button" className="kit-chip" aria-pressed={amount===toInput(next)} onClick={()=>setAmount(toInput(next))}>Next part {money(next,debt.currency)}</button>}</div>
        {after&&<p className="ledger-after">Afterwards: <strong>{after}</strong></p>}
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='who'} onOpenChange={o=>setSheet(o?'who':null)} title="Who did you pay?">
      <form className="ask-form" onSubmit={e=>{e.preventDefault();setSheet(null);}}>
        <fieldset className="ledger-picker"><legend className="sr-only">Who did you pay?</legend>{debts.map(d=><label key={d.id} className="ledger-option"><input type="radio" name="pay-to" checked={d.id===debt.id} onChange={()=>{setId(d.id);setAmount('');setDone(false);}}/><Avatar name={d.person} size={32}/><span><strong>{d.person}</strong><small>{labelOf(d)}</small></span><span className={`ledger-option-left${longAmount(money(debtRemaining(d),d.currency))?' long':''}`}>{money(debtRemaining(d),d.currency)}<small>left</small></span></label>)}</fieldset>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <DatePanel open={sheet==='when'} onOpenChange={o=>setSheet(o?'when':null)} title="When did you pay?" label="Payment date" value={date} onChange={setDate} min={debt.date}/>
    <NotePanel open={sheet==='note'} onOpenChange={o=>setSheet(o?'note':null)} id="payment-note" value={note} onChange={setNote} placeholder="Bank transfer reference"/>
  </>}>
    <p className="create-sentence">
      <W>I paid</W> <Blank state={sheet==='amount'||!done?'current':'filled'} label={done?`Amount: ${amountText(amount,debt.currency)}. Change`:'Choose how much you paid'} onClick={()=>setSheet('amount')}>{done?amountText(amount,debt.currency):'how much'}</Blank>{' '}
      <W>to</W> <Blank state={sheet==='who'?'current':'filled'} label={debts.length>1?`Paid to ${debt.person}. Change`:`Paid to ${debt.person}`} onClick={debts.length>1?()=>setSheet('who'):undefined}>{debt.person}</Blank>{' '}
      <W>on</W> <span className="create-nowrap"><Blank state={sheet==='when'?'current':'filled'} label={`On ${dateText(date)}. Change`} onClick={()=>setSheet('when')}>{dateText(date)}</Blank><W>.</W></span>
    </p>
    <div className="create-links">{noteLink(note,()=>setSheet('note'))}</div>
    <ErrorMessage message={error}/>
    <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={!done||busy} aria-busy={busy} onClick={()=>void save()}>Save payment</button><p className="sign-note">{done&&after?`Afterwards: ${after}`:`${money(left,debt.currency)} left to repay`}</p></div>
  </Flow>;
}

/** Who else is in a shared investment and their whole-number shares; the owner keeps what's left. Private: nobody is contacted. */
export function PartnersPanel({open,onOpenChange,partners,onDone,busy=false,error=''}:{open:boolean;onOpenChange:(o:boolean)=>void;partners:InvestmentPartner[];onDone:(partners:InvestmentPartner[],myShare?:number)=>void;busy?:boolean;error?:string}){
  const [draft,setDraft]=useState<{name:string;share:string}[]>([]),[panelError,setPanelError]=useState('');
  useEffect(()=>{if(open){setDraft(partners.length?partners.map(p=>({name:p.name,share:String(p.share)})):[{name:'',share:''}]);setPanelError('');}},[open,partners]);
  const used=draft.reduce((sum,p)=>sum+(/^\d+$/.test(p.share)?Number(p.share):0),0),mine=100-used;
  function submit(){
    const filled=draft.filter(p=>p.name.trim()||p.share.trim());
    if(filled.some(p=>p.name.trim().length<2)){setPanelError('Add each person’s full name.');return;}
    if(filled.some(p=>!/^\d+$/.test(p.share)||Number(p.share)<1||Number(p.share)>99)){setPanelError('Enter each share as a whole number from 1 to 99.');return;}
    if(filled.length&&mine<1){setPanelError(`Their shares add up to ${used}%. Leave at least 1% for you.`);return;}
    setPanelError('');onDone(filled.map(p=>({name:p.name.trim(),share:Number(p.share)})),filled.length?mine:undefined);
  }
  const set=(i:number,field:'name'|'share',value:string)=>setDraft(list=>list.map((p,k)=>k===i?{...p,[field]:field==='share'?value.replace(/\D/g,'').slice(0,2):value}:p));
  return <Panel open={open} onOpenChange={onOpenChange} title="Who’s in it with you?" description="For your record only. Nobody is contacted.">
    <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();submit();}}>
      <ul className="record-partners">{draft.map((p,i)=><li key={i} className="record-partner">
        <label className="create-field">{i===0&&<span className="create-field-label" aria-hidden>Full name</span>}<span className="sr-only">Person {i+1}’s full name</span><input value={p.name} onChange={e=>set(i,'name',e.target.value)} maxLength={120} autoComplete="off" placeholder={i===0?'Aisha Bello':undefined}/></label>
        <label className="create-field record-share">{i===0&&<span className="create-field-label" aria-hidden>Share</span>}<span className="sr-only">Person {i+1}’s share, in percent</span><span className="record-share-box"><input value={p.share} onChange={e=>set(i,'share',e.target.value)} inputMode="numeric" autoComplete="off" placeholder={i===0?'40':undefined}/><span aria-hidden>%</span></span></label>
        {draft.length>1&&<button type="button" className="detail-icon-button record-partner-remove" aria-label={`Remove person ${i+1}`} onClick={()=>setDraft(list=>list.filter((_,k)=>k!==i))}><X size={16} aria-hidden/></button>}
      </li>)}</ul>
      {draft.length<investmentPartnerLimit&&<button type="button" className="kit-link detail-link-button record-partner-add" onClick={()=>setDraft(list=>[...list,{name:'',share:''}])}>+ Add another person</button>}
      <p className="record-mine" aria-live="polite">Your share <strong>{Math.max(mine,0)}%</strong></p>
      <ErrorMessage message={panelError||error}/>
      <button type="submit" className="button button-primary sign-primary" disabled={busy} aria-busy={busy}>Done</button>
      {partners.length>0&&<button type="button" className="button button-secondary sign-secondary" disabled={busy} onClick={()=>onDone([],undefined)}>It’s just mine</button>}
    </form>
  </Panel>;
}
const sharedWith=(partners:InvestmentPartner[],myShare:number|undefined,current:boolean,open:()=>void)=>partners.length>0&&<>{' '}<span className="create-witnessed">Shared with</span> {partners.map((p,i)=><Fragment key={i}>{i>0&&<W>{i===partners.length-1?' and ':', '}</W>}<span className="create-nowrap"><Blank state={current?'current':'filled'} label={`${p.name}, ${p.share}%. Change`} onClick={open}><bdi>{p.name}</bdi>{` · ${p.share}%`}</Blank>{i===partners.length-1&&<W>.</W>}</span></Fragment>)}{' '}<W>My share is</W> <span className="create-nowrap"><Blank state={current?'current':'filled'} label={`My share: ${myShare}%. Change`} onClick={open}>{`${myShare}%`}</Blank><W>.</W></span></>;

/**
 * New: "I put ₦100,000 into Farm co-op on 3 Oct. Shared with Aisha · 40%. My share is 60%."
 * Change (pass `investment`): "My money is in Farm co-op, counted in ₦ Naira." Amounts are changed one contribution at a time.
 */
export function InvestmentBlanks({open,onOpenChange,demo,investment,onSaved,onReload}:{open:boolean;onOpenChange:(o:boolean)=>void;demo:boolean;investment?:Investment|null;onSaved:(i:Investment)=>void;onReload?:()=>Promise<Investment|undefined>}){
  const [sheet,setSheet]=useState<Sheet>(null),[name,setName]=useState(''),[currency,setCurrency]=useState('NGN'),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate()),[note,setNote]=useState('');
  const [partners,setPartners]=useState<InvestmentPartner[]>([]),[myShare,setMyShare]=useState<number|undefined>(),[base,setBase]=useState<Investment|null>(null);
  const [done,setDone]=useState({amount:false,who:false}),[error,setError]=useState(''),[panelError,setPanelError]=useState(''),[busy,setBusy]=useState(false),key=useKey();
  function load(r?:Investment|null){setBase(r??null);setSheet(null);setName(r?.name??'');setCurrency(r?.currency??'NGN');setAmount('');setDate(calendarDate());setNote(r?.note??'');setPartners(r?.partners??[]);setMyShare(r?.myShare);setDone({amount:!!r,who:!!r});setError('');}
  useEffect(()=>{if(open)load(investment);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- start fresh only when the flow opens
  },[open]);
  const editing=!!base,ready=done.amount&&done.who,focus=sheet??(!done.amount?'amount':!done.who?'who':null);
  async function save(){if(busy)return;setBusy(true);setError('');try{
    const url=`${apiBase(demo)}/investments${base?`/${base.id}`:''}`;
    const body=base?{action:'edit',name,currency,note,partners,...(partners.length?{myShare}:{}),expectedRevision:base.revision}:{name,currency,amountMinor:parseMoney(amount),date,note,...(partners.length?{partners,myShare}:{})};
    const {investment:saved}=await api<{investment:Investment}>(url,body,key({url,body}));onSaved(saved);onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const nameBlank=<Blank state={focus==='who'?'current':done.who?'filled':'empty'} label={done.who?`Investment: ${name}. Change`:'Choose what you invested in'} onClick={()=>setSheet('who')}>{done.who?name:'what'}</Blank>;
  return <Flow open={open} onOpenChange={onOpenChange} kicker={editing?'Edit investment':'New investment'} title={editing?'Change your record':ready?'Read it back':'Write it down'} sub={editing?'Tap anything to change it. Your contributions stay as they are.':ready?'Tap anything to change it. Only you can see this.':'Tap each blank. Only you can see this.'} panels={<>
    <Panel open={sheet==='amount'} onOpenChange={o=>setSheet(o?'amount':null)} title="How much did you put in?" description="Money you’ve already invested, in its own currency.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();try{parseMoney(amount);}catch{setPanelError(amountError);return;}setPanelError('');setDone(d=>({...d,amount:true}));setSheet(done.who?null:'who');}}>
        <CurrencyPill value={currency} onChange={setCurrency}/>
        <AmountInput label={`Amount invested (${currency})`} value={amount} onChange={setAmount} currency={currency}/>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">{done.who?'Done':'Next: what'}</button>
      </form>
    </Panel>
    <Panel open={sheet==='currency'} onOpenChange={o=>setSheet(o?'currency':null)} title="Which currency?" description="Each currency keeps its own total.">
      <form className="ask-form" onSubmit={e=>{e.preventDefault();setSheet(null);}}>
        <CurrencyPill value={currency} onChange={setCurrency} locked={base&&base.contributions.length>1?'Currency is fixed because you’ve added money more than once.':undefined}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='who'} onOpenChange={o=>setSheet(o?'who':null)} title="What did you invest in?" description="A business, a co-op, gold, or something else.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(name.trim().length<2){setPanelError('Add a name for this investment.');return;}setPanelError('');setDone(d=>({...d,who:true}));setSheet(null);}}>
        <label className="create-field"><span className="create-field-label">Investment name or place</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={120} autoComplete="off" placeholder="Farm co-op"/></label>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <DatePanel open={sheet==='when'} onOpenChange={o=>setSheet(o?'when':null)} title="When did you put it in?" label="Investment date" value={date} onChange={setDate}/>
    <NotePanel open={sheet==='note'} onOpenChange={o=>setSheet(o?'note':null)} id="investment-note" value={note} onChange={setNote} placeholder="Capital for the second season"/>
    <PartnersPanel open={sheet==='partners'} onOpenChange={o=>setSheet(o?'partners':null)} partners={partners} onDone={(next,mine)=>{setPartners(next);setMyShare(mine);setSheet(null);}}/>
  </>}>
    {editing?<p className="create-sentence">
      <W>My money is in</W> <span className="create-nowrap">{nameBlank}<W>,</W></span>{' '}
      <W>counted in</W> <span className="create-nowrap"><Blank state={sheet==='currency'?'current':'filled'} label={`Currency: ${currencyLabel(currency)}. Change`} onClick={()=>setSheet('currency')}>{currencyLabel(currency)}</Blank><W>.</W></span>
      {sharedWith(partners,myShare,sheet==='partners',()=>setSheet('partners'))}
    </p>:<p className="create-sentence">
      <W>I put</W> <Blank state={focus==='amount'?'current':done.amount?'filled':'empty'} label={done.amount?`Amount: ${amountText(amount,currency)}. Change`:'Choose how much you put in'} onClick={()=>setSheet('amount')}>{done.amount?amountText(amount,currency):'how much'}</Blank>{' '}
      <W>into</W> {nameBlank}{' '}
      <W>on</W> <span className="create-nowrap"><Blank state={sheet==='when'?'current':'filled'} label={`On ${dateText(date)}. Change`} onClick={()=>setSheet('when')}>{dateText(date)}</Blank><W>.</W></span>
      {sharedWith(partners,myShare,sheet==='partners',()=>setSheet('partners'))}
    </p>}
    <div className="create-links">{partners.length===0&&<button type="button" className="kit-link detail-link-button" onClick={()=>setSheet('partners')}>+ Shared with someone? Add them</button>}{noteLink(note,()=>setSheet('note'))}</div>
    <ErrorMessage message={error}/>{reloadButton(error,onReload&&(async()=>{const latest=await onReload();if(latest)load(latest);}))}
    <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={!ready||busy} aria-busy={busy} onClick={()=>void save()}>{editing?'Save changes':'Save investment'}</button><p className="sign-note">{ready?'What you put in, not what it’s worth today.':'Fill the blanks to continue'}</p></div>
  </Flow>;
}

/** "I added ₦20,000 to Farm co-op on today." Pass `contribution` to correct one you recorded. */
export function ContributionBlanks({open,onOpenChange,demo,records,startId,contribution,onSaved}:{open:boolean;onOpenChange:(o:boolean)=>void;demo:boolean;records:Investment[];startId:string|null;contribution?:InvestmentContribution|null;onSaved:(i:Investment,edited:boolean)=>void}){
  const [sheet,setSheet]=useState<Sheet>(null),[id,setId]=useState<string|null>(null),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate()),[note,setNote]=useState(''),[editingOf,setEditingOf]=useState<InvestmentContribution|null>(null);
  const [done,setDone]=useState(false),[error,setError]=useState(''),[panelError,setPanelError]=useState(''),[busy,setBusy]=useState(false),key=useKey();
  useEffect(()=>{if(open){const c=contribution??null;setEditingOf(c);setId(startId);setSheet(null);setAmount(c?toInput(c.amountMinor):'');setDate(c?.date??calendarDate());setNote(c?.note??'');setDone(!!c);setError('');}
  // eslint-disable-next-line react-hooks/exhaustive-deps -- start fresh only when the flow opens
  },[open]);
  const record=records.find(r=>r.id===id)??records[0];
  if(!record)return null;
  const canPick=!editingOf&&records.length>1;
  async function save(){if(busy)return;setBusy(true);setError('');try{
    const url=`${apiBase(demo)}/investments/${record.id}`,body={action:editingOf?'edit-contribution':'contribute',amountMinor:parseMoney(amount),date,note,expectedRevision:record.revision,...(editingOf?{contributionId:editingOf.id}:{})};
    const {investment}=await api<{investment:Investment}>(url,body,key({url,body}));onSaved(investment,!!editingOf);onOpenChange(false);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Flow open={open} onOpenChange={o=>{if(!busy)onOpenChange(o);}} kicker={editingOf?'Edit contribution':'Add money'} title={editingOf?'Change what you added':done?'Read it back':'Write it down'} sub={`Only you can see this. ${record.name} has ${money(investmentTotal(record),record.currency)} put in so far.`} panels={<>
    <Panel open={sheet==='amount'} onOpenChange={o=>setSheet(o?'amount':null)} title="How much did you add?" description={`In ${currencyLabel(record.currency)}, like the rest of ${record.name}.`}>
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();try{parseMoney(amount);}catch{setPanelError(amountError);return;}setPanelError('');setDone(true);setSheet(null);}}>
        <AmountInput label={`Amount invested (${record.currency})`} value={amount} onChange={setAmount} currency={record.currency}/>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='who'} onOpenChange={o=>setSheet(o?'who':null)} title="Which investment?">
      <form className="ask-form" onSubmit={e=>{e.preventDefault();setSheet(null);}}>
        <fieldset className="ledger-picker"><legend className="sr-only">Which investment?</legend>{records.map(r=><label key={r.id} className="ledger-option record-option"><input type="radio" name="add-to" checked={r.id===record.id} onChange={()=>{setId(r.id);if(r.currency!==record.currency){setAmount('');setDone(false);}}}/><span><strong>{r.name}</strong><small>{r.currency}</small></span><span className={`ledger-option-left${longAmount(money(investmentTotal(r),r.currency))?' long':''}`}>{money(investmentTotal(r),r.currency)}<small>so far</small></span></label>)}</fieldset>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <DatePanel open={sheet==='when'} onOpenChange={o=>setSheet(o?'when':null)} title="When did you add it?" label="Investment date" value={date} onChange={setDate}/>
    <NotePanel open={sheet==='note'} onOpenChange={o=>setSheet(o?'note':null)} id="contribution-note" value={note} onChange={setNote} placeholder="Second season’s seeds"/>
  </>}>
    <p className="create-sentence">
      <W>I added</W> <Blank state={sheet==='amount'||!done?'current':'filled'} label={done?`Amount: ${amountText(amount,record.currency)}. Change`:'Choose how much you added'} onClick={()=>setSheet('amount')}>{done?amountText(amount,record.currency):'how much'}</Blank>{' '}
      <W>to</W> <Blank state={sheet==='who'?'current':'filled'} label={canPick?`Added to ${record.name}. Change`:`Added to ${record.name}`} onClick={canPick?()=>setSheet('who'):undefined}>{record.name}</Blank>{' '}
      <W>on</W> <span className="create-nowrap"><Blank state={sheet==='when'?'current':'filled'} label={`On ${dateText(date)}. Change`} onClick={()=>setSheet('when')}>{dateText(date)}</Blank><W>.</W></span>
    </p>
    <div className="create-links">{noteLink(note,()=>setSheet('note'))}</div>
    <ErrorMessage message={error}/>
    <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={!done||busy} aria-busy={busy} onClick={()=>void save()}>{editingOf?'Save changes':'Save contribution'}</button><p className="sign-note">{done?'What you put in, not what it’s worth today.':'Fill the blanks to continue'}</p></div>
  </Flow>;
}

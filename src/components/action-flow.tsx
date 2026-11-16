'use client';
// Every agreement action as one sentence with blanks, like the rest of treeti (owner, Nov 2026).
// The agreement screen keeps the drafts and the save; this only lays them out and checks each blank.
import {useState,type ReactNode} from 'react';
import type {Aggregate,Participant,Version} from '@/modules/agreements/types';
import {digitalWitnessStatement} from '@/modules/agreements/witness-policy';
import {groupMoneyInput,money,moneyInput,parseMoney} from '@/lib/money';
import {CheckCircle2,HeartHandshake} from './icons';
import {Blank,Panel} from './kit';
import {Button,DisclosureSummary,ErrorMessage} from './ui';
import {affirmation,formatDate,interestWording} from './agreement-utils';
import {InterestWordingWarning,InviteLink,type InvitationLinkData} from './create-agreement';
import {firstName} from './person-colour';
import {AmountInput,DatePanel,Flow,NotePanel,W,amountError,amountText,dateText} from './record-blanks';

export type ActionDrafts={amount:string;date:string;method:string;reference:string;reason:string;name:string;contact:string;witnessDrafts:{name:string;contact:string}[];file:File|null;affirmed:boolean;signature:string;closeAgreement:boolean;editSignature:boolean};
type Sheet='amount'|'when'|'method'|'reference'|'proof'|'reason'|`witness-${number}`|null;
const methods=[['Bank transfer','by bank transfer'],['Cash','in cash'],['Other','another way']] as const;
const methodText=(m:string)=>methods.find(x=>x[0]===m)?.[1]??'another way';
/** A fact the reader confirms but can't change here. */
const Fact=({children}:{children:ReactNode})=><span className="kit-blank kit-blank-filled record-fact">{children}</span>;

export function ActionFlow({action,targetId,a,v,me,demo,drafts,set,busy,error,issued,witnessSlots,witnessCount,title,description,submitLabel,danger,onSubmit,onClose,onReload}:{
  action:string|null;targetId?:string;a:Aggregate;v:Version;me:Participant;demo:boolean;drafts:ActionDrafts;set:(patch:Partial<ActionDrafts>)=>void;busy:boolean;error:string;issued:InvitationLinkData[];
  witnessSlots:number;witnessCount:number;title:string;description:string;submitLabel:string;danger:boolean;onSubmit:()=>void;onClose:()=>void;onReload:()=>void;
}){
  const [sheet,setSheet]=useState<Sheet>(null),[panelError,setPanelError]=useState(''),[shown,setShown]=useState<string|null>(null);
  // Start each action with no panel open.
  if(action!==shown){setShown(action);setSheet(null);setPanelError('');}
  const cur=v.terms.currency,remaining=money(a.balanceMinor,cur),lender=a.participants.find(x=>x.role==='LENDER'),borrower=a.participants.find(x=>x.role==='BORROWER');
  const other=a.participants.find(x=>x.role!=='WITNESS'&&x.id!==me.id),payment=targetId?a.repayments.find(r=>r.id===targetId):undefined,adjustment=targetId?a.adjustments.find(x=>x.id===targetId):undefined;
  const d=drafts,open=(s:Sheet)=>{setPanelError('');setSheet(s);},close=()=>setSheet(null);
  const isFinal=action==='repayment'?(()=>{try{return parseMoney(d.amount)===a.balanceMinor;}catch{return false;}})():action==='confirm-repayment'&&payment?.amountMinor===a.balanceMinor;
  const slots=action==='invite-witness'?1:witnessSlots,people=d.witnessDrafts.slice(0,slots);
  function checkAmount(){try{if(BigInt(parseMoney(d.amount))>BigInt(a.balanceMinor)){setPanelError(`That’s more than the ${remaining} left.`);return false;}}catch{setPanelError(amountError);return false;}setPanelError('');return true;}
  const hasAmount=(()=>{try{parseMoney(d.amount);return true;}catch{return false;}})();
  const ready=action==='repayment'?hasAmount:action==='forgiveness'?hasAmount&&!!d.reason.trim():['request-change','dispute-repayment'].includes(action??'')?!!d.reason.trim():action?.startsWith('invite-witness')?people.every(w=>w.name.trim().length>=2&&w.contact.trim()):true;
  const reasonBlank=(placeholder:string)=><Blank state={sheet==='reason'?'current':d.reason.trim()?'filled':'empty'} label={d.reason.trim()?`${d.reason}. Change`:`Add ${placeholder}`} onClick={()=>open('reason')}>{d.reason.trim()?quote(d.reason):placeholder}</Blank>;
  const amountBlank=(empty:string)=><Blank state={sheet==='amount'||!hasAmount?'current':'filled'} label={hasAmount?`Amount: ${amountText(d.amount,cur)}. Change`:empty} onClick={()=>open('amount')}>{hasAmount?amountText(d.amount,cur):'how much'}</Blank>;
  const dateBlank=<span className="create-nowrap"><Blank state={sheet==='when'?'current':'filled'} label={`On ${dateText(d.date)}. Change`} onClick={()=>open('when')}>{dateText(d.date)}</Blank></span>;

  let body:ReactNode=null;
  if(action==='repayment')body=<>
    <p className="create-sentence">{me.role==='BORROWER'?<><W>I paid</W> {amountBlank('Choose how much you paid')} <W>to {firstName(lender?.name??'the lender')} on</W> </>:<><W>{firstName(borrower?.name??'The borrower')} paid me</W> {amountBlank('Choose how much was paid')} <W>on</W> </>}{dateBlank}{' '}<span className="create-nowrap"><Blank state={sheet==='method'?'current':'filled'} label={`Paid ${methodText(d.method)}. Change`} onClick={()=>open('method')}>{methodText(d.method)}</Blank><W>.</W></span></p>
    <div className="create-links">
      <button type="button" className="kit-link detail-link-button" onClick={()=>open('reference')}>{d.reference.trim()?`Reference: ${d.reference}`:'+ Add a transfer reference'}</button>
      <button type="button" className="kit-link detail-link-button" onClick={()=>open('reason')}>{d.reason.trim()?'Edit your note':'+ Add a note (optional)'}</button>
      <button type="button" className="kit-link detail-link-button" onClick={()=>open('proof')}>{d.file?`Proof: ${d.file.name}`:'+ Attach proof (optional)'}</button>
    </div>
    {isFinal&&<label className="checkbox-field"><input type="checkbox" checked={d.closeAgreement} onChange={e=>set({closeAgreement:e.target.checked})}/>If the other party confirms this final payment, I agree to close the agreement with no balance remaining. Both parties must agree to close it.</label>}
  </>;
  else if(action==='forgiveness')body=<>
    <p className="create-sentence"><W>I forgive</W> {amountBlank('Choose how much to forgive')} <W>of the {remaining} {firstName(borrower?.name??'the borrower')} still owes.</W> <W>My note:</W> {reasonBlank('a few words')}<W>.</W></p>
    <p className="record-explain">Once {firstName(borrower?.name??'the borrower')} acknowledges it, the balance goes down for good. It’s recorded as forgiveness, not as money repaid.</p>
  </>;
  else if(action==='dispute-repayment'&&payment)body=<p className="create-sentence"><W>I’d like to check the</W> <Fact>{money(payment.amountMinor,cur)}</Fact> <W>payment from {formatDate(payment.date)}, because</W> {reasonBlank('what needs checking')}<W>.</W></p>;
  else if(action==='request-change')body=<p className="create-sentence"><W>I’d like to change</W> {reasonBlank('what')}<W>.</W></p>;
  else if(action==='decline'||action==='decline-witness')body=<>
    <p className="create-sentence"><W>{action==='decline'?'I’m saying no to this proposal':'I won’t witness this agreement'}</W>{d.reason.trim()?<><W>, because</W> {reasonBlank('a reason')}</>:null}<W>.</W></p>
    {!d.reason.trim()&&<div className="create-links"><button type="button" className="kit-link detail-link-button" onClick={()=>open('reason')}>+ Add a reason (optional)</button></div>}
  </>;
  else if(action==='invite-witness'||action==='invite-witnesses')body=<>
    <p className="create-sentence"><W>I’m asking</W> {people.map((w,i)=><span key={i}>{i>0&&<W> and </W>}<Blank state={sheet===`witness-${i}`?'current':w.name.trim()?'filled':'empty'} label={w.name.trim()?`Witness ${i+1}: ${w.name}. Change`:`Choose witness ${i+1}`} onClick={()=>open(`witness-${i}`)}>{w.name.trim()||'who'}</Blank></span>)} <W>to witness this agreement.</W></p>
    <p className="record-explain">Each person gets their own private link. They read the terms and agree to act as a witness. They aren’t responsible for repayment.</p>
  </>;
  else if(action==='confirm-repayment'&&payment)body=<>
    <p className="create-sentence"><W>{payment.participantId===me.id?'I':firstName(a.participants.find(x=>x.id===payment.participantId)?.name??(other?.name??'They'))} recorded</W> <Fact>{money(payment.amountMinor,cur)}</Fact> <W>paid on</W> <Fact>{formatDate(payment.date)}</Fact> <W>{methodText(payment.method)}.</W></p>
    {payment.reference&&<p className="record-explain">Reference: {payment.reference}</p>}
    <p className="record-explain">Confirm only if this matches what was paid and received. The confirmed balance goes down by this amount.</p>
    {isFinal&&<label className="checkbox-field"><input type="checkbox" checked={d.closeAgreement} onChange={e=>set({closeAgreement:e.target.checked})}/>I agree to close the agreement with no balance remaining after this payment is confirmed. Both parties must agree to close it.</label>}
  </>;
  else if(action==='confirm-forgiveness'&&adjustment)body=<>
    <p className="create-sentence"><W>{firstName(lender?.name??'The lender')} is forgiving</W> <Fact>{money(adjustment.amountMinor,cur)}</Fact> <W>of what you owe.</W></p>
    {adjustment.reason&&<blockquote className="record-quote">{adjustment.reason}</blockquote>}
    <p className="record-explain">Acknowledging it lowers the confirmed balance. It won’t be described as money repaid.</p>
  </>;
  else if(action==='settle')body=<>
    <p className="create-sentence"><W>Nothing is left to repay on this agreement:</W> <Fact>{money('0',cur)}</Fact><W>.</W></p>
    <label className="checkbox-field"><input checked={d.affirmed} onChange={e=>set({affirmed:e.target.checked})} type="checkbox"/>I acknowledge that no balance remains under this recorded agreement.</label>
    <p className="record-explain">Both of you acknowledge it before the final settlement record is ready.</p>
  </>;
  else if(action)body=<div className="dialog-form record-confirm">
    {['approve','attest','agree-and-send','finalize'].includes(action)&&<div className="confirmation-summary"><span>Version {v.number}</span><strong>{money(v.terms.principalMinor,cur)}</strong><small>Due {formatDate(v.terms.dueDate)} · Interest {money('0',cur)} (0%)</small><details><DisclosureSummary>Review the full wording</DisclosureSummary><p>{v.text}</p></details></div>}
    {['approve','attest','agree-and-send'].includes(action)&&<InterestWordingWarning words={interestWording(v.terms.purpose,v.terms.additionalTerms)} reader={me.role}/>}
    {action==='attest'&&<div className="callout"><HeartHandshake size={23}/><p>You can act as a witness by reading these terms and confirming your agreement below. You do not need to have been physically present, and you are not responsible for repayment.</p></div>}
    {['approve','attest','agree-and-send'].includes(action)&&<><label className="checkbox-field"><input type="checkbox" checked={d.affirmed} onChange={e=>set({affirmed:e.target.checked})}/>{action==='attest'?digitalWitnessStatement(v):affirmation(me.role)}</label><p className="quiet-note">Recorded as <strong>{d.signature}</strong>.</p>{d.editSignature?<label className="create-field"><span className="create-field-label">Full name for this confirmation</span><input value={d.signature} onChange={e=>set({signature:e.target.value})} autoComplete="name" minLength={2} maxLength={120}/></label>:<Button type="button" variant="ghost" onClick={()=>set({editSignature:true})}>Change name</Button>}<p className="quiet-note">The record becomes active automatically when both parties agree and all requested witnesses confirm.</p></>}
    {action==='finalize'&&<p>Both parties approved this version, and {witnessCount} requested witness responses are recorded. Finalization preserves this exact record; its terms cannot be silently edited.</p>}
    {['send','agree-and-send'].includes(action)&&<p>The borrower can accept, request changes, or decline. Sharing this invitation does not establish their acceptance.</p>}
    {action==='cancel'&&<p>This closes the proposal and revokes pending invitations. Earlier actions stay in the private history.</p>}
  </div>;

  const index=sheet?.startsWith('witness-')?Number(sheet.slice(8)):-1,draft=index>=0?d.witnessDrafts[index]:null;
  const setWitness=(patch:Partial<{name:string;contact:string}>)=>set({witnessDrafts:d.witnessDrafts.map((w,i)=>i===index?{...w,...patch}:w)});
  const reasonCopy:Record<string,{title:string;label:string;placeholder:string;required:boolean;description?:string}>={
    repayment:{title:'Add a note',label:'Note (optional)',placeholder:'Paid from the shop account',required:false,description:'Both of you can see it.'},
    forgiveness:{title:`A note for ${firstName(borrower?.name??'them')}`,label:'A note about this offer',placeholder:'Take your time with the rest',required:true,description:'They’ll see it with the offer.'},
    'dispute-repayment':{title:'What needs checking?',label:'What needs to be checked?',placeholder:'I can’t see this transfer yet',required:true,description:'Keep it clear and respectful.'},
    'request-change':{title:'What would you like to change?',label:'What would you like to change?',placeholder:'the repayment date to 30 March',required:true,description:'Keep it clear and respectful.'},
    decline:{title:'Add a reason',label:'Add a short explanation',placeholder:'I can’t take this on right now',required:false,description:'If this agreement isn’t for you, you can say why.'},
    'decline-witness':{title:'Add a reason',label:'Add a short explanation',placeholder:'I don’t know the borrower well enough',required:false},
  };
  const rc=action?reasonCopy[action]:undefined;

  return <Flow open={!!action} onOpenChange={o=>{if(!o&&!busy)onClose();}} kicker={a.publicId} title={issued.length?'Send each link':title} sub={issued.length?'Share each private link with the person it’s for.':description} panels={<>
    <Panel open={sheet==='amount'} onOpenChange={o=>o?open('amount'):close()} title={action==='forgiveness'?'How much will you forgive?':'How much was paid?'} description={`${remaining} is left on this agreement.`}>
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(checkAmount())close();}}>
        <AmountInput label={action==='forgiveness'?`Amount to forgive (${cur})`:`Amount paid (${cur})`} value={d.amount} onChange={value=>set({amount:value,closeAgreement:false})} currency={cur}/>
        <div className="kit-chips record-chips" role="group" aria-label="Quick amounts"><button type="button" className="kit-chip" aria-pressed={d.amount===groupMoneyInput(moneyInput(a.balanceMinor))} onClick={()=>set({amount:groupMoneyInput(moneyInput(a.balanceMinor)),closeAgreement:false})}>All {remaining}</button></div>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <DatePanel open={sheet==='when'} onOpenChange={o=>o?open('when'):close()} title="When was it paid?" label="Payment date" value={d.date} onChange={value=>set({date:value})}/>
    <Panel open={sheet==='method'} onOpenChange={o=>o?open('method'):close()} title="How was it paid?">
      <form className="ask-form" onSubmit={e=>{e.preventDefault();close();}}>
        <fieldset className="create-plans" role="radiogroup" aria-label="Payment method">{methods.map(([value,text])=><label key={value} className="create-plan"><input type="radio" name="payment-method" value={value} checked={d.method===value} onChange={()=>set({method:value})}/><span className="create-plan-dot" aria-hidden/><span><strong>{value}</strong><small>Paid {text}</small></span></label>)}</fieldset>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='reference'} onOpenChange={o=>o?open('reference'):close()} title="Transfer reference" description="Helps you both match it to a bank statement.">
      <form className="ask-form" onSubmit={e=>{e.preventDefault();close();}}>
        <label className="create-field"><span className="create-field-label">Transfer reference (optional)</span><input value={d.reference} onChange={e=>set({reference:e.target.value})} maxLength={100} autoComplete="off" placeholder="FT2410031234"/></label>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='proof'} onOpenChange={o=>o?open('proof'):close()} title="Attach proof" description="PDF, PNG or JPEG, up to 5 MB. Only the lender and borrower can view it.">
      <form className="ask-form" onSubmit={e=>{e.preventDefault();close();}}>
        <label className="create-field"><span className="create-field-label">Payment proof (optional)</span><input type="file" accept="application/pdf,image/png,image/jpeg" onChange={e=>set({file:e.target.files?.[0]??null})}/></label>
        {d.file&&<button type="button" className="button button-secondary sign-secondary" onClick={()=>{set({file:null});close();}}>Remove {d.file.name}</button>}
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    {rc&&<NotePanel open={sheet==='reason'} onOpenChange={o=>o?open('reason'):close()} id="action-reason" value={d.reason} onChange={value=>set({reason:value})} title={rc.title} label={rc.label} placeholder={rc.placeholder} required={rc.required} description={rc.description}/>}
    <Panel open={!!draft} onOpenChange={o=>{if(!o)close();}} title="Who should witness it?" description="They’ll get a private link to read the terms and respond.">
      {draft&&<form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(draft.name.trim().length<2){setPanelError('Add the witness’s full name.');return;}if(!draft.contact.trim()){setPanelError(demo?'Add an email or phone number.':'Add an email address.');return;}setPanelError('');close();}}>
        <label className="create-field"><span className="create-field-label">Witness’s full name</span><input value={draft.name} onChange={e=>setWitness({name:e.target.value})} maxLength={120} autoComplete="off" placeholder="Maryam Bello"/></label>
        <label className="create-field"><span className="create-field-label">{demo?'Email or phone number':'Email address'}</span><input type={demo?'text':'email'} value={draft.contact} onChange={e=>setWitness({contact:e.target.value})} autoComplete="off" placeholder={demo?(index===0?'maryam@example.test':'yusuf@example.test'):'name@example.com'}/></label>
        {demo&&<small className="record-explain">Demo witnesses: maryam@example.test and yusuf@example.test.</small>}
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>}
    </Panel>
  </>}>
    {issued.length?<div className="record-invites">{issued.map(link=><InviteLink key={link.url} url={link.url} name={link.name} role={link.role}/>)}<Button onClick={onClose}>Return to agreement</Button></div>:<>
      {body}
      <ErrorMessage message={error}/>{error.includes('changed since')&&<Button type="button" variant="secondary" onClick={onReload}>Load the latest version</Button>}
      <div className="sign-actions"><button type="button" className={`button ${danger?'button-danger':'button-primary'} sign-primary`} disabled={!ready||busy} aria-busy={busy} onClick={onSubmit}>{submitLabel}</button>{action==='repayment'&&<p className="sign-note">The balance changes only after {firstName(other?.name??'the other person')} confirms it.</p>}{action==='settle'&&<p className="sign-note"><CheckCircle2 size={14} aria-hidden/> All recorded obligations are cleared.</p>}</div>
    </>}
  </Flow>;
}
const quote=(text:string)=>text.length>60?`${text.slice(0,57).trimEnd()}…`:text;

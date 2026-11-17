'use client';
// New agreement (Figma: v3 · Screens · Create · 1 Blanks … 6 Read it back, Sign · 2–3, Create · Send it to everyone;
// Desktop · Write an agreement 152:7858). The terms read as one sentence; each blank opens a panel.
import Link from '@/components/app-link';
import {useRouter} from 'next/navigation';
import {useEffect,useState,type ReactNode} from 'react';
import {useForm,useWatch,useFieldArray} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {track} from '@/lib/analytics';
import {calendarDate} from '@/lib/calendar';
import {currencies,currencyNames} from '@/lib/currencies';
import {money,parseMoney,groupMoneyInput,moneyInput} from '@/lib/money';
import {maskContact} from '@/lib/contact';
import type {Actor,Aggregate} from '@/modules/agreements/types';
import {recurringPlan} from '@/modules/agreements/repayment-plan';
import {api,apiBase,appBase} from './client-api';
import {affirmation,currentVersion,formatDate,interestWording} from './agreement-utils';
import {formatMoneyChange} from './money-input';
import {formSchema,formTerms,InterestWordingWarning,type Values,type InvitationLinkData} from './create-agreement';
import {Avatar,Blank,Panel} from './kit';
import {Heading,HoldStep,type Style} from './sign-flow';
import {ErrorMessage} from './ui';
import {Check,Copy,Share2,X} from './icons';
import {firstName} from './person-colour';

type Sheet='amount'|'who'|'what'|'how'|'witness'|'note'|null;
type Witness={name:string;contact:string};
type Stage='write'|'promise'|'hold'|'share';
const short=(date:string)=>formatDate(date).replace(/ \d{4}$/,'');
/** Witnesses written down here are kept on this device until they can be invited (after both people sign). */
export const witnessDraftKey=(agreementId:string)=>`treeti:witness-drafts:${agreementId}`;

/** The current terms of an agreement, as form values, so a new version starts from what was agreed. */
function valuesFrom(existing:Aggregate):Values{
  const old=currentVersion(existing),b=existing.participants.find(p=>p.role==='BORROWER');
  return {currency:old.terms.currency,amount:groupMoneyInput(moneyInput(old.terms.principalMinor)),borrowerName:b?.name||'',borrowerContact:b?.contact||(old.payload.borrower as {contact?:string}|undefined)?.contact||'',agreementDate:old.terms.agreementDate||calendarDate(),dueDate:old.terms.dueDate||'',purpose:old.terms.purpose||'',additionalTerms:old.terms.additionalTerms||'',repaymentPlan:old.terms.installments?.frequency??'SINGLE',paymentCount:String(old.terms.installments?.payments.length??6),firstPaymentDate:old.terms.installments?.payments[0]?.dueDate??'',customPayments:old.terms.installments?.payments.map(p=>({dueDate:p.dueDate,amount:groupMoneyInput(moneyInput(p.amountMinor))}))??[{dueDate:'',amount:''},{dueDate:'',amount:''}],requiredWitnesses:String(old.terms.requiredWitnesses??0),reason:''} as Values;
}
/** Writes a new agreement, or (with `existing`) proposes a new version of one, as a fill-in-the-blank sentence. */
export function CreateBlanks({actor,demo,existing}:{actor:Actor;demo:boolean;existing?:Aggregate}){
  const router=useRouter(),home=demo?'/demo':'/app',base=appBase(demo);
  const [sheet,setSheet]=useState<Sheet>(null),[stage,setStage]=useState<Stage>('write');
  const [done,setDone]=useState({amount:!!existing,who:!!existing,what:!!existing,how:!!existing}),[skipPurpose,setSkipPurpose]=useState(false);
  const [witnesses,setWitnesses]=useState<Witness[]>([]),[editing,setEditing]=useState<number|null>(null),[witnessDraft,setWitnessDraft]=useState<Witness>({name:'',contact:''}),[witnessError,setWitnessError]=useState('');
  const [affirmed,setAffirmed]=useState(false),[style,setStyle]=useState<Style>('script'),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [draft,setDraft]=useState<Aggregate|null>(null),[revised,setRevised]=useState<Aggregate|null>(null),[sent,setSent]=useState<{a:Aggregate;invitation?:InvitationLinkData}|null>(null);
  const [requestKey]=useState(()=>crypto.randomUUID()),[sendKey]=useState(()=>crypto.randomUUID());
  const {register,trigger,control,setValue,getValues,formState:{errors}}=useForm<Values>({resolver:zodResolver(formSchema(demo||!!existing)),defaultValues:existing?valuesFrom(existing):{currency:'NGN',amount:'',borrowerName:'',borrowerContact:'',agreementDate:calendarDate(),dueDate:'',purpose:'',additionalTerms:'',repaymentPlan:'SINGLE',paymentCount:'6',firstPaymentDate:'',customPayments:[{dueDate:'',amount:''},{dueDate:'',amount:''}],requiredWitnesses:'0',reason:''}});
  const values=useWatch({control}) as Values,custom=useFieldArray({control,name:'customPayments'});
  // A new version keeps its requested witnesses; they're managed on the agreement page.
  useEffect(()=>{if(!existing)setValue('requiredWitnesses',String(witnesses.length));},[existing,witnesses.length,setValue]);
  const ready=done.amount&&done.who&&done.how;
  // With no panel open, the next empty blank is highlighted so it's clear where to start.
  const nextBlank:Sheet=!done.amount?'amount':!done.who?'who':!done.what&&!skipPurpose?'what':!done.how?'how':null,focus=sheet??nextBlank;
  let preview:ReturnType<typeof formTerms>|undefined;try{preview=formTerms(values);}catch{}

  async function step(fields:(keyof Values)[],key:keyof typeof done,next:Sheet){if(!await trigger(fields))return;setDone(d=>({...d,[key]:true}));track('agreement_step_completed',{step:key});setSheet(ready&&next!=='what'?null:next);}
  const howFields:(keyof Values)[]=['repaymentPlan','dueDate','paymentCount','firstPaymentDate','customPayments','agreementDate'];

  async function save(send:boolean){
    setBusy(true);setError('');
    try{
      const data=getValues(),terms=formTerms(data);let a=draft;
      if(!existing&&a&&JSON.stringify(currentVersion(a).terms)!==JSON.stringify(terms))throw new Error('Your draft was saved before sending was interrupted. Open it from Agreements to update the terms before sending.');
      if(existing){
        // One new version per visit, even if signing is retried after an interruption.
        a=revised??(await api<{agreement:Aggregate}>(`${apiBase(demo)}/agreements/${existing.id}/version`,{action:'version',expectedVersionId:existing.currentVersionId,terms,reason:data.reason.trim()||'Updated the terms'},requestKey)).agreement;setRevised(a);
      }
      else if(!a){a=(await api<{agreement:Aggregate}>(`${apiBase(demo)}/agreements`,{borrowerName:data.borrowerName,borrowerContact:data.borrowerContact,terms},requestKey)).agreement;setDraft(a);try{if(witnesses.length)localStorage.setItem(witnessDraftKey(a.id),JSON.stringify(witnesses));}catch{}}
      if(!send){router.push(`${base}/agreements/${a.id}`);router.refresh();return;}
      const r=await api<{agreement:Aggregate;invitation?:InvitationLinkData}>(`${apiBase(demo)}/agreements/${a.id}/agree-and-send`,{action:'agree-and-send',expectedVersionId:a.currentVersionId,affirmed:true,signature:actor.name},sendKey);
      if(r.invitation){try{if(demo)sessionStorage.setItem(`ahd:invites:${r.agreement.id}:${r.agreement.currentVersionId}`,JSON.stringify([r.invitation]));}catch{}}
      track('agreement_sent',{structure:data.repaymentPlan,witnesses:existing?Number(data.requiredWitnesses):witnesses.length,currency:data.currency,new_version:!!existing});
      setSent({a:r.agreement,invitation:r.invitation});setStage('share');try{navigator.vibrate?.(20);}catch{}
    }catch(e){setError((e as Error).message);if(send)setStage('promise');}
    finally{setBusy(false);}
  }

  const stageIndex={write:0,promise:1,hold:1,share:2}[stage];
  const back=stage==='promise'?()=>setStage('write'):stage==='hold'?()=>setStage('promise'):null;
  return <div className="sign-flow create-flow">
    <header className="sign-bar">
      {back?<button type="button" className="detail-icon-button" aria-label="Back" onClick={back}><BackIcon/></button>:<Link className="detail-icon-button" href={stage==='share'&&sent?`${base}/agreements/${sent.a.id}`:existing?`${base}/agreements/${existing.id}`:home} aria-label="Close"><X size={18} aria-hidden/></Link>}
      <p className="sign-kicker">{stage==='share'&&sent?sent.a.publicId:existing?`Change ${existing.publicId}`:'New agreement'}</p>
      <ol className="sign-steps" aria-label={`Step ${stageIndex+1} of 3`}>{[0,1,2].map(i=><li key={i} className={i<=stageIndex?'on':''}/>)}</ol>
    </header>
    <div className="sign-body">
      {stage==='write'&&<>
        <Heading plain title={existing?'Change the terms':ready?'Read it back':'Write it down'} sub={existing?'Tap anything to change it. Everyone signs the new version again.':ready?'Tap anything to change it.':'Tap each blank. It reads like you’d say it.'}/>
        <p className="create-sentence">
          <W>I’m lending</W> <Blank state={focus==='amount'?'current':done.amount?'filled':'empty'} label={done.amount?`Amount: ${money(parseMoney(values.amount),values.currency)}. Change`:'Choose how much you’re lending'} onClick={()=>setSheet('amount')}>{done.amount?money(parseMoney(values.amount),values.currency):'how much'}</Blank>{' '}
          <W>to</W> <Blank state={focus==='who'?'current':done.who?'filled':'empty'} label={existing?`Borrower: ${values.borrowerName}. The borrower stays the same in a new version`:done.who?`Borrower: ${values.borrowerName}. Change`:'Choose who you’re lending to'} onClick={()=>{if(!existing)setSheet('who');}}>{done.who?values.borrowerName:'who'}</Blank>
          {!skipPurpose&&<>{' '}<W>for</W> <Blank state={focus==='what'?'current':done.what&&values.purpose.trim()?'filled':'empty'} label={values.purpose.trim()?`Purpose: ${values.purpose}. Change`:'Add what it’s for'} onClick={()=>setSheet('what')}>{done.what&&values.purpose.trim()?purposeText(values.purpose):'what'}</Blank><W>.</W></>}{skipPurpose&&<W>.</W>}{' '}
          <W>They’ll repay</W> <Blank state={focus==='how'?'current':done.how?'filled':'empty'} label={done.how?`Repayment: ${howText(values,preview)}. Change`:'Choose how they repay'} onClick={()=>setSheet('how')}>{done.how?howText(values,preview):'how'}</Blank>{' '}
          <W>{done.how&&values.repaymentPlan==='SINGLE'?'by':'from'}</W> <span className="create-nowrap"><Blank state={focus==='how'?'current':done.how?'filled':'empty'} label={done.how?`Date: ${whenText(values,preview)}. Change`:'Choose when'} onClick={()=>setSheet('how')}>{done.how?whenText(values,preview):'when'}</Blank><W>.</W></span>
          {witnesses.length>0&&<>{' '}<span className="create-witnessed">Witnessed by</span> {witnesses.map((w,i)=><span key={i}>{i>0&&<W> and </W>}<Blank state={sheet==='witness'&&editing===i?'current':'filled'} label={`Witness: ${w.name}. Change`} onClick={()=>{setEditing(i);setWitnessDraft(w);setWitnessError('');setSheet('witness');}}>{w.name}</Blank>{i===witnesses.length-1&&<W>.</W>}</span>)}</>}
        </p>
        <div className="create-links">
          {!existing&&witnesses.length<2&&<button type="button" className="kit-link detail-link-button" onClick={()=>{setEditing(null);setWitnessDraft({name:'',contact:''});setWitnessError('');setSheet('witness');}}>{witnesses.length?'+ Add another witness':'+ Add witnesses (optional)'}</button>}
          {ready&&<button type="button" className="kit-link detail-link-button" onClick={()=>setSheet('note')}>{values.additionalTerms.trim()?'Edit your note':'+ Anything else? Add a note'}</button>}
        </div>
        <InterestWordingWarning words={interestWording(values.purpose,values.additionalTerms)} reader="LENDER"/>
        <ErrorMessage message={error}/>
        <div className="sign-actions">
          <button type="button" className="button button-primary sign-primary" disabled={!ready} onClick={()=>{setAffirmed(false);setStage('promise');}}>Review and sign</button>
          <p className="sign-note">{ready?'Next: read it, promise, hold to sign, then share':'Fill the blanks to continue'}</p>
          {ready&&(!existing||existing.status==='DRAFT')&&<button type="button" className="button sign-tertiary" disabled={busy} onClick={()=>void save(false)}>{existing?'Save changes':'Save draft'}</button>}
        </div>
      </>}
      {stage==='promise'&&<>
        <Heading plain title="One promise first" sub="This is what makes it a treeti agreement."/>
        <label className="sign-promise"><input type="checkbox" checked={affirmed} onChange={e=>setAffirmed(e.target.checked)}/><span className="sign-promise-box" aria-hidden><Check size={14}/></span><span>{affirmation('LENDER')}</span></label>
        <dl className="sign-card sign-facts sign-identity">
          <div><dt>Your name</dt><dd><span>{actor.name}</span></dd></div>
          {actor.contacts[0]&&<div><dt>Signed as</dt><dd>{maskContact(actor.contacts[0])}</dd></div>}
        </dl>
        {existing&&<label className="create-field"><span className="create-field-label">What changed? (optional, {values.borrowerName.split(' ')[0]||'the borrower'} will see this)</span><textarea className="ask-text" rows={3} maxLength={2000} {...register('reason')} placeholder="Moved the due date to March"/></label>}
        <ErrorMessage message={error}/>
        <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={!affirmed} onClick={()=>setStage('hold')}>Continue to sign</button></div>
      </>}
      {stage==='hold'&&<HoldStep plain name={actor.name} style={style} onStyle={setStyle} onDone={()=>save(true)}/>}
      {stage==='share'&&sent&&<ShareStep a={sent.a} invitation={sent.invitation} witnesses={witnesses} borrowerName={values.borrowerName} base={base}/>}
    </div>

    <Panel open={sheet==='amount'} onOpenChange={o=>setSheet(o?'amount':null)} title="How much are you lending?" description="Only what you’ll ask back. treeti never adds interest.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();void step(['currency','amount'],'amount',done.who?null:'who');}}>
        <label className="create-currency"><span className="sr-only">Currency</span><span className="create-currency-face" aria-hidden>{values.currency==='NGN'?'₦ Naira':`${values.currency} · ${currencyNames[values.currency as keyof typeof currencyNames]}`}</span><select {...register('currency')} aria-label="Currency">{currencies.map(c=><option key={c} value={c}>{c==='NGN'?'₦ Naira':`${c} · ${currencyNames[c]}`}</option>)}</select></label>
        <AmountField register={register} setValue={setValue} currency={values.currency} error={errors.amount?.message}/>
        <button type="submit" className="button button-primary sign-primary">{done.who?'Done':'Next: who'}</button>
      </form>
    </Panel>
    <Panel open={sheet==='who'} onOpenChange={o=>setSheet(o?'who':null)} title="Who are you lending to?" description="They get a private link to read and sign. treeti only emails them a sign-in code.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();void step(['borrowerName','borrowerContact'],'who',done.what||skipPurpose?null:'what');}}>
        <TextField label="Borrower’s full name" visible="Full name" error={errors.borrowerName?.message}><input {...register('borrowerName')} autoComplete="name" aria-invalid={!!errors.borrowerName}/></TextField>
        <TextField label={demo?'Email or phone number':'Email address'} error={errors.borrowerContact?.message}><input {...register('borrowerContact')} type={demo?'text':'email'} autoComplete="email" aria-invalid={!!errors.borrowerContact} placeholder={demo?'ahmad@example.test':'name@example.com'}/></TextField>
        <button type="submit" className="button button-primary sign-primary">{done.what||skipPurpose?'Done':'Next: what it’s for'}</button>
      </form>
    </Panel>
    <Panel open={sheet==='what'} onOpenChange={o=>setSheet(o?'what':null)} title="What’s it for?" description="A few words help you both remember. You can leave it out.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();setSkipPurpose(false);void step(['purpose'],'what',done.how?null:'how');}}>
        <TextField label="Purpose (optional)" error={errors.purpose?.message}><input {...register('purpose')} maxLength={200} placeholder="their shop rent"/></TextField>
        <button type="submit" className="button button-primary sign-primary">{done.how?'Done':'Next: how they repay'}</button>
        <button type="button" className="button button-secondary sign-secondary" onClick={()=>{setValue('purpose','');setSkipPurpose(true);setDone(d=>({...d,what:true}));setSheet(done.how?null:'how');}}>Leave it out</button>
      </form>
    </Panel>
    <Panel open={sheet==='how'} onOpenChange={o=>setSheet(o?'how':null)} title="How will they repay?" description="You can change this together later.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();void step(howFields,'how',null);}}>
        <fieldset className="create-plans" role="radiogroup" aria-label="Repayment structure">
          {([['SINGLE','All at once','One repayment on a date'],['MONTHLY','Monthly','Equal parts each month'],['WEEKLY','Weekly','Equal parts each week'],['CUSTOM','My own dates','Set each part yourself']] as const).map(([value,title,detail])=><label key={value} className="create-plan"><input type="radio" value={value} {...register('repaymentPlan')}/><span className="create-plan-dot" aria-hidden/><span><strong>{title}</strong><small>{detail}</small></span></label>)}
        </fieldset>
        {values.repaymentPlan==='SINGLE'&&<TextField label="Repay by" error={errors.dueDate?.message}><input {...register('dueDate')} type="date" min={values.agreementDate}/></TextField>}
        {['WEEKLY','MONTHLY'].includes(values.repaymentPlan)&&<div className="create-pair">
          <TextField label="Parts" error={errors.paymentCount?.message}><input {...register('paymentCount')} type="number" min="2" max="60" step="1" inputMode="numeric"/></TextField>
          <TextField label="First part" error={errors.firstPaymentDate?.message}><input {...register('firstPaymentDate')} type="date" min={values.agreementDate}/></TextField>
        </div>}
        {values.repaymentPlan==='CUSTOM'&&<div className="create-custom">{custom.fields.map((field,index)=>{const amount=register(`customPayments.${index}.amount`);return <div className="create-part" key={field.id} role="group" aria-labelledby={`part-${index}`}>
          <p className="create-part-title" id={`part-${index}`}>Payment {index+1}</p>
          <div className="create-part-fields">
          <TextField label={`Payment ${index+1} date`} visible="Date" error={errors.customPayments?.[index]?.dueDate?.message}><input {...register(`customPayments.${index}.dueDate`)} type="date" min={values.agreementDate}/></TextField>
          <TextField label={`Payment ${index+1} amount (${values.currency})`} visible={`Amount (${values.currency})`} error={errors.customPayments?.[index]?.amount?.message}><input {...amount} onChange={e=>{formatMoneyChange(e);void amount.onChange(e);}} inputMode="decimal"/></TextField>
          </div>
        </div>;})}
          <div className="create-custom-actions">
            <button type="button" className="kit-link detail-link-button" disabled={custom.fields.length>=60} onClick={()=>custom.append({dueDate:'',amount:''})}>+ Add a part</button>
            {custom.fields.length>2&&<button type="button" className="kit-link detail-link-button" onClick={()=>custom.remove(custom.fields.length-1)}>Remove the last part</button>}
            <button type="button" className="kit-link detail-link-button" onClick={()=>{try{const g=recurringPlan(parseMoney(values.amount),values.customPayments[0]?.dueDate||values.agreementDate,custom.fields.length,'MONTHLY');setValue('customPayments',g.payments.map(p=>({dueDate:p.dueDate,amount:groupMoneyInput(moneyInput(p.amountMinor))})),{shouldValidate:true});}catch(e){setError((e as Error).message);}}}>Split equally each month</button>
          </div>
        </div>}
        <ErrorMessage message={errors.repaymentPlan?.message??''}/>
        {preview&&preview.installments&&<p className="create-summary">{summary(preview)}</p>}
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='witness'} onOpenChange={o=>setSheet(o?'witness':null)} title="Who will witness it?" description="Witnesses confirm they’ve read the terms and agree to witness them. They don’t guarantee repayment.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();const w={name:witnessDraft.name.trim(),contact:witnessDraft.contact.trim()};if(w.name.length<2){setWitnessError('Enter the witness’s full name.');return;}if(!/^\S+@\S+\.\S+$/.test(w.contact)&&!(demo&&/^\+[1-9]\d{7,14}$/.test(w.contact))){setWitnessError(demo?'Enter an email or a phone number with country code.':'Enter the witness’s email address.');return;}setWitnesses(list=>editing===null?[...list,w].slice(0,2):list.map((x,i)=>i===editing?w:x));setSheet(null);}}>
        <TextField label="Witness’s full name" visible="Full name"><input value={witnessDraft.name} onChange={e=>setWitnessDraft(d=>({...d,name:e.target.value}))} autoComplete="off" maxLength={120}/></TextField>
        <TextField label={demo?'Witness’s email or phone number':'Witness’s email address'} visible={demo?'Email or phone':'Email address'}><input value={witnessDraft.contact} onChange={e=>setWitnessDraft(d=>({...d,contact:e.target.value}))} type={demo?'text':'email'} autoComplete="off" placeholder={demo?'maryam@example.test':'name@example.com'}/></TextField>
        <ErrorMessage message={witnessError}/>
        <button type="submit" className="button button-primary sign-primary">{editing===null?'Add witness':'Save witness'}</button>
        {editing!==null?<button type="button" className="button sign-tertiary" onClick={()=>{setWitnesses(list=>list.filter((_,i)=>i!==editing));setSheet(null);}}>Remove this witness</button>:witnesses.length>0&&<button type="button" className="button sign-tertiary" onClick={()=>{setWitnesses([]);setSheet(null);}}>Remove witnesses</button>}
      </form>
    </Panel>
    <Panel open={sheet==='note'} onOpenChange={o=>setSheet(o?'note':null)} title="Anything else?" description="Add anything you’ve both agreed. Keep it interest-free.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();void trigger(['additionalTerms']).then(ok=>{if(ok)setSheet(null);});}}>
        <label className="sr-only" htmlFor="create-note">Additional agreed terms (optional)</label>
        <textarea id="create-note" className="ask-text" rows={4} maxLength={5000} {...register('additionalTerms')} placeholder="Early repayment is welcome. If things change, we’ll talk."/>
        <InterestWordingWarning words={interestWording('',values.additionalTerms)} reader="LENDER"/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
  </div>;
}

const W=({children}:{children:ReactNode})=><span className="create-word">{children}</span>;
const BackIcon=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5.5M11 6l-6 6 6 6"/></svg>;
function purposeText(purpose:string){const t=purpose.trim().replace(/\.$/,'');return t.charAt(0).toLowerCase()+t.slice(1);}
function howText(v:Values,t?:ReturnType<typeof formTerms>){
  if(v.repaymentPlan==='SINGLE')return 'it all';
  const plan=t?.installments?.payments??[];if(!plan.length)return 'in parts';
  const same=plan.every(p=>p.amountMinor===plan[0].amountMinor);
  if(v.repaymentPlan==='CUSTOM'||!same)return `in ${plan.length} parts`;
  return `${money(plan[0].amountMinor,v.currency)} a ${v.repaymentPlan==='WEEKLY'?'week':'month'}`;
}
function whenText(v:Values,t?:ReturnType<typeof formTerms>){const d=v.repaymentPlan==='SINGLE'?v.dueDate:t?.installments?.payments[0]?.dueDate;return d?formatDate(d):'when';}
function summary(t:ReturnType<typeof formTerms>){
  const plan=t.installments!.payments,same=plan.every(p=>p.amountMinor===plan[0].amountMinor),last=short(plan.at(-1)!.dueDate);
  return same?`${plan.length} × ${money(plan[0].amountMinor,t.currency)} = ${money(t.principalMinor,t.currency)} · last part ${last}`:`${plan.length} parts = ${money(t.principalMinor,t.currency)} · last part ${last}`;
}
function TextField({label,visible,error,children}:{label:string;visible?:string;error?:string;children:React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>}){
  return <label className="create-field"><span className="create-field-label" aria-hidden={visible?true:undefined}>{visible??label}</span>{visible&&<span className="sr-only">{label}</span>}{children}{error&&<span className="error-message create-field-error" role="alert">{error}</span>}</label>;
}

/** Big amount with a keypad on touch screens; a normal text field elsewhere. */
function AmountField({register,setValue,currency,error}:{register:ReturnType<typeof useForm<Values>>['register'];setValue:ReturnType<typeof useForm<Values>>['setValue'];currency:string;error?:string}){
  const field=register('amount'),[coarse,setCoarse]=useState(false);
  useEffect(()=>{const m=window.matchMedia('(pointer: coarse)');setCoarse(m.matches);const f=()=>setCoarse(m.matches);m.addEventListener('change',f);return()=>m.removeEventListener('change',f);},[]);
  const [raw,setRaw]=useState('');
  function press(key:string){const next=key==='back'?raw.slice(0,-1):key==='.'?(raw.includes('.')?raw:(raw||'0')+'.'):/\.\d{2}$/.test(raw)?raw:(raw==='0'?key:raw+key);setRaw(next);setValue('amount',next?groupMoneyInput(next):'',{shouldDirty:true});}
  const sign=currency==='NGN'?'₦':currency;
  return <div className="create-amount">
    <label className="create-amount-row"><span className="create-amount-sign" aria-hidden>{sign}</span><input {...field} onChange={e=>{formatMoneyChange(e);setRaw(e.target.value.replace(/,/g,''));void field.onChange(e);}} aria-label="Principal amount" aria-invalid={!!error} inputMode={coarse?'none':'decimal'} placeholder="0" autoComplete="off"/></label>
    {error&&<span className="error-message create-field-error" role="alert">{error}</span>}
    {coarse&&<div className="create-keypad" role="group" aria-label="Keypad">{['1','2','3','4','5','6','7','8','9','.','0','back'].map(k=><button key={k} type="button" onClick={()=>press(k)} aria-label={k==='back'?'Delete':k==='.'?'Decimal point':k}>{k==='back'?'⌫':k}</button>)}</div>}
  </div>;
}

/** After signing: hand each person their own private link. */
function ShareStep({a,invitation,witnesses,borrowerName,base}:{a:Aggregate;invitation?:InvitationLinkData;witnesses:Witness[];borrowerName:string;base:string}){
  const [shared,setShared]=useState(false),[copied,setCopied]=useState(false),[error,setError]=useState('');
  const url=invitation?new URL(invitation.url,window.location.origin).href:'';
  async function share(){
    if(!url)return;const text=`I’ve written down our agreement on treeti. Please review it here: ${url}`;
    try{const native=typeof navigator.share==='function';if(native){await navigator.share({text});}else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');setShared(true);track('invitation_shared',{method:native?'native':'whatsapp'});}catch{/* closing the share sheet is fine */}
  }
  async function copy(){try{await navigator.clipboard.writeText(url);setCopied(true);track('invitation_shared',{method:'copy'});}catch{setError('Copy is unavailable. Use Share link instead.');}}
  const first=firstName(borrowerName);
  return <>
    <Heading plain title="Send it to everyone" sub="You’ve signed. Each person gets their own private link."/>
    <ul className="sign-card create-share">
      <li><Avatar name={borrowerName} size={32}/><span><strong>{borrowerName}</strong><small>Borrower · reads and signs</small></span>{shared?<span className="create-shared"><Check size={14} aria-hidden/>Shared</span>:<button type="button" className="create-share-button" data-invite-url={invitation?.url} onClick={()=>void share()} aria-label={`Share link with ${borrowerName}`}><Share2 size={15} aria-hidden/>Share link</button>}</li>
      {witnesses.map(w=><li key={w.contact}><Avatar name={w.name} size={32}/><span><strong>{w.name}</strong><small>Witness · after {first} signs</small></span><span className="create-later">Link comes later</span></li>)}
    </ul>
    <p className="create-share-note">{witnesses.length?`${first} reads and signs first. Then you invite your witnesses from the agreement, and their names are already filled in.`:`If ${first} asks for a change, the new version comes back to you to sign again.`}</p>
    <ErrorMessage message={error}/>
    <p className="sr-only" role="status">{copied?'Invitation link copied.':''}</p>
    <div className="sign-actions">
      <Link className="button button-primary sign-primary" href={`${base}/agreements/${a.id}`}>Done</Link>
      <button type="button" className="button sign-tertiary" onClick={()=>void copy()}>{copied?<><Check size={16} aria-hidden/>Link copied</>:<><Copy size={16} aria-hidden/>Copy link</>}</button>
    </div>
  </>;
}

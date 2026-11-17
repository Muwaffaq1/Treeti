'use client';
// Investment agreements (owner, Nov 2026): partners write one sentence together, each signs the same version,
// and once everyone has signed each partner gets the shared investment in their own records.
// Built from the loan agreement screens: blanks, one promise, hold to sign, then a private link for each person.
import Link from '@/components/app-link';
import {useRouter} from 'next/navigation';
import {Fragment,useState,type ReactNode} from 'react';
import {calendarDate} from '@/lib/calendar';
import {currencies,currencyNames} from '@/lib/currencies';
import {groupMoneyInput,money,moneyInput,parseMoney} from '@/lib/money';
import {maskContact} from '@/lib/contact';
import type {Actor} from '@/modules/agreements/types';
import type {View} from '@/modules/investment-agreements/model';
import {partnerAffirmation,partnerLimit,witnessAffirmation,witnessLimit} from '@/modules/investment-agreements/shared';
import {api,apiBase,appBase} from './client-api';
import {formatDate,interestWording} from './agreement-utils';
import {InterestWordingWarning} from './create-agreement';
import {AmountInput,W} from './record-blanks';
import {Avatar,Blank,Panel,Tag} from './kit';
import {Heading,HoldStep,type Style} from './sign-flow';
import {ErrorMessage} from './ui';
import {ArrowLeft,Check,Copy,Download,Share2,X} from './icons';
import {firstName} from './person-colour';

export type JointSummary=View&{turn:'sign'|'witness'|'revise'|null};
type Link={personId:string;name:string;role:'PARTNER'|'WITNESS';url:string};
type Person={name:string;contact:string};
type Sheet='what'|'who'|'money'|'when'|'manager'|'review'|'exit'|'note'|'witness'|null;
type Stage='write'|'promise'|'hold'|'share';

const currencyLabel=(c:string)=>c==='NGN'?'₦ Naira':`${c} · ${currencyNames[c as keyof typeof currencyNames]}`;
const minor=(v:string)=>{try{return parseMoney(v);}catch{return '';}};
const toInput=(m:string)=>groupMoneyInput(moneyInput(m));
const names=(items:string[])=>new Intl.ListFormat('en-GB',{style:'long',type:'conjunction'}).format(items);
const validContact=(c:string,demo:boolean)=>/^\S+@\S+\.\S+$/.test(c)||(demo&&/^\+[1-9]\d{7,14}$/.test(c));
const latestOf=(a:View)=>a.versions.find(v=>v.id===a.currentVersionId)!;
const statusTag:Record<View['status'],[string,'action'|'positive'|'neutral']>={AWAITING_SIGNATURES:['Waiting for signatures','action'],CHANGES_REQUESTED:['Change asked for','action'],AWAITING_WITNESSES:['Waiting for witnesses','action'],ACTIVE:['Signed by everyone','positive'],DECLINED:['Declined','neutral'],CANCELLED:['Cancelled','neutral']};

function TextField({label,visible,children}:{label:string;visible?:string;children:ReactNode}){
  return <label className="create-field"><span className="create-field-label" aria-hidden={!!visible}>{visible??label}</span>{visible&&<span className="sr-only">{label}</span>}{children}</label>;
}
function Promise_({text,checked,onChange,actor}:{text:string;checked:boolean;onChange:(v:boolean)=>void;actor:Actor}){
  return <>
    <label className="sign-promise"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="sign-promise-box" aria-hidden><Check size={14}/></span><span>{text}</span></label>
    <dl className="sign-card sign-facts sign-identity"><div><dt>Your name</dt><dd><span>{actor.name}</span></dd></div>{actor.contacts[0]&&<div><dt>Signed as</dt><dd>{maskContact(actor.contacts[0])}</dd></div>}</dl>
  </>;
}

/** Write a new investment agreement, or change the terms of one that's still being signed (`existing`). */
export function JointCreate({actor,demo,existing}:{actor:Actor;demo:boolean;existing?:JointSummary}){
  const router=useRouter(),base=appBase(demo),v=existing?latestOf(existing):null;
  const stakeOf=(id:string)=>v!.stakes.find(s=>s.partnerId===id)!;
  const meId=existing?.partners.find(p=>p.creator)?.id;
  const [venture,setVenture]=useState(v?.terms.venture??''),[currency,setCurrency]=useState<string>(v?.terms.currency??'NGN');
  const [startDate,setStartDate]=useState(v?.terms.startDate??calendarDate()),[reviewDate,setReviewDate]=useState(v?.terms.reviewDate??'');
  const [manager,setManager]=useState(v?.terms.manager??''),[exit,setExit]=useState(v?.terms.exit??''),[note,setNote]=useState(v?.terms.note??'');
  const [people,setPeople]=useState<Person[]>(existing?existing.partners.filter(p=>!p.creator).map(p=>({name:p.name,contact:p.contact})):[]);
  const [amounts,setAmounts]=useState<string[]>(existing?[stakeOf(meId!).capitalMinor,...existing.partners.filter(p=>!p.creator).map(p=>stakeOf(p.id).capitalMinor)].map(toInput):['']);
  const [witnesses,setWitnesses]=useState<Person[]>([]);
  const [done,setDone]=useState({what:!!existing,who:!!existing,money:!!existing,when:!!existing});
  const [sheet,setSheet]=useState<Sheet>(null),[stage,setStage]=useState<Stage>('write'),[panelError,setPanelError]=useState('');
  const [draftPerson,setDraftPerson]=useState<Person>({name:'',contact:''});
  const [affirmed,setAffirmed]=useState(false),[style,setStyle]=useState<Style>('script'),[error,setError]=useState('');
  const [sent,setSent]=useState<{a:JointSummary;links:Link[]}|null>(null),[key]=useState(()=>crypto.randomUUID());
  const everyone=[actor.name,...people.map(p=>p.name)];
  const ready=done.what&&done.who&&done.money&&done.when;
  const nextBlank:Sheet=!done.what?'what':!done.who?'who':!done.money?'money':!done.when?'when':null,focus=sheet??nextBlank;
  const state=(s:Exclude<Sheet,null>,filled:boolean)=>focus===s?'current':filled?'filled':'empty';
  const open=(s:Sheet)=>{setPanelError('');setSheet(s);};
  const finish=(key:keyof typeof done,next:Sheet)=>{setDone(d=>({...d,[key]:true}));setPanelError('');setSheet(ready?null:next);};

  function savePeople(list:Person[]){
    setPeople(list);
    setAmounts(a=>[a[0]??'',...list.map((_,i)=>a[i+1]??'')]);
    if(manager&&!list.some(p=>p.name===manager)&&manager!==actor.name)setManager('');
  }
  function body(){
    const terms={venture:venture.trim(),currency,startDate,reviewDate:reviewDate||null,manager:manager||null,exit:exit.trim(),note:note.trim()};
    const stakes=amounts.map(a=>({capitalMinor:minor(a)}));
    if(existing){const others=existing.partners.filter(p=>!p.creator);return {expectedVersionId:existing.currentVersionId,terms,stakes:[{partnerId:meId!,...stakes[0]},...others.map((p,i)=>({partnerId:p.id,...stakes[i+1]}))],signature:actor.name,affirmed:true};}
    return {terms,me:stakes[0],partners:people.map((p,i)=>({...p,...stakes[i+1]})),witnesses,signature:actor.name,affirmed:true};
  }
  async function submit(){
    setError('');
    try{
      if(existing){await api(`${apiBase(demo)}/joint/${existing.id}/revise`,body(),key);router.push(`${base}/investments/agreements/${existing.id}`);router.refresh();return;}
      const r=await api<{agreement:JointSummary;links:Link[]}>(`${apiBase(demo)}/joint`,body(),key);
      setSent({a:r.agreement,links:r.links});setStage('share');
    }catch(e){setError((e as Error).message);setStage('write');}
  }

  const stageIndex={write:0,promise:1,hold:1,share:2}[stage];
  const back=stage==='promise'?()=>setStage('write'):stage==='hold'?()=>setStage('promise'):null;
  const close=existing?`${base}/investments/agreements/${existing.id}`:sent?`${base}/investments/agreements/${sent.a.id}`:`${base}/investments`;
  return <div className="sign-flow create-flow">
    <header className="sign-bar">
      {back?<button type="button" className="detail-icon-button" aria-label="Back" onClick={back}><ArrowLeft size={18} aria-hidden/></button>:<Link className="detail-icon-button" href={close} aria-label="Close"><X size={18} aria-hidden/></Link>}
      <p className="sign-kicker">{sent?sent.a.publicId:existing?`Change ${existing.publicId}`:'New investment agreement'}</p>
      <ol className="sign-steps" aria-label={`Step ${stageIndex+1} of 3`}>{[0,1,2].map(i=><li key={i} className={i<=stageIndex?'on':''}/>)}</ol>
    </header>
    <div className="sign-body">
      {stage==='write'&&<>
        <Heading plain title={ready?'Read it back':'Write it down'} sub={ready?'Tap anything to change it.':'Tap each blank. It reads like you’d say it.'}/>
        <p className="create-sentence">
          <W>I’m going into</W> <Blank state={state('what',done.what)} label={done.what?`Investment: ${venture}. Change`:'Say what you’re investing in'} onClick={()=>open('what')}>{done.what?venture:'what'}</Blank>{' '}
          <W>with</W> <span className="create-nowrap"><Blank state={state('who',done.who)} label={done.who?`Partners: ${names(people.map(p=>p.name))}. Change`:'Add who you’re investing with'} onClick={()=>open(existing?null:'who')}>{done.who?names(people.map(p=>p.name)):'who'}</Blank><W>.</W></span>{' '}
          {done.who?<>
            <W>I’m putting in</W> <Blank state={state('money',done.money)} label="Change how much each person puts in" onClick={()=>open('money')}>{done.money?money(minor(amounts[0])||'0',currency):'how much'}</Blank>
            {people.map((p,i)=>{const last=i===people.length-1,blank=<Blank state={state('money',done.money)} label="Change how much each person puts in" onClick={()=>open('money')}>{done.money?money(minor(amounts[i+1])||'0',currency):'how much'}</Blank>;return <Fragment key={i}><W>{last?' and ':', '}{firstName(p.name)} is putting in</W> {last?<span className="create-nowrap">{blank}<W>.</W></span>:blank}</Fragment>;})}{' '}
          </>:<><W>We each put in</W> <span className="create-nowrap"><Blank state={state('money',false)} label="Add how much each person puts in" onClick={()=>open(done.who?'money':'who')}>how much</Blank><W>.</W></span>{' '}</>}
          <W>We start on</W> <span className="create-nowrap"><Blank state={state('when',done.when)} label={`Start date: ${formatDate(startDate)}. Change`} onClick={()=>open('when')}>{done.when?formatDate(startDate):'when'}</Blank><W>.</W></span>
          {ready&&manager&&<>{' '}<Blank state="filled" label={`Looked after by ${manager}. Change`} onClick={()=>open('manager')}>{manager===actor.name?'I':manager}</Blank> <W>{manager===actor.name?'look':'looks'} after it day to day.</W></>}
          {ready&&reviewDate&&<>{' '}<W>We’ll review it on</W> <span className="create-nowrap"><Blank state="filled" label={`Review date: ${formatDate(reviewDate)}. Change`} onClick={()=>open('review')}>{formatDate(reviewDate)}</Blank><W>.</W></span></>}
          {witnesses.length>0&&<>{' '}<span className="create-witnessed">Witnessed by</span> <Blank state="filled" label={`Witnesses: ${names(witnesses.map(w=>w.name))}. Change`} onClick={()=>open('witness')}>{names(witnesses.map(w=>w.name))}</Blank><W>.</W></>}
        </p>
        {ready&&<div className="create-links">
          <button type="button" className="kit-link detail-link-button" onClick={()=>open('manager')}>{manager?'Change who looks after it':'+ Who looks after it?'}</button>
          {!reviewDate&&<button type="button" className="kit-link detail-link-button" onClick={()=>open('review')}>+ Add a review date</button>}
          <button type="button" className="kit-link detail-link-button" onClick={()=>open('exit')}>{exit.trim()?'Edit how someone can leave':'+ If someone wants to leave'}</button>
          <button type="button" className="kit-link detail-link-button" onClick={()=>open('note')}>{note.trim()?'Edit your note':'+ Anything else? Add a note'}</button>
          {!existing&&witnesses.length<witnessLimit&&<button type="button" className="kit-link detail-link-button" onClick={()=>{setDraftPerson({name:'',contact:''});open('witness');}}>{witnesses.length?'+ Add another witness':'+ Add witnesses (optional)'}</button>}
        </div>}
        <InterestWordingWarning words={interestWording(exit,note)} reader="LENDER"/>
        <ErrorMessage message={error}/>
        <div className="sign-actions">
          <button type="button" className="button button-primary sign-primary" disabled={!ready} onClick={()=>{setAffirmed(false);setStage('promise');}}>Review and sign</button>
          <p className="sign-note">{ready?existing?'Everyone signs the new version again.':'Next: read it, promise, hold to sign, then share':'Fill the blanks to continue'}</p>
        </div>
      </>}
      {stage==='promise'&&<>
        <Heading plain title="One promise first" sub="Every partner makes the same promise."/>
        <Promise_ text={partnerAffirmation} checked={affirmed} onChange={setAffirmed} actor={actor}/>
        <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={!affirmed} onClick={()=>setStage('hold')}>Continue to sign</button></div>
      </>}
      {stage==='hold'&&<HoldStep plain name={actor.name} style={style} onStyle={setStyle} onDone={submit}/>}
      {stage==='share'&&sent&&<ShareLinks links={sent.links} title="Send it to everyone" sub="You’ve signed. Each person gets their own private link." doneHref={`${base}/investments/agreements/${sent.a.id}`}/>}
    </div>

    <Panel open={sheet==='what'} onOpenChange={o=>setSheet(o?'what':null)} title="What are you investing in?" description="A name you’ll all recognise.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(venture.trim().length<2){setPanelError('Say what you’re investing in.');return;}finish('what',done.who?null:'who');}}>
        <TextField label="Investment"><input value={venture} onChange={e=>setVenture(e.target.value)} maxLength={120} placeholder="Our shop in Kano" autoComplete="off"/></TextField>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">{done.who?'Done':'Next: who'}</button>
      </form>
    </Panel>
    <Panel open={sheet==='who'} onOpenChange={o=>setSheet(o?'who':null)} title="Who are you investing with?" description={`Up to ${partnerLimit-1} people. Each gets a private link to read and sign.`}>
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();
        const draft={name:draftPerson.name.trim(),contact:draftPerson.contact.trim().toLowerCase()};
        let list=people;
        if(draft.name||draft.contact){
          if(draft.name.length<2){setPanelError('Enter their full name.');return;}
          if(!validContact(draft.contact,demo)){setPanelError(demo?'Enter their email or a phone number with country code.':'Enter their email address, such as name@example.com.');return;}
          if([...people.map(p=>p.contact),...actor.contacts].includes(draft.contact)){setPanelError('Each person needs their own email.');return;}
          list=[...people,draft];setDraftPerson({name:'',contact:''});
        }
        if(!list.length){setPanelError('Add at least one person.');return;}
        savePeople(list);finish('who',done.money?null:'money');}}>
        {people.length>0&&<ul className="joint-people">{people.map((p,i)=><li key={p.contact}><Avatar name={p.name} size={32}/><span><strong>{p.name}</strong><small>{p.contact}</small></span><button type="button" className="kit-link detail-link-button" onClick={()=>savePeople(people.filter((_,k)=>k!==i))} aria-label={`Remove ${p.name}`}>Remove</button></li>)}</ul>}
        {people.length<partnerLimit-1&&<>
          <TextField label="Partner’s full name" visible="Full name"><input value={draftPerson.name} onChange={e=>setDraftPerson(d=>({...d,name:e.target.value}))} maxLength={120} autoComplete="off" placeholder="Aisha Suleiman"/></TextField>
          <TextField label={demo?'Partner’s email or phone number':'Partner’s email address'} visible={demo?'Email or phone':'Email address'}><input value={draftPerson.contact} onChange={e=>setDraftPerson(d=>({...d,contact:e.target.value}))} type={demo?'text':'email'} autoComplete="off" placeholder={demo?'aisha@example.test':'name@example.com'}/></TextField>
          {people.length>0&&people.length<partnerLimit-2&&<p className="record-hint">Fill these in to add another person, or tap Done.</p>}
        </>}
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">{draftPerson.name||draftPerson.contact?people.length?'Add and continue':'Add and continue':done.money?'Done':'Next: how much'}</button>
      </form>
    </Panel>
    <Panel open={sheet==='money'} onOpenChange={o=>setSheet(o?'money':null)} title="How much does each person put in?" description="Losses are shared by these amounts.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(amounts.some(a=>!minor(a))){setPanelError('Enter an amount for each person, greater than zero.');return;}finish('money',done.when?null:'when');}}>
        <label className="create-currency"><span className="sr-only">Currency</span><span className="create-currency-face" aria-hidden>{currencyLabel(currency)}</span><select aria-label="Currency" value={currency} onChange={e=>setCurrency(e.target.value)} disabled={!!existing}>{currencies.map(c=><option key={c} value={c}>{currencyLabel(c)}</option>)}</select></label>
        {everyone.map((n,i)=><div key={i} className="joint-amount"><span className="create-field-label">{i===0?'You':n}</span><AmountInput label={`Amount ${i===0?'you put':`${n} puts`} in (${currency})`} value={amounts[i]??''} onChange={v=>setAmounts(a=>a.map((x,k)=>k===i?v:x))} currency={currency}/></div>)}
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">{done.when?'Done':'Next: start date'}</button>
      </form>
    </Panel>
    <Panel open={sheet==='when'} onOpenChange={o=>setSheet(o?'when':null)} title="When does it start?" description="The day the money goes in.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(!startDate){setPanelError('Choose a start date.');return;}finish('when',null);}}>
        <TextField label="Start date"><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></TextField>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='manager'} onOpenChange={o=>setSheet(o?'manager':null)} title="Who looks after it?" description="Who runs it day to day and keeps everyone informed.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();setSheet(null);}}>
        <fieldset className="create-plans" aria-label="Who looks after it">
          {[['', 'All of us together'],...everyone.map(n=>[n,n===actor.name?'Me':n])].map(([value,text])=><label key={value||'together'} className="create-plan"><input type="radio" name="manager" checked={manager===value} onChange={()=>setManager(value)}/><span className="create-plan-dot" aria-hidden/><span><strong>{text}</strong></span></label>)}
        </fieldset>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='review'} onOpenChange={o=>setSheet(o?'review':null)} title="When will you review it?" description="A date to sit down and look at how it’s going.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(reviewDate&&reviewDate<=startDate){setPanelError('Choose a review date after the start date.');return;}setSheet(null);}}>
        <TextField label="Review date (optional)"><input type="date" value={reviewDate} min={startDate} onChange={e=>setReviewDate(e.target.value)}/></TextField>
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
        {reviewDate&&<button type="button" className="button sign-tertiary" onClick={()=>{setReviewDate('');setSheet(null);}}>Remove the review date</button>}
      </form>
    </Panel>
    <Panel open={sheet==='exit'} onOpenChange={o=>setSheet(o?'exit':null)} title="If someone wants to leave" description="How much notice, and how their money comes back.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();setSheet(null);}}>
        <label className="sr-only" htmlFor="joint-exit">How a partner can leave (optional)</label>
        <textarea id="joint-exit" className="ask-text" rows={4} maxLength={1000} value={exit} onChange={e=>setExit(e.target.value)} placeholder="Give the others 3 months’ notice. They can buy your share at its value then."/>
        <InterestWordingWarning words={interestWording(exit,'')} reader="LENDER"/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='note'} onOpenChange={o=>setSheet(o?'note':null)} title="Anything else?" description="Add anything else you’ve all agreed.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();setSheet(null);}}>
        <label className="sr-only" htmlFor="joint-note">Other agreed terms (optional)</label>
        <textarea id="joint-note" className="ask-text" rows={4} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="We’ll share a monthly update in our group chat."/>
        <InterestWordingWarning words={interestWording('',note)} reader="LENDER"/>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
    <Panel open={sheet==='witness'} onOpenChange={o=>setSheet(o?'witness':null)} title="Who will witness it?" description="Witnesses confirm the partners agreed. They don’t guarantee any money.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();
        const w={name:draftPerson.name.trim(),contact:draftPerson.contact.trim().toLowerCase()};
        if(!w.name&&!w.contact){setSheet(null);return;}
        if(w.name.length<2){setPanelError('Enter the witness’s full name.');return;}
        if(!validContact(w.contact,demo)){setPanelError(demo?'Enter their email or a phone number with country code.':'Enter the witness’s email address.');return;}
        if([...people.map(p=>p.contact),...witnesses.map(x=>x.contact),...actor.contacts].includes(w.contact)){setPanelError('A witness can’t be a partner, and each person needs their own email.');return;}
        setWitnesses(list=>[...list,w].slice(0,witnessLimit));setDraftPerson({name:'',contact:''});setSheet(null);}}>
        {witnesses.length>0&&<ul className="joint-people">{witnesses.map((w,i)=><li key={w.contact}><Avatar name={w.name} size={32}/><span><strong>{w.name}</strong><small>{w.contact}</small></span><button type="button" className="kit-link detail-link-button" onClick={()=>setWitnesses(list=>list.filter((_,k)=>k!==i))} aria-label={`Remove ${w.name}`}>Remove</button></li>)}</ul>}
        {witnesses.length<witnessLimit&&<>
          <TextField label="Witness’s full name" visible="Full name"><input value={draftPerson.name} onChange={e=>setDraftPerson(d=>({...d,name:e.target.value}))} maxLength={120} autoComplete="off" placeholder="Maryam Bello"/></TextField>
          <TextField label={demo?'Witness’s email or phone number':'Witness’s email address'} visible={demo?'Email or phone':'Email address'}><input value={draftPerson.contact} onChange={e=>setDraftPerson(d=>({...d,contact:e.target.value}))} type={demo?'text':'email'} autoComplete="off" placeholder={demo?'maryam@example.test':'name@example.com'}/></TextField>
        </>}
        <ErrorMessage message={panelError}/>
        <button type="submit" className="button button-primary sign-primary">{witnesses.length<witnessLimit?'Add witness':'Done'}</button>
      </form>
    </Panel>
  </div>;
}

/** One private link per person: share it (WhatsApp or the phone's share sheet) or copy it. */
function ShareLinks({links,title,sub,doneHref}:{links:Link[];title:string;sub:string;doneHref?:string}){
  const [shared,setShared]=useState<string[]>([]),[copied,setCopied]=useState(''),[error,setError]=useState('');
  const url=(l:Link)=>new URL(l.url,window.location.origin).href;
  async function share(l:Link){
    const text=l.role==='PARTNER'?`I’ve written down our investment agreement on treeti. Please read and sign it here: ${url(l)}`:`Please witness our investment agreement on treeti: ${url(l)}`;
    try{if(typeof navigator.share==='function')await navigator.share({text});else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,'_blank','noopener,noreferrer');setShared(s=>[...s,l.personId]);}catch{/* closing the share sheet is fine */}
  }
  async function copy(l:Link){try{await navigator.clipboard.writeText(url(l));setCopied(l.personId);}catch{setError('Copy is unavailable. Use Share link instead.');}}
  return <>
    <Heading plain title={title} sub={sub}/>
    <ul className="sign-card create-share">{links.map(l=><li key={l.personId}><Avatar name={l.name} size={32}/><span><strong>{l.name}</strong><small>{l.role==='PARTNER'?'Partner · reads and signs':'Witness · after the partners sign'}</small></span>
      <span className="joint-share-actions">{shared.includes(l.personId)?<span className="create-shared"><Check size={14} aria-hidden/>Shared</span>:<button type="button" className="create-share-button" data-invite-url={l.url} onClick={()=>void share(l)} aria-label={`Share link with ${l.name}`}><Share2 size={15} aria-hidden/>Share link</button>}
        <button type="button" className="create-share-button" onClick={()=>void copy(l)} aria-label={`Copy link for ${l.name}`}>{copied===l.personId?<Check size={15} aria-hidden/>:<Copy size={15} aria-hidden/>}</button></span></li>)}</ul>
    <p className="create-share-note">If anyone asks for a change, the new version comes back to you, and everyone signs it again.</p>
    <ErrorMessage message={error}/>
    <p className="sr-only" role="status">{copied?'Link copied.':''}</p>
    {doneHref&&<div className="sign-actions"><Link className="button button-primary sign-primary" href={doneHref}>Done</Link></div>}
  </>;
}

/** The agreement as each person sees it: who's in, what they put in, who has signed, and what to do next. */
export function JointDetail({initial,actor,demo}:{initial:JointSummary;actor:Actor;demo:boolean}){
  const router=useRouter(),base=appBase(demo);
  const [a,setA]=useState(initial),[stage,setStage]=useState<'view'|'promise'|'hold'>('view');
  const [affirmed,setAffirmed]=useState(false),[style,setStyle]=useState<Style>('script'),[error,setError]=useState('');
  const [ask,setAsk]=useState<'change'|'decline'|'cancel'|null>(null),[askNote,setAskNote]=useState(''),[busy,setBusy]=useState(false),[links,setLinks]=useState<Link[]>([]);
  const v=latestOf(a),t=v.terms,me=a.partners.find(p=>p.id===a.me.personId);
  const signed=(id:string)=>a.signatures.some(s=>s.partnerId===id&&s.versionId===v.id),witnessed=(id:string)=>a.attestations.some(s=>s.witnessId===id&&s.versionId===v.id);
  const open=['AWAITING_SIGNATURES','CHANGES_REQUESTED','AWAITING_WITNESSES'].includes(a.status);
  const request=a.status==='CHANGES_REQUESTED'?a.changeRequests.at(-1):undefined;
  const nameOf=(id:string|null)=>[...a.partners,...a.witnesses].find(p=>p.id===id)?.name??'';
  async function run(action:string,data:Record<string,unknown>){
    setBusy(true);setError('');
    try{const r=await api<{agreement:JointSummary;links:Link[]}>(`${apiBase(demo)}/joint/${a.id}/${action}`,data,crypto.randomUUID());setA(r.agreement);if(r.links.length)setLinks(r.links);setAsk(null);setAskNote('');setStage('view');router.refresh();}
    catch(e){setError((e as Error).message);setStage('view');}
    finally{setBusy(false);}
  }
  const waitingOn=a.partners.filter(p=>!signed(p.id)).map(p=>p.id===a.me.personId?'you':firstName(p.name));
  const statusLine=a.status==='ACTIVE'?`Signed by everyone on ${formatDate(a.finalizedAt!.slice(0,10))}.`
    :a.status==='DECLINED'?`${nameOf(a.closedBy)} declined this agreement.${a.closedNote?` “${a.closedNote}”`:''}`
    :a.status==='CANCELLED'?`${a.closedBy===a.me.personId?'You':nameOf(a.closedBy)} cancelled this agreement.`
    :a.status==='CHANGES_REQUESTED'?`${nameOf(request!.partnerId)} asked for a change: “${request!.note}”`
    :a.status==='AWAITING_WITNESSES'?`Every partner has signed. Waiting for ${names(a.witnesses.filter(w=>!witnessed(w.id)).map(w=>w.id===a.me.personId?'you':firstName(w.name)))} to witness it.`
    :`Waiting for ${names(waitingOn)} to sign.`;
  const [tagText,tagTone]=statusTag[a.status];

  if(stage!=='view')return <div className="sign-flow create-flow">
    <header className="sign-bar"><button type="button" className="detail-icon-button" aria-label="Back" onClick={()=>setStage(stage==='hold'?'promise':'view')}><ArrowLeft size={18} aria-hidden/></button><p className="sign-kicker">{a.publicId}</p><span/></header>
    <div className="sign-body">
      {stage==='promise'&&<>
        <Heading plain title="One promise first" sub={a.me.role==='PARTNER'?'Every partner makes the same promise.':'This is what you’re witnessing.'}/>
        <Promise_ text={a.me.role==='PARTNER'?partnerAffirmation:witnessAffirmation} checked={affirmed} onChange={setAffirmed} actor={actor}/>
        <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={!affirmed} onClick={()=>setStage('hold')}>Continue to sign</button></div>
      </>}
      {stage==='hold'&&<HoldStep plain name={actor.name} style={style} onStyle={setStyle} onDone={()=>run(a.me.role==='PARTNER'?'sign':'witness',{expectedVersionId:a.currentVersionId,signature:actor.name,affirmed:true})}/>}
    </div>
  </div>;

  return <div className="ledger joint">
    <header className="detail-bar notices-bar"><Link className="detail-icon-button" href={`${base}/investments`} aria-label="Investments"><ArrowLeft size={18} aria-hidden/></Link><h1 className="notices-title">Investment agreement</h1><span/></header>
    <section className="joint-hero">
      <p className="kit-overline">{a.publicId} · version {v.number}</p>
      <h2 className="joint-venture">{t.venture}</h2>
      <Tag tone={tagTone}>{tagText}</Tag>
      <p className="joint-status" role="status">{statusLine}</p>
    </section>
    <ErrorMessage message={error}/>
    {links.length>0&&<section className="kit-card joint-links"><ShareLinks links={links} title="New link ready" sub="The old link no longer works. Send this one instead."/></section>}

    <div className="joint-actions">
      {a.turn==='sign'&&<button type="button" className="button button-primary sign-primary" onClick={()=>{setAffirmed(false);setStage('promise');}}>Read and sign</button>}
      {a.turn==='witness'&&<button type="button" className="button button-primary sign-primary" onClick={()=>{setAffirmed(false);setStage('promise');}}>Read and witness</button>}
      {a.me.creator&&open&&a.status!=='AWAITING_WITNESSES'&&<Link className={`button ${a.turn==='revise'?'button-primary sign-primary':'button-secondary sign-secondary'}`} href={`${base}/investments/agreements/${a.id}/edit`}>Change the terms</Link>}
      {a.me.creator&&a.status==='AWAITING_WITNESSES'&&<button type="button" className="button button-secondary sign-secondary" disabled={busy} onClick={()=>void run('finish',{expectedVersionId:a.currentVersionId})}>Finish without waiting for witnesses</button>}
      {a.status==='ACTIVE'&&<><a className="button button-primary sign-primary" href={`${apiBase(demo)}/joint/${a.id}/pdf`} download><Download size={16} aria-hidden/>Download the signed PDF</a><Link className="button button-secondary sign-secondary" href={`${base}/investments`}>See it in your investments</Link></>}
    </div>

    <section className="kit-card joint-facts">
      <dl className="ledger-amounts"><div><dt>Total put in</dt><dd>{money(v.stakes.reduce((s,x)=>s+BigInt(x.capitalMinor),0n).toString(),t.currency)}</dd></div><div><dt>Starts</dt><dd>{formatDate(t.startDate)}</dd></div><div><dt>Looked after by</dt><dd>{t.manager?t.manager===actor.name?'You':t.manager:'Everyone together'}</dd></div></dl>
      <h3 className="kit-overline">Partners</h3>
      <ul className="joint-rows">{a.partners.map(p=>{const s=v.stakes.find(x=>x.partnerId===p.id)!;return <li key={p.id}>
        <Avatar name={p.name} size={32}/>
        <span className="joint-row-main"><strong>{p.id===a.me.personId?`${p.name} (you)`:p.name}</strong><small>Puts in {money(s.capitalMinor,t.currency)}</small></span>
        <span className="joint-row-end">{signed(p.id)?<Tag tone="positive">Signed</Tag>:p.joined?<Tag tone="neutral">Not signed</Tag>:<Tag tone="neutral">Hasn’t opened it</Tag>}
          {a.me.creator&&open&&!p.joined&&<button type="button" className="kit-link detail-link-button" disabled={busy} onClick={()=>void run('renew',{personId:p.id})}>New link</button>}</span>
      </li>;})}</ul>
      {a.witnesses.length>0&&<><h3 className="kit-overline">Witnesses</h3>
        <ul className="joint-rows">{a.witnesses.map(w=><li key={w.id}><Avatar name={w.name} size={32}/><span className="joint-row-main"><strong>{w.id===a.me.personId?`${w.name} (you)`:w.name}</strong><small>Witness</small></span>
          <span className="joint-row-end">{witnessed(w.id)?<Tag tone="positive">Witnessed</Tag>:w.joined?<Tag tone="neutral">Not yet</Tag>:<Tag tone="neutral">Hasn’t opened it</Tag>}
            {a.me.creator&&open&&!w.joined&&<button type="button" className="kit-link detail-link-button" disabled={busy} onClick={()=>void run('renew',{personId:w.id})}>New link</button>}</span></li>)}</ul></>}
    </section>

    <section className="kit-card joint-wording"><h3 className="kit-overline">The agreed wording</h3><p>{v.text}</p></section>

    {open&&<div className="joint-secondary">
      {me&&!me.creator&&a.status==='AWAITING_SIGNATURES'&&!signed(me.id)&&<button type="button" className="kit-link detail-link-button" onClick={()=>setAsk('change')}>Ask for a change</button>}
      {me&&!me.creator&&<button type="button" className="kit-link detail-link-button joint-danger" onClick={()=>setAsk('decline')}>Decline this agreement</button>}
      {a.me.creator&&<button type="button" className="kit-link detail-link-button joint-danger" onClick={()=>setAsk('cancel')}>Cancel this agreement</button>}
    </div>}

    <Panel open={ask==='change'} onOpenChange={o=>setAsk(o?'change':null)} title="What would you like changed?" description={`${firstName(a.partners.find(p=>p.creator)!.name)} gets your note and can send a new version for everyone to sign.`}>
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(!askNote.trim()){setError('Say what you’d like changed.');return;}void run('change',{expectedVersionId:a.currentVersionId,note:askNote});}}>
        <label className="sr-only" htmlFor="joint-change">What you’d like changed</label>
        <textarea id="joint-change" className="ask-text" rows={4} maxLength={1000} value={askNote} onChange={e=>setAskNote(e.target.value)} placeholder="Can we start in January instead?"/>
        <ErrorMessage message={error}/>
        <button type="submit" className="button button-primary sign-primary" disabled={busy}>Send request</button>
      </form>
    </Panel>
    <Panel open={ask==='decline'} onOpenChange={o=>setAsk(o?'decline':null)} title={`Decline the investment in ${t.venture}?`} description="The agreement closes for everyone and can’t be signed. You can say why.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();void run('decline',{expectedVersionId:a.currentVersionId,note:askNote});}}>
        <label className="sr-only" htmlFor="joint-decline">Why you’re declining (optional)</label>
        <textarea id="joint-decline" className="ask-text" rows={3} maxLength={1000} value={askNote} onChange={e=>setAskNote(e.target.value)} placeholder="I can’t put money in this year."/>
        <ErrorMessage message={error}/>
        <button type="submit" className="button button-primary sign-primary joint-danger-button" disabled={busy}>Decline agreement</button>
        <button type="button" className="button sign-tertiary" onClick={()=>setAsk(null)}>Keep it open</button>
      </form>
    </Panel>
    <Panel open={ask==='cancel'} onOpenChange={o=>setAsk(o?'cancel':null)} title={`Cancel the investment in ${t.venture}?`} description="The agreement closes for everyone, and their links stop working. This can’t be undone.">
      <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();void run('cancel',{expectedVersionId:a.currentVersionId,note:askNote});}}>
        <ErrorMessage message={error}/>
        <button type="submit" className="button button-primary sign-primary joint-danger-button" disabled={busy}>Cancel agreement</button>
        <button type="button" className="button sign-tertiary" onClick={()=>setAsk(null)}>Keep it open</button>
      </form>
    </Panel>
  </div>;
}

/** Opening a private link: say who sent it, then join with the account it was sent to. */
export function JointInvitation({token,summary,authenticated,demo}:{token:string;summary:{writer:string;venture:string;role:'PARTNER'|'WITNESS';maskedContact:string}|null;authenticated:boolean;demo:boolean}){
  const router=useRouter(),base=appBase(demo),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function join(){setBusy(true);setError('');try{const r=await api<{id:string}>(`${apiBase(demo)}/joint/join/${token}`,{});router.push(`${base}/investments/agreements/${r.id}`);}catch(e){setError((e as Error).message);setBusy(false);}}
  if(!summary)return <section className="agreements-empty"><h2>This link isn’t active</h2><p>Ask the person who sent it for a new link. If you’ve already opened it, find the agreement in your investments.</p><Link className="button button-secondary sign-secondary" href={`${base}/investments`}>Go to investments</Link></section>;
  return <section className="joint-invite">
    <Avatar name={summary.writer} size={56}/>
    <h1>{summary.role==='PARTNER'?`${summary.writer} asked you to sign an investment agreement`:`${summary.writer} asked you to witness an investment agreement`}</h1>
    <p>For {summary.venture}. Opening it doesn’t mean you agree. You can read it, ask for a change or decline.</p>
    {authenticated?<><ErrorMessage message={error}/><button type="button" className="button button-primary sign-primary" disabled={busy} onClick={()=>void join()}>Open the agreement</button><p className="sign-note">Sent to {summary.maskedContact}</p></>
      :<><Link className="button button-primary sign-primary" href={`/login?next=${encodeURIComponent(`/joint/${token}`)}`}>Sign in to open it</Link><p className="sign-note">Sign in with {summary.maskedContact}</p></>}
  </section>;
}

/** Investment agreements at the top of the Investments page, with what each one is waiting for. */
export function JointList({agreements,demo}:{agreements:JointSummary[];demo:boolean}){
  const base=appBase(demo);
  if(!agreements.length)return null;
  return <section aria-labelledby="joint-list" className="agreements-group ledger-group"><h2 id="joint-list" className="kit-overline agreements-group-title">Investment agreements · {agreements.length}</h2><ul>
    {agreements.map(a=>{const v=latestOf(a),others=a.partners.filter(p=>p.id!==a.me.personId).map(p=>firstName(p.name)),[tag,tone]=statusTag[a.status];return <li key={a.id}><Link className="agreement-row ledger-row" href={`${base}/investments/agreements/${a.id}`}>
      <span className="agreement-row-avatar"><Avatar name={a.partners.find(p=>p.creator)!.name} size={32}/></span>
      <span className="agreement-row-person"><span className="agreement-row-name">{v.terms.venture}</span></span>
      <span className="agreement-row-progress"><span className="agreement-row-meta">With {names(others)}</span>{a.turn?<Tag tone="action">{a.turn==='sign'?'Your turn to sign':a.turn==='witness'?'Your turn to witness':'Change asked for'}</Tag>:<Tag tone={tone}>{tag}</Tag>}</span>
      <span className="agreement-row-left"><span className="agreement-row-amount">{money(v.stakes.reduce((s,x)=>s+BigInt(x.capitalMinor),0n).toString(),v.terms.currency)}</span><span className="agreement-row-caption">in total</span></span>
    </Link></li>;})}
  </ul></section>;
}

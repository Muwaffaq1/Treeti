'use client';
// Signing (Figma: v3 · Screens · Sign · 1 Read it, 2 Promise, 3 Hold to sign, 4 Signed, Ask for a change,
// Reject request; Desktop · Hold to sign 152:7922). One full-screen step at a time; nothing is saved until
// the hold completes.
import Link from '@/components/app-link';
import * as Dialog from '@radix-ui/react-dialog';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {Actor,Aggregate,Participant,Version} from '@/modules/agreements/types';
import {money} from '@/lib/money';
import {maskContact} from '@/lib/contact';
import {affirmation,formatDate,interestWording} from './agreement-utils';
import {InterestWordingWarning} from './create-agreement';
import {ArrowLeft,Check,X} from './icons';
import {Chips,Panel,useKeyboardInset} from './kit';
import {DisclosureSummary,ErrorMessage} from './ui';
import {firstName} from './person-colour';

type Step='read'|'promise'|'hold'|'signed';
export type Style='script'|'hand'|'print';
const HOLD_MS=1600;

function ago(iso:string){const m=Math.max(0,Math.round((Date.now()-Date.parse(iso))/60000));if(m<1)return 'just now';if(m<60)return `${m}m ago`;const h=Math.round(m/60);if(h<24)return `${h}h ago`;const d=Math.round(h/24);return d===1?'yesterday':`${d}d ago`;}
const longDate=(date:string)=>formatDate(date);

export function SignFlow({open,onOpenChange,a,v,me,actor,home,run}:{open:boolean;onOpenChange:(open:boolean)=>void;a:Aggregate;v:Version;me:Participant;actor:Actor;home:string;run:(action:string,extra:Record<string,unknown>)=>Promise<Aggregate>}){
  const [step,setStep]=useState<Step>('read'),[affirmed,setAffirmed]=useState(false),[signature,setSignature]=useState(actor.name),[editing,setEditing]=useState(false);
  const [style,setStyle]=useState<Style>('script'),[error,setError]=useState(''),[signed,setSigned]=useState<Aggregate|null>(null);
  const [ask,setAsk]=useState<'change'|'reject'|null>(null);
  useKeyboardInset(open);
  useEffect(()=>{if(open){setStep('read');setAffirmed(false);setSignature(actor.name);setEditing(false);setError('');setSigned(null);}},[open,actor.name]);
  const lender=a.participants.find(x=>x.role==='LENDER'),borrower=a.participants.find(x=>x.role==='BORROWER');
  const other=me.role==='LENDER'?borrower:lender,otherFirst=firstName(other?.name||'the other party');
  const t=v.terms,cur=t.currency,plan=t.installments?.payments??[];
  const kicker=me.role==='BORROWER'?`From ${otherFirst}`:`To ${otherFirst}`;
  const stepIndex={read:0,promise:1,hold:2,signed:3}[step];
  async function sign(){
    setError('');
    try{const next=await run('approve',{signature,affirmed:true});setSigned(next);setStep('signed');try{navigator.vibrate?.(20);}catch{}}
    catch(e){setError((e as Error).message);setStep('promise');}
  }
  const back=step==='promise'?()=>setStep('read'):step==='hold'?()=>setStep('promise'):null;
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Content className="sign-flow" aria-describedby={undefined} onEscapeKeyDown={e=>{if(step==='hold')e.preventDefault();}}>
        <header className="sign-bar">
          {back?<button type="button" className="detail-icon-button" aria-label="Back" onClick={back}><ArrowLeft size={18} aria-hidden/></button>:<Dialog.Close className="detail-icon-button" aria-label="Close"><X size={18} aria-hidden/></Dialog.Close>}
          <p className="sign-kicker">{step==='signed'?a.publicId:<><span className="sign-kicker-wide">Sign · </span>{kicker}{step==='read'?` · ${ago(v.createdAt)}`:''}</>}</p>
          {step!=='signed'?<ol className="sign-steps" aria-label={`Step ${stepIndex+1} of 3`}>{[0,1,2].map(i=><li key={i} className={i<=stepIndex?'on':''}/>)}</ol>:<span/>}
        </header>
        <div className="sign-body">
          {step==='read'&&<>
            <Heading title="Read before you sign" sub="Nothing is agreed until everyone signs."/>
            <section className="sign-card">
              <p className="sign-sentence">{sentence(a,v,me,actor)}</p>
              <dl className="sign-facts">
                <div><dt>Interest</dt><dd>None · {money('0',cur)}</dd></div>
                <div><dt>{plan.length?'Last part':'Repaid by'}</dt><dd>{longDate(plan.length?plan[plan.length-1].dueDate:t.dueDate)}</dd></div>
                <div><dt>Witnesses</dt><dd>{witnessText(a,v)}</dd></div>
              </dl>
              <details className="sign-wording wording"><DisclosureSummary>Read the full agreement</DisclosureSummary><p>{v.text}</p></details>
            </section>
            <div className="sign-actions">
              <button type="button" className="button button-primary sign-primary" onClick={()=>setStep('promise')}>Continue</button>
              {me.role==='BORROWER'&&<><button type="button" className="button button-secondary sign-secondary" onClick={()=>setAsk('change')}>Ask for a change</button><button type="button" className="button sign-tertiary" onClick={()=>setAsk('reject')}>Reject request</button></>}
            </div>
          </>}
          {step==='promise'&&<>
            <Heading title="One promise first" sub="This is what makes it a treeti agreement."/>
            <label className="sign-promise"><input type="checkbox" checked={affirmed} onChange={e=>setAffirmed(e.target.checked)}/><span className="sign-promise-box" aria-hidden><Check size={14}/></span><span>{affirmation(me.role)}</span></label>
            <InterestWordingWarning words={interestWording(t.purpose,t.additionalTerms)} reader={me.role}/>
            <dl className="sign-card sign-facts sign-identity">
              <div><dt>Your name</dt><dd>{editing?<input aria-label="Full name for this confirmation" value={signature} onChange={e=>setSignature(e.target.value)} autoComplete="name" minLength={2} maxLength={120}/>:<><span>{signature}</span> <button type="button" className="kit-link sign-change" onClick={()=>setEditing(true)}>Change name</button></>}</dd></div>
              {actor.contacts[0]&&<div><dt>Signed as</dt><dd>{maskContact(actor.contacts[0])}</dd></div>}
            </dl>
            <ErrorMessage message={error}/>
            <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={!affirmed||signature.trim().length<2} onClick={()=>setStep('hold')}>Continue to sign</button></div>
          </>}
          {step==='hold'&&<HoldStep name={signature.trim()} style={style} onStyle={setStyle} onDone={sign}/>}
          {step==='signed'&&signed&&<SignedStep a={signed} me={me} home={home} onView={()=>onOpenChange(false)}/>}
        </div>
        <AskPanels ask={ask} onAsk={setAsk} lenderFirst={firstName(lender?.name||'the lender')} witnesses={a.participants.filter(x=>x.role==='WITNESS'&&x.versionIds.includes(v.id))} run={run} onDone={()=>{setAsk(null);onOpenChange(false);}}/>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

/** Step heading. Inside the sign dialog it names the dialog; on a page it is the page heading. */
export function Heading({title,sub,plain}:{title:string;sub:string;plain?:boolean}){return <div className="sign-heading">{plain?<h1 className="sign-title">{title}</h1>:<Dialog.Title className="sign-title">{title}</Dialog.Title>}<p>{sub}</p></div>;}

/** The terms as one plain sentence in the reader's own voice. */
function sentence(a:Aggregate,v:Version,me:Participant,actor:Actor):ReactNode{
  const t=v.terms,cur=t.currency,plan=t.installments?.payments??[],lender=a.participants.find(x=>x.role==='LENDER'),borrower=a.participants.find(x=>x.role==='BORROWER');
  const purpose=t.purpose.trim().replace(/\.$/,''),forText=purpose?<> for {purpose.charAt(0).toLowerCase()+purpose.slice(1)}</>:null;
  const same=plan.length>0&&plan.every(x=>x.amountMinor===plan[0].amountMinor),per=t.installments?.frequency==='WEEKLY'?' a week':t.installments?.frequency==='MONTHLY'?' a month':'';
  const B=({children}:{children:ReactNode})=><strong className="sign-em">{children}</strong>,Nm=({children}:{children:ReactNode})=><span className="sign-name">{children}</span>;
  const repay=plan.length?(same&&per?<><B>{money(plan[0].amountMinor,cur)}{per}</B> for {plan.length} {t.installments?.frequency==='WEEKLY'?'weeks':'months'}, starting <B>{formatDate(plan[0].dueDate)}</B></>:<>in <B>{plan.length} parts</B>, starting <B>{formatDate(plan[0].dueDate)}</B></>):<>it all by <B>{formatDate(t.dueDate)}</B></>;
  if(me.role==='BORROWER')return <>I, <Nm>{actor.name}</Nm>, am borrowing <B>{money(t.principalMinor,cur)}</B> from <Nm>{lender?.name}</Nm>{forText}. I’ll repay {repay}.</>;
  return <>I, <Nm>{actor.name}</Nm>, am lending <B>{money(t.principalMinor,cur)}</B> to <Nm>{borrower?.name}</Nm>{forText}. <Nm>{firstName(borrower?.name||'They')}</Nm> will repay {repay}.</>;
}
function witnessText(a:Aggregate,v:Version){
  const names=a.participants.filter(x=>x.role==='WITNESS'&&x.versionIds.includes(v.id)).map(x=>x.name);
  if(names.length)return names.length===1?names[0]:`${names.slice(0,-1).join(', ')} and ${names.at(-1)}`;
  const n=v.terms.requiredWitnesses;return n===0?'None':n===1?'1, invited after you both sign':`${n}, invited after you both sign`;
}

/** Hold-to-sign: the signature inks in while the button fills; letting go early resets it. */
export function HoldStep({name,style,onStyle,onDone,plain}:{name:string;style:Style;onStyle:(s:Style)=>void;onDone:()=>Promise<void>;plain?:boolean}){
  const [progress,setProgress]=useState(0),[state,setState]=useState<'idle'|'holding'|'saving'|'rewinding'>('idle');
  const frame=useRef(0),start=useRef(0),progressRef=useRef(0);
  const today=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Lagos'}).format(new Date());
  function begin(){if(state!=='idle'&&state!=='rewinding')return;cancelAnimationFrame(frame.current);setState('holding');start.current=performance.now()-progressRef.current*HOLD_MS;const tick=(now:number)=>{const p=Math.min(1,(now-start.current)/HOLD_MS);setProgress(p);progressRef.current=p;if(p<1)frame.current=requestAnimationFrame(tick);else{setState('saving');try{navigator.vibrate?.([12,40,18]);}catch{}void onDone().finally(()=>{setState('idle');setProgress(0);progressRef.current=0;});}};frame.current=requestAnimationFrame(tick);}
  // Letting go early rewinds the ink and the fill over 300 ms; nothing is saved.
  function stop(){if(state!=='holding')return;cancelAnimationFrame(frame.current);setState('rewinding');const from=progressRef.current,t0=performance.now();
    const back=(now:number)=>{const p=Math.max(0,from*(1-(now-t0)/300));progressRef.current=p;setProgress(p);if(p>0)frame.current=requestAnimationFrame(back);else setState('idle');};frame.current=requestAnimationFrame(back);}
  useEffect(()=>()=>cancelAnimationFrame(frame.current),[]);
  const label=state==='saving'?'Signed':state==='holding'?'Keep holding…':'Hold to sign';
  return <>
    <Heading plain={plain} title="Sign with your name" sub="Hold the button. Your signature writes itself."/>
    <section className={`sign-card sign-signature${state==='saving'?' sealed':''}`}>
      <p className={`sign-ink sign-ink-${style}`} aria-hidden><span className="sign-ink-ghost">{name}</span><span className="sign-ink-fill" style={{clipPath:`inset(0 ${100-progress*100}% 0 0)`}}>{name}</span></p>
      <p className="sign-line">{name} · {today}</p>
      {state==='saving'&&<span className="sign-seal" aria-hidden><Check size={20}/></span>}
      <Chips label="Signature style" value={style} onChange={onStyle} options={[{id:'script',label:'Script'},{id:'hand',label:'Hand'},{id:'print',label:'Print'}]}/>
    </section>
    <div className="sign-actions">
      <button type="button" className={`sign-hold${state!=='idle'?' active':''}`} aria-describedby="sign-hold-note" disabled={state==='saving'}
        onPointerDown={e=>{try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}begin();}} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}
        onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();begin();}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter')stop();}} onContextMenu={e=>e.preventDefault()}>
        <span className="sign-hold-fill" style={{transform:`scaleX(${progress})`}} aria-hidden/><span className="sign-hold-label">{label}</span>
      </button>
      <p className="sign-note" id="sign-hold-note">Let go to stop. Nothing is saved until it’s full.</p>
      <p className="sr-only" aria-live="polite">{state==='saving'?'Signing':''}</p>
    </div>
  </>;
}

function SignedStep({a,me,home,onView}:{a:Aggregate;me:Participant;home:string;onView:()=>void}){
  const v=a.versions.find(x=>x.id===a.currentVersionId)!,lender=a.participants.find(x=>x.role==='LENDER');
  const parties=a.participants.filter(x=>x.role!=='WITNESS'),witnesses=a.participants.filter(x=>x.role==='WITNESS'&&x.versionIds.includes(v.id));
  const approval=(p:Participant)=>a.approvals.find(x=>x.participantId===p.id&&x.versionId===v.id&&x.action==='ACCEPTED');
  const attested=(p:Participant)=>a.attestations.find(x=>x.participantId===p.id&&x.versionId===v.id);
  const total=2+Math.max(v.terms.requiredWitnesses,witnesses.length);
  const done=parties.filter(p=>approval(p)).length+witnesses.filter(p=>attested(p)).length;
  const waitingNames=[...parties.filter(p=>!approval(p)),...witnesses.filter(p=>!attested(p))].map(p=>firstName(p.name));
  const plan=v.terms.installments?.payments??[],firstDue=plan[0]?.dueDate??v.terms.dueDate;
  const missing=Math.max(0,v.terms.requiredWitnesses-witnesses.length);
  const sub=done>=total?'Everyone has signed':`${done} of ${total} signed${waitingNames.length?` · ${waitingNames.length===1?waitingNames[0]:`${waitingNames.slice(0,-1).join(', ')} and ${waitingNames.at(-1)}`} ${waitingNames.length===1?'hasn’t':'haven’t'} yet`:''}`;
  return <>
    <div className="sign-done-mark" aria-hidden><Check size={28}/></div>
    <Heading title="You’ve signed" sub={sub}/>
    <ol className="sign-card sign-timeline">
      {parties.map(p=>{const ok=approval(p);return <li key={p.id} className={ok?'ok':'wait'}><span className="sign-dot" aria-hidden>{ok&&<Check size={12}/>}</span><span><strong>{p.id===me.id?'You signed':ok?`${firstName(p.name)} signed`:`${p.name}, ${p.role==='LENDER'?'lender':'borrower'}`}</strong><small>{ok?(p.id===me.id?'Just now':ago(ok.createdAt)):'Hasn’t signed yet'}</small></span></li>;})}
      {witnesses.map(p=>{const ok=attested(p);return <li key={p.id} className={ok?'ok':'wait'}><span className="sign-dot" aria-hidden>{ok&&<Check size={12}/>}</span><span><strong>{p.name}, witness</strong><small>{ok?'Signed':`${firstName(lender?.name||'The lender')} shares the private link`}</small></span></li>;})}
      {missing>0&&<li className="wait"><span className="sign-dot" aria-hidden/><span><strong>{missing===1?'1 witness':`${missing} witnesses`}</strong><small>Invited once you’ve both signed</small></span></li>}
      <li className="later"><span className="sign-dot" aria-hidden/><span><strong>Agreement is active</strong><small>When everyone has signed · first part due {formatDate(firstDue).replace(/ \d{4}$/,'')}</small></span></li>
    </ol>
    <div className="sign-actions">
      <Link className="button button-primary sign-primary" href={home}>Back to home</Link>
      <button type="button" className="button sign-tertiary" onClick={onView}>View the agreement</button>
    </div>
  </>;
}

/** Ask for a change and Reject request, as slide-up panels over the reading step. */
export function AskPanels({ask,onAsk,lenderFirst,witnesses,run,onDone}:{ask:'change'|'reject'|null;onAsk:(a:'change'|'reject'|null)=>void;lenderFirst:string;witnesses:Participant[];run:(action:string,extra:Record<string,unknown>)=>Promise<Aggregate>;onDone:()=>void}){
  const [note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setNote('');setError('');setBusy(false);},[ask]);
  async function send(action:'request-change'|'decline'){setBusy(true);setError('');try{await run(action,{reason:note.trim()});onDone();}catch(e){setError((e as Error).message);setBusy(false);}}
  const witnessNames=witnesses.map(w=>firstName(w.name));
  return <>
    <Panel open={ask==='change'} onOpenChange={o=>onAsk(o?'change':null)} title="What would you like to change?" description={`${lenderFirst} sees your note and can send a new version. Everyone signs the new one.`}>
      <form className="ask-form" onSubmit={e=>{e.preventDefault();if(note.trim())void send('request-change');}}>
        <label className="sr-only" htmlFor="ask-change">What would you like to change?</label>
        <textarea id="ask-change" className="ask-text" rows={4} maxLength={2000} required value={note} onChange={e=>setNote(e.target.value)} placeholder="Could we start in January instead of December?"/>
        <ErrorMessage message={error}/>
        <button type="submit" className="button button-primary sign-primary" disabled={busy||!note.trim()} aria-busy={busy}>{`Send to ${lenderFirst}`}</button>
        <button type="button" className="button button-secondary sign-secondary" onClick={()=>onAsk(null)}>Cancel</button>
      </form>
    </Panel>
    <Panel open={ask==='reject'} onOpenChange={o=>onAsk(o?'reject':null)} title={`Reject ${lenderFirst}’s request?`} description={`${lenderFirst} will see that you said no${witnessNames.length?`, and ${witnessNames.join(' and ')}’s ${witnessNames.length===1?'link stops':'links stop'} working`:''}. You can’t undo this.`}>
      <form className="ask-form" onSubmit={e=>{e.preventDefault();void send('decline');}}>
        <label className="ask-label" htmlFor="ask-reject">Add a short reason (optional)</label>
        <input id="ask-reject" className="ask-input" maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder="I’ve found another way to cover it, thank you."/>
        <ErrorMessage message={error}/>
        <button type="submit" className="button sign-danger" disabled={busy} aria-busy={busy}>Reject request</button>
        <button type="button" className="button button-secondary sign-secondary" onClick={()=>onAsk(null)}>Keep it</button>
      </form>
    </Panel>
  </>;
}

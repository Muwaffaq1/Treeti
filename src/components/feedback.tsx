'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {MessageSquareText,Star} from 'lucide-react';
import {api,apiBase,appBase} from './client-api';
import {Button,ErrorMessage,Field} from './ui';
import type {Feedback} from '@/modules/feedback/feedback';

const promptKey='treeti:feedback-prompt',visitsKey='treeti:feedback-visits',installKey='treeti:install-nudge';
const day=86400000;
/**
 * Whether to invite feedback now. A person is asked only after they have looked around
 * (five screens), never alongside the install prompt, and then left alone: 30 days after
 * "Not now", 90 days after sending something. Pure so the rules can be tested.
 */
export function shouldAskForFeedback(s:{prompt:string|null;visits:number;installPrompt:string|null;installed:boolean;automated:boolean;now:number}){
  if(s.prompt==='show')return true;
  if(s.automated||s.visits<5)return false;
  // The install prompt goes first; wait until it has been answered on this device.
  if(!s.installed&&!(Number(s.installPrompt)>0))return false;
  const [kind,at]=(s.prompt??'').split(':'),rest=kind==='sent'?90*day:30*day;
  return !(Number(at)>0&&s.now-Number(at)<rest);
}
const read=(key:string)=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key:string,value:string)=>{try{localStorage.setItem(key,value);}catch{}};
const markFeedback=(kind:'later'|'sent')=>write(promptKey,`${kind}:${Date.now()}`);

export function FeedbackNudge({demo}:{demo:boolean}){
  const pathname=usePathname(),[open,setOpen]=useState(false),onFeedback=pathname.endsWith('/feedback');
  useEffect(()=>{
    if(onFeedback)return;
    const visits=Number(read(visitsKey)||0)+1;write(visitsKey,String(visits));
    const installed=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
    if(!shouldAskForFeedback({prompt:read(promptKey),visits,installPrompt:read(installKey),installed,automated:navigator.webdriver,now:Date.now()}))return;
    const timer=setTimeout(()=>setOpen(true),12000);
    return ()=>clearTimeout(timer);
  },[pathname,onFeedback]);
  if(!open||onFeedback)return null;
  const close=()=>{setOpen(false);markFeedback('later');};
  return <section className="install-nudge feedback-nudge" role="region" aria-label="Share your feedback"><div><strong>How is treeti working for you?</strong><p>Tell us what is working and what is not. It takes a minute and shapes what gets built next.</p></div><div className="install-nudge-actions"><Button variant="ghost" onClick={close}>Not now</Button><Link className="button button-primary" href={`${appBase(demo)}/feedback`} onClick={close}><MessageSquareText size={17} aria-hidden/>Give feedback</Link></div></section>;
}

const labels=['','Poor','Fair','Good','Very good','Excellent'];
function Stars({value}:{value:number|null}){return value?<span className="feedback-stars" role="img" aria-label={`${value} out of 5`}>{[1,2,3,4,5].map(n=><Star key={n} size={15} aria-hidden className={n<=value?'filled':undefined}/>)}</span>:null;}
const noSubscription=()=>()=>{};

export function FeedbackPage({demo,received}:{demo:boolean;received:Feedback[]|null}){
  const [rating,setRating]=useState<number|null>(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
  const timeZone=useSyncExternalStore(noSubscription,()=>Intl.DateTimeFormat().resolvedOptions().timeZone,()=>'UTC'),when=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone});
  async function submit(){
    if(busy)return;if(!rating&&!message.trim()){setError('Choose a rating or write a message.');return;}
    setBusy(true);setError('');
    try{await api(`${apiBase(demo)}/feedback`,{rating,message,page:document.referrer?new URL(document.referrer).pathname.slice(0,200):null});markFeedback('sent');setSent(true);setRating(null);setMessage('');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="activity-page feedback-page"><div className="page-heading"><div><h1>Share your feedback</h1><p className="lede">What is working, what is confusing, what is missing? Your message goes privately to the person who runs treeti.</p></div></div>
    {sent?<section className="panel feedback-thanks" role="status"><h2>Thank you.</h2><p>Your feedback has been sent. It is read by a person, and it shapes what gets built next.</p><div className="dialog-actions"><Button variant="secondary" onClick={()=>setSent(false)}>Send more feedback</Button><Link className="button button-primary" href={demo?'/demo':'/app'}>Back to overview</Link></div></section>
    :<form className="panel feedback-form" onSubmit={e=>{e.preventDefault();void submit();}}>
      <fieldset className="feedback-rating"><legend>How would you rate treeti so far? <span className="quiet-note">Optional</span></legend><div>{[1,2,3,4,5].map(n=><label key={n} className={rating!==null&&n<=rating?'filled':undefined}><input type="radio" name="rating" value={n} checked={rating===n} onChange={()=>{setRating(n);setError('');}} aria-label={`${n} out of 5, ${labels[n]}`}/><Star size={30} aria-hidden/></label>)}</div><p className="quiet-note" aria-hidden>{rating?labels[rating]:'Tap a star'}</p></fieldset>
      <Field label="Your message" hint="Please do not include passwords or sign-in codes."><textarea value={message} onChange={e=>{setMessage(e.target.value);setError('');}} rows={6} maxLength={2000} placeholder="For example: I could not find where to…"/></Field>
      <ErrorMessage message={error}/><div className="dialog-actions"><Button type="submit" busy={busy}>Send feedback</Button></div>
    </form>}
    {received&&<section className="feedback-received" aria-labelledby="feedback-received-title"><h2 id="feedback-received-title">What people have said</h2><p className="quiet-note">Only you can see this list.</p>{received.length?<ol className="feedback-list">{received.map(f=><li key={f.id}><div><p className="feedback-from"><strong>{f.from||f.contact||'A treeti user'}</strong>{f.from&&f.contact&&<span> · {f.contact}</span>}<Stars value={f.rating}/></p>{f.message&&<p className="feedback-message">{f.message}</p>}<small>{when.format(new Date(f.createdAt))}{f.page?` · sent from ${f.page}`:''}</small></div></li>)}</ol>:<p className="panel">No feedback yet. When someone sends some, it appears here and your phone is alerted.</p>}</section>}
  </div>;
}

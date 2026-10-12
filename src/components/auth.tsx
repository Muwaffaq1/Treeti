'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,LockKeyhole,Mail} from 'lucide-react';
import {api,apiBase} from './client-api';
import {Button,ErrorMessage,Field} from './ui';
import {Brand} from './shell';
import {authReturnPath} from '@/lib/auth-return';
export function Login({configured,demoAvailable=false,next='/app',authError}:{configured:boolean;demoAvailable?:boolean;next?:string;authError?:string}){
  const codeInput=useRef<HTMLInputElement>(null);
  const [notice,setNotice]=useState('');
  const router=useRouter(),[contact,setContact]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[masked,setMasked]=useState(''),[error,setError]=useState(authError==='link'?'This link could not be used. Request a new code and enter it here.':authError==='identity'?'This email did not match the sign-in request. Please try again.':''),[busy,setBusy]=useState(false);
  async function sendCode(resend=false){
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{const r=await api<{contact:string}>('/api/auth/send',{contact,next:authReturnPath(next)});setMasked(r.contact);setCode('');setSent(true);if(resend)setNotice('A new code has been sent. Check your email and use the latest code.');codeInput.current?.focus();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function submit(){
    if(busy)return;if(!sent){await sendCode();return;}setBusy(true);setError('');setNotice('');
    try{const r=await api<{needsName:boolean}>('/api/auth/verify',{code});router.push(r.needsName?`/welcome?next=${encodeURIComponent(authReturnPath(next))}`:authReturnPath(next));router.refresh();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="auth-layout"><div className="auth-story"><Link href="/" aria-label="treeti home"><Brand/></Link><h1>Good intentions.<br/>Clear agreements.</h1><p>A thoughtful way to preserve what you agreed to, and care for the relationship along the way.</p><div className="auth-trust"><LockKeyhole size={19}/><span>Your agreements stay private.</span></div></div><div className="auth-form-wrap"><Link className="back-link" href="/"><ArrowLeft size={16}/>Back to treeti</Link><h2>{sent?'Check your email.':'Welcome to treeti.'}</h2><p>{sent?`Enter the code sent to ${masked}.`:'Sign in with your email. No password needed.'}</p>{!configured?<div className="panel"><p>{demoAvailable?"Sign-in is not connected yet. You can explore treeti with sample records.":"Sign-in setup is still in progress. Please check back later."}</p>{demoAvailable&&<Link className="button button-primary" href="/demo">Explore the demonstration <ArrowRight size={17}/></Link>}</div>:<form onSubmit={e=>{e.preventDefault();void submit();}}><div className="auth-fields">{sent?<Field label="Verification code" hint="Paste the code from your email."><input ref={codeInput} value={code} onChange={e=>setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6,8}" maxLength={8} autoFocus/></Field>:<Field label="Email address"><input type="email" value={contact} onChange={e=>setContact(e.target.value)} autoComplete="email" required placeholder="name@example.com"/></Field>}<ErrorMessage message={error}/>{notice&&<p className="quiet-note" role="status">{notice}</p>}<Button type="submit" busy={busy}>{sent?'Verify and continue':'Send verification code'} <ArrowRight size={17}/></Button>{sent&&<><p className="quiet-note">Code expired or missing? Request a new one here.</p><Button type="button" variant="secondary" disabled={busy} onClick={()=>void sendCode(true)}>Resend code</Button><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setSent(false);setCode('');setError('');setNotice('');}}>Change email</Button></>}</div><p className="ceremony-footnote">Verify once to access your private records. treeti does not transfer money.</p></form>}</div></div>;
}
export function CompleteProfile({next}:{next:string}) {
  const router=useRouter(),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(){setBusy(true);setError('');try{await api('/api/auth/profile',{name});router.replace(authReturnPath(next));router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="invitation-page"><Brand/><h1>What’s your full name?</h1><p className="lede">We’ll use it on your agreements. You only need to add it once.</p><form className="panel dialog-form" onSubmit={e=>{e.preventDefault();void submit();}}><Field label="Full name"><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={120}/></Field><ErrorMessage message={error}/><Button type="submit" busy={busy}>Save and continue <ArrowRight size={17}/></Button></form></div>;
}
export function InvitationPage({token,demo,actorName,authenticated}:{token:string;demo:boolean;actorName?:string;authenticated:boolean}){
  const router=useRouter();
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[info,setInfo]=useState<{role:string;contact:string;verificationAvailable:boolean}|null>(null);
  const [code,setCode]=useState(''),[sent,setSent]=useState(false),[notice,setNotice]=useState(''),[retry,setRetry]=useState(0);
  const codeInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    let live=true;
    async function open(){setBusy(true);setError('');try{
      const query=demo?window.location.search:'';
      const result=await api<{role:string;contact:string;verificationAvailable:boolean}>(`${apiBase(demo)}/invitations/${token}${query}`);
      if(!live)return;setInfo(result);
      if(authenticated){const r=await api<{agreementId:string}>(`${apiBase(demo)}/invitations/${token}/claim${query}`,{});if(live){router.replace(`${demo?'/demo':''}/agreements/${r.agreementId}`);router.refresh();}}
      else if(demo)router.refresh();
    }catch(e){if(live)setError((e as Error).message);}finally{if(live)setBusy(false);}}
    void open();return ()=>{live=false;};
  },[token,demo,authenticated,actorName,retry,router]);
  async function sendWitnessCode(resend=false){
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{await api('/api/auth/send',{invitationToken:token});setCode('');setSent(true);if(resend)setNotice('A new code has been sent. Check your email and use the latest code.');codeInput.current?.focus();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function verifyWitness(){
    if(busy)return;if(!sent){await sendWitnessCode();return;}setBusy(true);setError('');setNotice('');
    try{const r=await api<{agreementId:string}>('/api/auth/verify',{code});router.replace(`/agreements/${r.agreementId}`);router.refresh();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const witness=info?.role==='WITNESS';
  return <div className="invitation-page"><Link href="/" aria-label="treeti home"><Brand/></Link><h1>{witness?'You’re invited to be a witness.':'You’re invited to review an agreement.'}</h1><p className="lede">{witness?'Read the terms and decide whether to act as a witness. You are not responsible for repayment.':'Opening this invitation does not mean you accept the terms.'}</p><section className="panel"><span className="empty-icon"><Mail size={28}/></span><h2>{busy&&!info?'Opening your invitation…':sent?'Check your email':'Read the terms privately'}</h2>{info&&<p>This {witness?'witness':info.role==='LENDER'?'lender':'borrower'} invitation is for <strong>{info.contact}</strong>.</p>}<ErrorMessage message={error}/>{notice&&<p className="quiet-note" role="status">{notice}</p>}
    {error&&(!info||authenticated)&&<><Button variant="secondary" busy={busy} onClick={()=>setRetry(n=>n+1)}>Try again</Button>{authenticated&&!demo&&<Button variant="ghost" onClick={async()=>{await api('/api/auth/sign-out',{});router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);router.refresh();}}>Use a different email</Button>}</>}
    {info&&info.verificationAvailable===false?<p>Phone verification is not available yet. Ask the inviter for an email invitation.</p>:info&&!authenticated&&(witness&&!demo?<><form className="witness-invitation-form" onSubmit={e=>{e.preventDefault();void verifyWitness();}}>{sent&&<Field label="Verification code" hint="Enter the code sent to the invited email."><input ref={codeInput} value={code} onChange={e=>setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6,8}" maxLength={8} autoFocus/></Field>}<Button type="submit" busy={busy}>{sent?'Verify and read the terms':'Send verification code'} <ArrowRight size={17}/></Button>{sent&&<><p className="quiet-note">Code expired or missing? Request a new one here.</p><Button type="button" variant="secondary" disabled={busy} onClick={()=>void sendWitnessCode(true)}>Resend code</Button></>}</form><p className="quiet-note">Verify your email once. No password or profile setup. Your witness response is recorded only when you agree.</p></>:<><p>Sign in with the invited email to read the terms.</p><Link className="button button-primary" href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to read <ArrowRight size={17}/></Link></>)}
    <Link className="button button-ghost" href={demo?'/demo':'/'}>This invitation is not for me</Link></section></div>;
}

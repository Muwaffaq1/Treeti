'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Mail} from '@/components/icons';
import {api,apiBase} from './client-api';
import {ErrorMessage} from './ui';
import {Brand} from './shell';
import {authReturnPath} from '@/lib/auth-return';
const noSubscription=()=>()=>{};
export function Login({configured,demoAvailable=false}:{configured:boolean;demoAvailable?:boolean}){
  // The page is prebuilt, so `next` and `authError` come from the address once it is open in the browser.
  const search=useSyncExternalStore(noSubscription,()=>window.location.search,()=>''),query=new URLSearchParams(search),next=query.get('next')??'/app',authError=query.get('authError');
  const linkError=authError==='link'?'This link could not be used. Request a new code and enter it here.':authError==='identity'?'This email did not match the sign-in request. Please try again.':'',[tried,setTried]=useState(false);
  const codeInput=useRef<HTMLInputElement>(null);
  const [notice,setNotice]=useState('');
  const router=useRouter(),[contact,setContact]=useState(''),[code,setCode]=useState(''),[sent,setSent]=useState(false),[masked,setMasked]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function sendCode(resend=false){
    if(busy)return;setBusy(true);setTried(true);setError('');setNotice('');
    try{const r=await api<{contact:string}>('/api/auth/send',{contact,next:authReturnPath(next)});setMasked(r.contact);setCode('');setSent(true);if(resend)setNotice('A new code has been sent. Check your email and use the latest code.');codeInput.current?.focus();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function submit(){
    if(busy)return;if(!sent){await sendCode();return;}setBusy(true);setError('');setNotice('');
    try{const r=await api<{needsName:boolean}>('/api/auth/verify',{code});router.push(r.needsName?`/welcome?next=${encodeURIComponent(authReturnPath(next))}`:authReturnPath(next));router.refresh();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <div className="public-page">
    <PublicHeader/>
    <main id="main" className="public-main">
      <div className="public-heading"><h1>{sent?'Check your email':'Welcome to treeti'}</h1><p>{sent?`We sent a code to ${masked}`:'Sign in with your email. No password needed.'}</p></div>
      {!configured?<div className="public-card"><p>{demoAvailable?'Sign-in isn’t connected yet. You can explore treeti with sample records.':'Sign-in setup is still in progress. Please check back later.'}</p>{demoAvailable&&<Link className="button button-primary sign-primary" href="/demo">Explore the demonstration</Link>}</div>
      :<form className="public-form" onSubmit={e=>{e.preventDefault();void submit();}}>
        {sent?<CodeBoxes inputRef={codeInput} value={code} onChange={setCode}/>
          :<label className="create-field"><span className="create-field-label">Email address</span><input type="email" value={contact} onChange={e=>setContact(e.target.value)} autoComplete="email" required placeholder="name@example.com"/></label>}
        {sent&&<div className="public-links"><button type="button" className="kit-link detail-link-button" disabled={busy} onClick={()=>void sendCode(true)}>Send a new code</button><button type="button" className="kit-link detail-link-button" disabled={busy} onClick={()=>{setSent(false);setCode('');setError('');setNotice('');}}>Change email</button></div>}
        <ErrorMessage message={error||(tried?'':linkError)}/>{notice&&<p className="quiet-note public-note" role="status">{notice}</p>}
        <div className="sign-actions public-actions"><button type="submit" className="button button-primary sign-primary" disabled={busy} aria-busy={busy}>{sent?'Verify and continue':'Send my sign-in code'}</button>
          <p className="sign-note">By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">privacy policy</Link>.</p></div>
      </form>}
    </main>
  </div>;
}
export function CompleteProfile({next}:{next:string}) {
  const router=useRouter(),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(){setBusy(true);setError('');try{await api('/api/auth/profile',{name});router.replace(authReturnPath(next));router.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="public-page">
    <PublicHeader/>
    <main id="main" className="public-main">
      <div className="public-heading"><h1>What’s your full name?</h1><p>It goes on your agreements, so use the name people know you by. You only add it once.</p></div>
      <form className="public-form" onSubmit={e=>{e.preventDefault();void submit();}}>
        <label className="create-field"><span className="create-field-label">Full name</span><input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={120}/></label>
        <ErrorMessage message={error}/>
        <div className="sign-actions public-actions"><button type="submit" className="button button-primary sign-primary" disabled={busy} aria-busy={busy}>Save and continue</button></div>
      </form>
    </main>
  </div>;
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
  async function sendInvitationCode(resend=false){
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{await api('/api/auth/send',{invitationToken:token});setCode('');setSent(true);if(resend)setNotice('A new code has been sent. Check your email and use the latest code.');codeInput.current?.focus();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function verifyInvitation(){
    if(busy)return;if(!sent){await sendInvitationCode();return;}setBusy(true);setError('');setNotice('');
    try{const r=await api<{agreementId:string}>('/api/auth/verify',{code});router.replace(`/agreements/${r.agreementId}`);router.refresh();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const witness=info?.role==='WITNESS';
  return <div className="public-page">
    <PublicHeader/>
    <main id="main" className="public-main">
      <div className="public-heading"><span className="public-mark" aria-hidden><Mail size={22}/></span><h1>{witness?'You’re invited to be a witness':'You’re invited to review an agreement'}</h1><p>{witness?'Read the terms and decide whether to witness them. You’re not responsible for repayment.':'We’ll send a code to the email it was sent to, then you can read it privately.'}</p></div>
      {!witness&&<p className="public-callout">Opening it doesn’t mean you accept anything. You can ask for a change or say no.</p>}
      <div className="public-form">
        {busy&&!info&&<p className="quiet-note public-note">Opening your invitation…</p>}
        {info&&<div className="public-email"><span className="create-field-label">{witness?'Witness invitation for':'Sent to'}</span><strong>{info.contact}</strong></div>}
        <ErrorMessage message={error}/>{notice&&<p className="quiet-note public-note" role="status">{notice}</p>}
        {error&&(!info||authenticated)&&<div className="public-links"><button type="button" className="kit-link detail-link-button" disabled={busy} onClick={()=>setRetry(n=>n+1)}>Try again</button>{authenticated&&!demo&&<button type="button" className="kit-link detail-link-button" onClick={async()=>{await api('/api/auth/sign-out',{});router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);router.refresh();}}>Use a different email</button>}</div>}
        {info&&info.verificationAvailable===false?<p className="public-note">Phone verification is not available yet. Ask the inviter for an email invitation.</p>
        :info&&!authenticated&&(!demo?<form className="public-form" onSubmit={e=>{e.preventDefault();void verifyInvitation();}}>
            {sent&&<><CodeBoxes inputRef={codeInput} value={code} onChange={setCode}/><div className="public-links"><button type="button" className="kit-link detail-link-button" disabled={busy} onClick={()=>void sendInvitationCode(true)}>Send a new code</button></div></>}
            <div className="sign-actions public-actions"><button type="submit" className="button button-primary sign-primary" disabled={busy} aria-busy={busy}>{sent?'Verify and read the terms':'Send my sign-in code'}</button><p className="sign-note">Verify your email once. No password or profile. Your response is only recorded when you agree.</p></div>
          </form>
          :<div className="sign-actions public-actions"><Link className="button button-primary sign-primary" href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to read</Link></div>)}
        <Link className="button sign-tertiary public-not-me" href={demo?'/demo':'/'}>This isn’t for me</Link>
      </div>
    </main>
  </div>;
}

/**
 * Boxes drawn around one real input, so typing, paste and one-time-code autofill all work.
 * "Paste code" reads the clipboard directly: on iPhone, long-pressing an invisible field often shows no Paste.
 */
function CodeBoxes({value,onChange,inputRef}:{value:string;onChange:(v:string)=>void;inputRef:React.RefObject<HTMLInputElement|null>}){
  const digits=value.replace(/\D/g,'').slice(0,8),count=Math.max(6,digits.length);
  const [canPaste,setCanPaste]=useState(false),[pasteNote,setPasteNote]=useState('');
  useEffect(()=>{setCanPaste(typeof navigator!=='undefined'&&!!navigator.clipboard?.readText);},[]);
  const take=(text:string)=>{const code=(text.match(/\d{6,8}/)?.[0]??text.replace(/\D/g,'')).slice(0,8);if(code)onChange(code);return code;};
  async function paste(){
    setPasteNote('');
    try{const code=take(await navigator.clipboard.readText());if(!code)setPasteNote('No code found. Copy the code from the email, then try again.');else inputRef.current?.focus();}
    catch{setPasteNote('Paste wasn’t allowed. Type the code instead.');}
  }
  return <>
    <label className="code-boxes"><span className="sr-only">Verification code</span>
      <input ref={inputRef} value={digits} onChange={e=>onChange(e.target.value.replace(/\D/g,'').slice(0,8))} onPaste={e=>{if(take(e.clipboardData.getData('text')))e.preventDefault();}} autoComplete="one-time-code" inputMode="numeric" required pattern="[0-9]{6,8}" maxLength={8} autoFocus/>
      <span className="code-boxes-row" aria-hidden>{Array.from({length:count},(_,i)=><span key={i} className={`code-box${i===digits.length?' current':''}${i<digits.length?' filled':''}`}>{digits[i]??''}</span>)}</span>
    </label>
    {canPaste&&<button type="button" className="kit-link detail-link-button code-paste" onClick={()=>void paste()}>Paste code</button>}
    {pasteNote&&<p className="quiet-note public-note" role="status">{pasteNote}</p>}
  </>;
}
/** The public pages' top bar: wordmark, and Sign in where it helps. */
export function PublicHeader({signIn=false,links=false}:{signIn?:boolean;links?:boolean}){
  return <header className="public-header"><Link href="/" aria-label="treeti home"><Brand/></Link>{(signIn||links)&&<nav className="public-nav" aria-label="treeti">{links&&<><Link href="/demo/guide" className="public-nav-link">How it works</Link><Link href="/privacy" className="public-nav-link">Privacy</Link></>}{signIn&&<Link href="/login" className="public-signin">Sign in</Link>}</nav>}</header>;
}

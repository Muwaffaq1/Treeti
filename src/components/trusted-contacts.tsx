'use client';
import Link from '@/components/app-link';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,Eye,HeartHandshake,UsersRound} from '@/components/icons';
import type {ContactView,OwnerView} from '@/modules/trusted/model';
import {trustedContactLimit,waitingDays} from '@/modules/trusted/limits';
import type {SharedAgreement,SharedRecords} from '@/modules/trusted/summary';
import {money} from '@/lib/money';
import {api,apiBase,appBase} from './client-api';
import {formatDate} from './agreement-utils';
import {InviteLink} from './create-agreement';
import {Button,ErrorMessage,Modal} from './ui';
import {Amount,Avatar,Blank,Panel,RingAvatar,Tag,fitChars,longAmount} from './kit';
import {Flow,W} from './record-blanks';
import {firstName} from './person-colour';

type Lists={owned:OwnerView[];trustedBy:ContactView[]};
type Response=Lists&{invitation?:{url:string;name:string}};
type Confirm={kind:'remove'|'share'|'close'|'request'|'leave';id:string;name:string;closing?:'REFUSED'|'STOPPED'};

const shareMessage='I’ve added you as a trusted contact on treeti, so you can see my debts if I can’t manage them myself. Please accept here:';
const confirmCopy:Record<Confirm['kind'],(c:Confirm)=>{title:string;body:string;action:string;danger?:boolean}>={
  remove:c=>({title:`Remove ${c.name}?`,body:`${c.name} will no longer be able to ask for or see your records. You can add them again later.`,action:'Remove contact',danger:true}),
  share:c=>({title:`Share your records with ${c.name} now?`,body:`${c.name} will be able to see your debts and loan agreements straight away, until you stop sharing.`,action:'Share now'}),
  close:c=>c.closing==='REFUSED'?{title:`Refuse ${c.name}’s request?`,body:`${c.name} won’t be able to see your records. They can ask again later.`,action:'Refuse request',danger:true}:{title:`Stop sharing with ${c.name}?`,body:`${c.name} will no longer see your records. They can ask again later.`,action:'Stop sharing',danger:true},
  request:c=>({title:`Ask to see ${c.name}’s records?`,body:`We’ll email ${c.name} about your request. If they don’t refuse within ${waitingDays} days, you’ll be able to see their debts and loan agreements.`,action:'Send request'}),
  leave:c=>({title:`Stop being ${c.name}’s trusted contact?`,body:`You won’t be able to ask for or see ${c.name}’s records. They can add you again.`,action:'Stop being a contact',danger:true}),
};
const actionPath:Record<Confirm['kind'],string>={remove:'remove',share:'share',close:'close',request:'request',leave:'remove'};
const doneText:Record<Confirm['kind'],(c:Confirm)=>string>={
  remove:c=>`${c.name} is no longer a trusted contact.`,share:c=>`${c.name} can now see your records.`,
  close:c=>c.closing==='REFUSED'?`You refused ${c.name}’s request.`:`${c.name} can no longer see your records.`,
  request:c=>`Request sent to ${c.name}.`,leave:c=>`You’re no longer ${c.name}’s trusted contact.`,
};

export function TrustedContacts({initial,demo}:{initial:Lists;demo:boolean}){
  const [lists,setLists]=useState(initial),[adding,setAdding]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState('');
  const [invitation,setInvitation]=useState<Response['invitation']>(),[confirm,setConfirm]=useState<Confirm|null>(null),[sheet,setSheet]=useState<'who'|'email'|null>(null),[panelError,setPanelError]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const keys=useRef(new Map<string,string>());
  const key=(text:string)=>{if(!keys.current.has(text))keys.current.set(text,crypto.randomUUID());return keys.current.get(text)!;};
  const base=`${apiBase(demo)}/trusted`,full=lists.owned.length>=trustedContactLimit;
  function openAdd(){setName('');setEmail('');setInvitation(undefined);setError('');setSheet('who');setAdding(true);}
  async function add(){if(busy)return;setBusy(true);setError('');try{
    const body={name,email},result=await api<Response>(base,body,key(JSON.stringify(body)));
    setLists(result);setInvitation(result.invitation);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function renew(view:OwnerView){if(busy)return;setBusy(true);setError('');try{
    const result=await api<Response>(`${base}/${view.id}/renew`,{},crypto.randomUUID());
    setLists(result);setInvitation(result.invitation);setSheet(null);setAdding(true);
  }catch(e){setSuccess('');setError((e as Error).message);}finally{setBusy(false);}}
  async function act(){if(!confirm||busy)return;setBusy(true);setError('');try{
    const result=await api<Response>(`${base}/${confirm.id}/${actionPath[confirm.kind]}`,{},crypto.randomUUID());
    setLists(result);setSuccess(doneText[confirm.kind](confirm));setConfirm(null);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const copy=confirm&&confirmCopy[confirm.kind](confirm);
  const [manage,setManage]=useState<{side:'owned'|'by';id:string}|null>(null),[howOpen,setHowOpen]=useState(false),[now,setNow]=useState(0);
  useEffect(()=>{const t=setTimeout(()=>setNow(Date.now()),0);return ()=>clearTimeout(t);},[]);
  const owned=manage?.side==='owned'?lists.owned.find(c=>c.id===manage.id):undefined,by=manage?.side==='by'?lists.trustedBy.find(c=>c.id===manage.id):undefined;
  const daysLeft=(iso:string)=>now?Math.max(0,Math.ceil((Date.parse(iso)-now)/86400000)):waitingDays;
  const short=(iso:string)=>formatDate(iso).replace(/ \d{4}$/,'');
  const then=(next:Confirm)=>{setManage(null);setConfirm(next);};
  return <div className="ledger trusted">
    <header className="detail-bar notices-bar"><Link className="detail-icon-button" href={appBase(demo)||'/app'} aria-label="Back to overview"><ArrowLeft size={18} aria-hidden/></Link><h1 className="notices-title">Trusted contacts</h1><span/></header>
    <p className="ledger-next trusted-intro">If something happens to you, they can ask to see your debts and agreements. You always get <strong>{waitingDays} days</strong> to say no.</p>
    <div role="status">{success&&<div className="success-notice"><CheckCircle2 size={18} aria-hidden/>{success}<button onClick={()=>setSuccess('')}>Dismiss</button></div>}</div>
    {!confirm&&!adding&&<ErrorMessage message={error}/>}
    <section aria-labelledby="your-contacts" className="agreements-group ledger-group">
      <h2 className="kit-overline agreements-group-title" id="your-contacts">Your trusted contacts · {lists.owned.length}</h2>
      {lists.owned.length?<ul>{lists.owned.map(c=><li key={c.id}><article className="ledger-row" aria-label={c.name}><button type="button" className="agreement-row ledger-row-button" aria-haspopup="dialog" onClick={()=>setManage({side:'owned',id:c.id})}>
        <span className="agreement-row-avatar"><Avatar name={c.name} size={32}/></span>
        <span className="agreement-row-person"><span className="agreement-row-name">{c.name}</span></span>
        <span className="agreement-row-progress"><span className="agreement-row-meta">{ownerLine(c)}</span>{c.access==='WAITING'&&c.opensAt&&<Tag tone="action">Opens {short(c.opensAt)}</Tag>}{c.access==='OPEN'&&<Tag tone="positive">Sharing now</Tag>}</span>
        <span className="agreement-row-left"><span className="trusted-pill">{c.access==='WAITING'?'Review':c.status==='INVITED'?'Share link':'Manage'}</span></span>
      </button></article></li>)}</ul>
      :<p className="trusted-empty">Nobody yet. Choose someone you trust, like a spouse or an adult child.</p>}
    </section>
    <section aria-labelledby="trusted-by" className="agreements-group ledger-group">
      <h2 className="kit-overline agreements-group-title" id="trusted-by">People who trust you · {lists.trustedBy.length}</h2>
      {lists.trustedBy.length?<ul>{lists.trustedBy.map(c=><li key={c.id}><article className="ledger-row" aria-label={c.ownerName}><button type="button" className="agreement-row ledger-row-button" aria-haspopup="dialog" onClick={()=>setManage({side:'by',id:c.id})}>
        <span className="agreement-row-avatar"><Avatar name={c.ownerName} size={32}/></span>
        <span className="agreement-row-person"><span className="agreement-row-name">{c.ownerName}</span></span>
        <span className="agreement-row-progress"><span className="agreement-row-meta">{c.access==='OPEN'?'Sharing their records with you':c.access==='WAITING'?`You asked. You can see them from ${short(c.opensAt!)}`:'Added you as a trusted contact'}</span>{c.access==='OPEN'&&<Tag tone="positive">Read only</Tag>}</span>
        <span className="agreement-row-left"><span className="trusted-pill">{c.access==='OPEN'?'Open':c.access==='WAITING'?'Waiting':'Ask'}</span></span>
      </button></article></li>)}</ul>
      :<p className="trusted-empty">When someone adds you and you accept, they’ll show up here.</p>}
    </section>
    <div className="ledger-dock"><button type="button" className="kit-link detail-link-button" onClick={()=>setHowOpen(true)}>How access works</button>{!full&&<button type="button" className="brief-cta" onClick={openAdd}>Add a trusted contact</button>}</div>

    <Panel open={howOpen} onOpenChange={setHowOpen} title="How access works">
      <ol className="trusted-steps"><li>Your trusted contact asks to see your records, and we email you.</li><li>If you don’t refuse within {waitingDays} days, they can see your debts and loan agreements. Read only.</li><li>You can share straight away, stop sharing or remove someone at any time.</li></ol>
    </Panel>

    <Panel open={!!owned} onOpenChange={o=>{if(!o)setManage(null);}} title={owned?(owned.access==='WAITING'?`${firstName(owned.name)} asked to see your records`:owned.name):'Trusted contact'} description={owned?(owned.access==='WAITING'?`${firstName(owned.name)} will see your debts and loan agreements when the time is up, unless you refuse. Nothing is shown before then.`:owned.email):undefined}>
      {owned&&<div className="ledger-detail">
        {owned.access==='WAITING'&&owned.opensAt&&<div className="trusted-countdown"><strong>{daysLeft(owned.opensAt)} {daysLeft(owned.opensAt)===1?'day':'days'}</strong><span>left · opens {short(owned.opensAt)}</span></div>}
        {owned.access!=='WAITING'&&<p className="debt-note">{ownerLine(owned)}.</p>}
        <div className="ledger-detail-actions">
          {owned.access==='WAITING'&&<><button type="button" className="button sign-danger" onClick={()=>then({kind:'close',id:owned.id,name:owned.name,closing:'REFUSED'})}>Refuse request</button><button type="button" className="button sign-secondary" onClick={()=>then({kind:'share',id:owned.id,name:owned.name})}>Share now</button><p className="sign-note">Doing nothing is fine. It opens on {short(owned.opensAt!)}.</p></>}
          {owned.status==='INVITED'&&<button type="button" className="button button-primary sign-primary" disabled={busy} onClick={()=>{setManage(null);void renew(owned);}}>Share link</button>}
          {owned.status==='ACCEPTED'&&owned.access==='NONE'&&<button type="button" className="button sign-secondary" onClick={()=>then({kind:'share',id:owned.id,name:owned.name})}>Share now</button>}
          {owned.access==='OPEN'&&<button type="button" className="button sign-secondary" onClick={()=>then({kind:'close',id:owned.id,name:owned.name,closing:'STOPPED'})}>Stop sharing</button>}
          <button type="button" className="button sign-tertiary" onClick={()=>then({kind:'remove',id:owned.id,name:owned.name})} aria-label={`Remove ${owned.name}`}>Remove</button>
        </div>
      </div>}
    </Panel>

    <Panel open={!!by} onOpenChange={o=>{if(!o)setManage(null);}} title={by?.ownerName??'Trusted contact'} description={by?'You’re their trusted contact.':undefined}>
      {by&&<div className="ledger-detail">
        {by.access==='NONE'&&<p className="debt-note">{by.closedAt?`${by.ownerName} isn’t sharing their records with you right now. You can ask again.`:`If ${by.ownerName} can no longer manage their debts, you can ask to see them. We’ll email ${by.ownerName}, and you’ll get access after ${waitingDays} days unless they refuse.`}</p>}
        {by.access==='WAITING'&&<p className="debt-note">You asked to see {by.ownerName}’s records. You can see them from {formatDate(by.opensAt!)} unless they refuse.</p>}
        <div className="ledger-detail-actions">
          {by.access==='NONE'&&<button type="button" className="button button-primary sign-primary" onClick={()=>then({kind:'request',id:by.id,name:by.ownerName})}>Ask to see records</button>}
          {by.access==='OPEN'&&<Link className="button button-primary sign-primary" href={`${appBase(demo)}/trusted-contacts/${by.id}`}>View {by.ownerName}’s records</Link>}
          <button type="button" className="button sign-tertiary" onClick={()=>then({kind:'leave',id:by.id,name:by.ownerName})}>Stop being a contact</button>
        </div>
      </div>}
    </Panel>
    <Flow open={adding} onOpenChange={value=>{if(!busy){setAdding(value);setError('');}}} kicker="Trusted contact" title={invitation?`Send the link to ${invitation.name}`:'Add a trusted contact'} sub={invitation?'treeti doesn’t email invitations, so the link comes from you.':'Someone you trust to handle your affairs, such as a spouse or an adult child.'} panels={<>
      <Panel open={sheet==='who'} onOpenChange={o=>setSheet(o?'who':null)} title="Who do you trust?" description="Use the name they’re known by.">
        <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(name.trim().length<2){setPanelError('Add their full name.');return;}setPanelError('');setSheet(email.trim()?null:'email');}}>
          <label className="create-field"><span className="create-field-label">Full name</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={120} autoComplete="off" placeholder="Maryam Bello"/></label>
          <ErrorMessage message={panelError}/>
          <button type="submit" className="button button-primary sign-primary">{email.trim()?'Done':'Next: their email'}</button>
        </form>
      </Panel>
      <Panel open={sheet==='email'} onOpenChange={o=>setSheet(o?'email':null)} title="Their email address" description="They’ll sign in with this email to accept.">
        <form className="ask-form" noValidate onSubmit={e=>{e.preventDefault();if(!/^\S+@\S+\.\S+$/.test(email.trim())){setPanelError('Enter an email address, like name@example.com.');return;}setPanelError('');setSheet(null);}}>
          <label className="create-field"><span className="create-field-label">Email address</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} maxLength={254} autoComplete="off" placeholder={demo?'maryam@example.test':'name@example.com'}/></label>
          {demo&&<p className="record-explain">Demo contacts: maryam@example.test and yusuf@example.test.</p>}
          <ErrorMessage message={panelError}/>
          <button type="submit" className="button button-primary sign-primary">Done</button>
        </form>
      </Panel>
    </>}>
      {invitation?<div className="record-invites"><InviteLink url={invitation.url} note={`Send this private link to ${invitation.name} yourself. They sign in with their email address to accept.`} shareMessage={shareMessage}/><Button onClick={()=>setAdding(false)}>Done</Button></div>:<>
        <p className="create-sentence"><W>If I can’t,</W> <Blank state={sheet==='who'||!name.trim()?'current':'filled'} label={name.trim()?`Trusted contact: ${name}. Change`:'Choose who you trust'} onClick={()=>{setPanelError('');setSheet('who');}}>{name.trim()||'who'}</Blank> <W>can ask to see my records.</W> <W>They’ll sign in as</W> <span className="create-nowrap"><Blank state={sheet==='email'?'current':email.trim()?'filled':'empty'} label={email.trim()?`Email: ${email}. Change`:'Choose their email address'} onClick={()=>{setPanelError('');setSheet('email');}}>{email.trim()||'their email'}</Blank><W>.</W></span></p>
        <p className="record-explain">If they ask, we’ll email you. If you don’t refuse within {waitingDays} days, they can see your debts and loan agreements. Read only.</p>
        <ErrorMessage message={error}/>
        <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={busy||name.trim().length<2||!email.trim()} aria-busy={busy} onClick={()=>void add()}>Add trusted contact</button></div>
      </>}
    </Flow>
    <Modal open={!!confirm} onOpenChange={value=>{if(!busy&&!value){setConfirm(null);setError('');}}} title={copy?.title??''}>
      {copy&&<div className="dialog-form"><p>{copy.body}</p><ErrorMessage message={error}/><div className="dialog-actions"><Button type="button" variant="ghost" onClick={()=>setConfirm(null)} disabled={busy}>Cancel</Button><Button variant={copy.danger?'danger':'primary'} busy={busy} onClick={()=>void act()}>{copy.action}</Button></div></div>}
    </Modal>
  </div>;
}

/** One line saying where things stand with a trusted contact. */
function ownerLine(c:OwnerView){return c.status==='INVITED'?'Invited. Hasn’t accepted yet':c.access==='OPEN'?'Can see your records':c.access==='WAITING'?'Asked to see your records':'Accepted. Can ask to see your records';}

/** The read-only copy of someone's records that a trusted contact sees once access is open. */
export function SharedRecordsView({id,records,demo}:{id:string;records:SharedRecords;demo:boolean}){
  const owner=records.ownerName,first=firstName(owner),owes=records.agreements.filter(a=>a.ownerRole==='BORROWER'),owed=records.agreements.filter(a=>a.ownerRole==='LENDER');
  const pdf=(a:SharedAgreement)=>`${apiBase(demo)}/trusted/${id}/agreements/${a.id}/pdf`;
  const empty=!records.agreements.length&&!records.debts.length;
  const sum=(items:{remainingMinor:string;currency:string}[])=>{const m=new Map<string,bigint>();for(const i of items)m.set(i.currency,(m.get(i.currency)??0n)+BigInt(i.remainingMinor));return [...m].map(([c,v])=>money(v.toString(),c)).join(' + ');};
  const oweItems=[...owes,...records.debts],people=new Set([...owes.map(a=>a.otherName),...records.debts.map(d=>d.person)]).size;
  return <div className="ledger">
    <header className="detail-bar notices-bar"><Link className="detail-icon-button" href={`${appBase(demo)}/trusted-contacts`} aria-label="Trusted contacts"><ArrowLeft size={18} aria-hidden/></Link><h1 className="notices-title">{first}’s records</h1><span/></header>
    <p className="trusted-banner"><Eye size={16} aria-hidden/>Read only. {first} can stop sharing at any time.</p>
    {empty?<section className="agreements-empty"><span className="agreements-empty-icon" aria-hidden><UsersRound size={26}/></span><h2>Nothing recorded</h2><p>{owner} hasn’t recorded any debts or loan agreements in treeti.</p></section>
    :<header className="ledger-head"><p className="ledger-caption">{oweItems.length?`${first} owes`:`Owed to ${first}`}</p><p className="ledger-amount" style={fitChars(oweItems.length?sum(oweItems):sum(owed))}>{oweItems.length?sum(oweItems):sum(owed)}</p><p className="ledger-caption">{oweItems.length?`across ${people===1?'1 person':`${people} people`}${owed.length?` · and is owed ${sum(owed)}`:''}`:''}</p></header>}
    {oweItems.length>0&&<section aria-labelledby="owes" className="agreements-group ledger-group"><h2 id="owes" className="kit-overline agreements-group-title">{first} owes</h2><ul>
      {owes.map(a=><li key={a.id}><SharedRow name={a.otherName} remaining={a.remainingMinor} original={a.principalMinor} currency={a.currency} meta={<>Shared agreement · due {formatDate(a.dueDate).replace(/ \d{4}$/,'')} · <a className="kit-link" href={pdf(a)}>PDF</a></>}/></li>)}
      {records.debts.map(d=><li key={d.id}><SharedRow name={d.person} remaining={d.remainingMinor} original={d.amountMinor} currency={d.currency} meta={<>Private debt{d.witnesses.length>0&&<> · Witnessed by {d.witnesses.join(', ')}</>}</>}/></li>)}
    </ul></section>}
    {owed.length>0&&<section aria-labelledby="owed" className="agreements-group ledger-group"><h2 id="owed" className="kit-overline agreements-group-title">Owed to {first}</h2><ul>
      {owed.map(a=><li key={a.id}><SharedRow name={a.otherName} remaining={a.remainingMinor} original={a.principalMinor} currency={a.currency} meta={<>Shared agreement · due {formatDate(a.dueDate).replace(/ \d{4}$/,'')} · <a className="kit-link" href={pdf(a)}>PDF</a></>}/></li>)}
    </ul></section>}
    {records.debts.length>0&&<p className="quiet-note debt-footnote">Private debts were written down by {owner} alone. The other person didn’t confirm them.</p>}
  </div>;
}
function SharedRow({name,remaining,original,currency,meta}:{name:string;remaining:string;original:string;currency:string;meta:React.ReactNode}){
  const total=BigInt(original),left=BigInt(remaining),fraction=total>0n?Number(total-left)/Number(total):0,paid=left===0n;
  return <article className="ledger-row" aria-label={name}><div className="agreement-row">
    <span className="agreement-row-avatar"><RingAvatar name={name} fraction={fraction}/></span>
    <span className="agreement-row-person"><span className="agreement-row-name">{name}</span></span>
    <span className="agreement-row-progress"><span className="agreement-row-meta">{meta}</span></span>
    <span className={`agreement-row-left${longAmount(money(paid?original:remaining,currency))?' long':''}`}><span className="agreement-row-amount"><Amount text={money(paid?original:remaining,currency)} currency={currency}/></span><span className="agreement-row-caption">{paid?'paid back':'left'}</span></span>
  </div></article>;
}
/** Shown at /trusted/<token>: the invited person accepts after signing in with the invited email. */
export function TrustedInvitation({token,ownerName,maskedEmail,authenticated,demo}:{token:string;ownerName:string|null;maskedEmail:string|null;authenticated:boolean;demo:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),router=useRouter();
  async function accept(){setBusy(true);setError('');try{
    await api<{id:string}>(`${apiBase(demo)}/trusted/accept/${token}`,{},crypto.randomUUID());
    router.push(`${appBase(demo)}/trusted-contacts`);router.refresh();
  }catch(e){setError((e as Error).message);setBusy(false);}}
  if(!ownerName)return <section className="invitation-page trusted-invitation"><h1>This invitation is no longer active.</h1><p className="lede">Ask the person who invited you for a new link.</p></section>;
  return <section className="invitation-page trusted-invitation">
    <span className="success-emblem" aria-hidden><HeartHandshake size={32}/></span>
    <h1>Become {ownerName}’s trusted contact?</h1>
    <p className="lede">{ownerName} has chosen you as someone who can see their debts and loan agreements if they can’t manage them.</p>
    <p>You can’t see anything yet. Once you accept, you can ask to see their records. {ownerName} gets an email and has {waitingDays} days to refuse.</p>
    <ErrorMessage message={error}/>
    {authenticated?<Button busy={busy} onClick={()=>void accept()}>Accept</Button>:<><p className="quiet-note">Sign in with {maskedEmail} to accept.</p><Link className="button button-primary" href={`/login?next=${encodeURIComponent(`/trusted/${token}`)}`}>Sign in to accept <ArrowRight size={16} aria-hidden/></Link></>}
  </section>;
}

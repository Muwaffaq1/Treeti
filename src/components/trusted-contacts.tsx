'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,Clock3,Download,HeartHandshake,Mail,Plus,ShieldCheck,UserRound,UsersRound} from 'lucide-react';
import type {ContactView,OwnerView} from '@/modules/trusted/model';
import {trustedContactLimit,waitingDays} from '@/modules/trusted/limits';
import type {SharedAgreement,SharedDebt,SharedRecords} from '@/modules/trusted/summary';
import {money} from '@/lib/money';
import {api,apiBase,appBase} from './client-api';
import {formatDate} from './agreement-utils';
import {InviteLink} from './create-agreement';
import {Button,ErrorMessage,Field,Modal} from './ui';

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
  const [invitation,setInvitation]=useState<Response['invitation']>(),[confirm,setConfirm]=useState<Confirm|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const keys=useRef(new Map<string,string>());
  const key=(text:string)=>{if(!keys.current.has(text))keys.current.set(text,crypto.randomUUID());return keys.current.get(text)!;};
  const base=`${apiBase(demo)}/trusted`,full=lists.owned.length>=trustedContactLimit;
  function openAdd(){setName('');setEmail('');setInvitation(undefined);setError('');setAdding(true);}
  async function add(){if(busy)return;setBusy(true);setError('');try{
    const body={name,email},result=await api<Response>(base,body,key(JSON.stringify(body)));
    setLists(result);setInvitation(result.invitation);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function renew(view:OwnerView){if(busy)return;setBusy(true);setError('');try{
    const result=await api<Response>(`${base}/${view.id}/renew`,{},crypto.randomUUID());
    setLists(result);setInvitation(result.invitation);setAdding(true);
  }catch(e){setSuccess('');setError((e as Error).message);}finally{setBusy(false);}}
  async function act(){if(!confirm||busy)return;setBusy(true);setError('');try{
    const result=await api<Response>(`${base}/${confirm.id}/${actionPath[confirm.kind]}`,{},crypto.randomUUID());
    setLists(result);setSuccess(doneText[confirm.kind](confirm));setConfirm(null);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const copy=confirm&&confirmCopy[confirm.kind](confirm);
  return <>
    <div className="page-heading"><div><h1>Trusted contacts.</h1><p className="lede">Choose up to {trustedContactLimit} people who can see your debts if you can’t manage them yourself.</p></div>{!full&&<Button onClick={openAdd}><Plus size={18} aria-hidden/>Add a trusted contact</Button>}</div>
    <aside className="private-ledger-note" aria-label="How access works"><span className="private-ledger-icon" aria-hidden><ShieldCheck size={20}/></span><div><h2>How access works</h2><p>A trusted contact asks to see your records, and we email you. If you don’t refuse within {waitingDays} days, they can see your debts and loan agreements. You can share straight away, stop sharing or remove someone at any time.</p></div></aside>
    <div role="status">{success&&<div className="success-notice"><CheckCircle2 size={18} aria-hidden/>{success}<button onClick={()=>setSuccess('')}>Dismiss</button></div>}</div>
    {!confirm&&!adding&&<ErrorMessage message={error}/>}
    <section aria-labelledby="your-contacts" className="trusted-section">
      <div className="section-heading"><h2 id="your-contacts">Your trusted contacts <span className="count">{lists.owned.length}</span></h2></div>
      {!lists.owned.length&&<div className="empty-state"><span className="empty-icon" aria-hidden><UsersRound size={30}/></span><h3>No trusted contacts yet</h3><p>If something happens to you, the people you choose can see what you owe and what you’re owed, so it can be settled.</p><Button variant="secondary" onClick={openAdd}>Add a trusted contact <Plus size={16} aria-hidden/></Button></div>}
      <div className="trusted-list">{lists.owned.map(c=><article className="panel trusted-card" key={c.id}>
        <div className="trusted-card-top"><span className="avatar small" aria-hidden>{initials(c.name)}</span><div><h3>{c.name}</h3><p className="quiet-note">{c.email}</p></div><OwnerBadge view={c}/></div>
        {c.access==='WAITING'&&<div className="callout pending"><Clock3 size={20} aria-hidden/><p><strong>{c.name} asked to see your debts on {formatDate(c.requestedAt!)}.</strong> They’ll be able to see them from {formatDate(c.opensAt!)} unless you refuse.</p></div>}
        {c.access!=='WAITING'&&<p className="quiet-note">{c.status==='INVITED'?'Hasn’t accepted your invitation yet.':c.access==='OPEN'?'Can see your debts and loan agreements.':'Can’t see your records unless they ask and you don’t refuse.'}</p>}
        <div className="debt-card-actions">
          {c.access==='WAITING'&&<Button variant="secondary" onClick={()=>setConfirm({kind:'close',id:c.id,name:c.name,closing:'REFUSED'})}>Refuse request</Button>}
          {c.status==='ACCEPTED'&&c.access!=='OPEN'&&<Button variant="secondary" onClick={()=>setConfirm({kind:'share',id:c.id,name:c.name})}>Share now</Button>}
          {c.access==='OPEN'&&<Button variant="secondary" onClick={()=>setConfirm({kind:'close',id:c.id,name:c.name,closing:'STOPPED'})}>Stop sharing</Button>}
          {c.status==='INVITED'&&<Button variant="secondary" busy={busy} onClick={()=>void renew(c)}>Get a new link</Button>}
          <Button variant="ghost" onClick={()=>setConfirm({kind:'remove',id:c.id,name:c.name})} aria-label={`Remove ${c.name}`}>Remove</Button>
        </div>
      </article>)}</div>
    </section>
    <section aria-labelledby="trusted-by" className="trusted-section">
      <div className="section-heading"><h2 id="trusted-by">People who trust you <span className="count">{lists.trustedBy.length}</span></h2></div>
      {!lists.trustedBy.length&&<p className="panel inline-empty"><HeartHandshake size={24} aria-hidden/>When someone adds you as a trusted contact and you accept, they’ll appear here.</p>}
      <div className="trusted-list">{lists.trustedBy.map(c=><article className="panel trusted-card" key={c.id}>
        <div className="trusted-card-top"><span className="avatar small" aria-hidden>{initials(c.ownerName)}</span><div><h3>{c.ownerName}</h3><p className="quiet-note">Added you as a trusted contact</p></div></div>
        {c.access==='NONE'&&<p>{c.closedAt?`${c.ownerName} isn’t sharing their records with you right now. You can ask again.`:`If ${c.ownerName} can no longer manage their debts, you can ask to see them. We’ll email ${c.ownerName}, and you’ll get access after ${waitingDays} days unless they refuse.`}</p>}
        {c.access==='WAITING'&&<div className="callout pending"><Clock3 size={20} aria-hidden/><p>You asked to see {c.ownerName}’s records. You can see them from {formatDate(c.opensAt!)} unless they refuse.</p></div>}
        <div className="debt-card-actions">
          {c.access==='NONE'&&<Button variant="secondary" onClick={()=>setConfirm({kind:'request',id:c.id,name:c.ownerName})}>Ask to see records</Button>}
          {c.access==='OPEN'&&<Link className="button button-primary" href={`${appBase(demo)}/trusted-contacts/${c.id}`}>View {c.ownerName}’s records <ArrowRight size={16} aria-hidden/></Link>}
          <Button variant="ghost" onClick={()=>setConfirm({kind:'leave',id:c.id,name:c.ownerName})}>Stop being a contact</Button>
        </div>
      </article>)}</div>
    </section>
    <Modal open={adding} onOpenChange={value=>{if(!busy){setAdding(value);setError('');}}} title={invitation?`Send the link to ${invitation.name}`:'Add a trusted contact'} description={invitation?undefined:'Choose someone you trust to handle your affairs, such as a spouse or an adult child.'}>
      {invitation?<><InviteLink url={invitation.url} note={`treeti doesn’t email invitations. Send this private link to ${invitation.name} yourself. They sign in with their email address to accept.`} shareMessage={shareMessage}/><Button onClick={()=>setAdding(false)}>Done</Button></>
      :<form className="dialog-form" onSubmit={e=>{e.preventDefault();void add();}}>
        <Field label="Full name" icon={UserRound}><input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={120} autoComplete="off" placeholder="e.g. Maryam Bello"/></Field>
        <Field label="Email address" icon={Mail} hint="They’ll sign in with this email to accept."><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254} autoComplete="off" placeholder={demo?'maryam@example.test':'name@example.com'}/></Field>
        {demo&&<p className="quiet-note">Demo contacts: maryam@example.test and yusuf@example.test.</p>}
        <ErrorMessage message={error}/><div className="dialog-actions"><Button type="button" variant="ghost" onClick={()=>setAdding(false)} disabled={busy}>Cancel</Button><Button type="submit" busy={busy}>Add trusted contact</Button></div>
      </form>}
    </Modal>
    <Modal open={!!confirm} onOpenChange={value=>{if(!busy&&!value){setConfirm(null);setError('');}}} title={copy?.title??''}>
      {copy&&<div className="dialog-form"><p>{copy.body}</p><ErrorMessage message={error}/><div className="dialog-actions"><Button type="button" variant="ghost" onClick={()=>setConfirm(null)} disabled={busy}>Cancel</Button><Button variant={copy.danger?'danger':'primary'} busy={busy} onClick={()=>void act()}>{copy.action}</Button></div></div>}
    </Modal>
  </>;
}

function initials(name:string){return name.split(' ').map(part=>part[0]).slice(0,2).join('');}
function OwnerBadge({view}:{view:OwnerView}){
  const [label,tone]=view.status==='INVITED'?['Invited','status-awaiting_borrower']:view.access==='OPEN'?['Can see your records','status-active']:view.access==='WAITING'?['Asked to see records','status-awaiting_approval']:['Accepted','status-settled'];
  return <span className={`status-badge ${tone}`}><span className="status-dot"/>{label}</span>;
}

/** The read-only copy of someone's records that a trusted contact sees once access is open. */
export function SharedRecordsView({id,records,demo}:{id:string;records:SharedRecords;demo:boolean}){
  const owner=records.ownerName,owes=records.agreements.filter(a=>a.ownerRole==='BORROWER'),owed=records.agreements.filter(a=>a.ownerRole==='LENDER');
  const pdf=(a:SharedAgreement)=>`${apiBase(demo)}/trusted/${id}/agreements/${a.id}/pdf`;
  const empty=!records.agreements.length&&!records.debts.length;
  return <>
    <Link className="back-link" href={`${appBase(demo)}/trusted-contacts`}><ArrowLeft size={16} aria-hidden/>Trusted contacts</Link>
    <div className="page-heading"><div><h1>{owner}’s debts.</h1><p className="lede">Shared with you as a trusted contact. This is a read-only copy of what {owner} recorded in treeti.</p></div></div>
    {empty&&<section className="empty-state"><span className="empty-icon" aria-hidden><UsersRound size={30}/></span><h3>Nothing recorded</h3><p>{owner} hasn’t recorded any debts or loan agreements in treeti.</p></section>}
    {(owes.length>0||records.debts.length>0)&&<section aria-labelledby="owes" className="trusted-section"><div className="section-heading"><h2 id="owes">What {owner} owes</h2></div><div className="debt-grid">{owes.map(a=><AgreementCard key={a.id} agreement={a} pdf={pdf(a)}/>)}{records.debts.map(d=><DebtCard key={d.id} debt={d}/>)}</div></section>}
    {owed.length>0&&<section aria-labelledby="owed" className="trusted-section"><div className="section-heading"><h2 id="owed">What’s owed to {owner}</h2></div><div className="debt-grid">{owed.map(a=><AgreementCard key={a.id} agreement={a} pdf={pdf(a)}/>)}</div></section>}
    {records.debts.length>0&&<p className="quiet-note debt-footnote">Private records were written down by {owner} alone. The other person didn’t confirm them.</p>}
  </>;
}
function Amounts({remaining,original,currency}:{remaining:string;original:string;currency:string}){
  return <div className="debt-amounts"><div><span>Remaining</span><strong>{money(remaining,currency)}</strong></div><div><span>Original amount</span><strong>{money(original,currency)}</strong></div></div>;
}
function Paid({paid}:{paid:boolean}){return <span className={`status-badge ${paid?'status-active':'status-awaiting_approval'}`}><span className="status-dot"/>{paid?'Paid back':'Outstanding'}</span>;}
function AgreementCard({agreement:a,pdf}:{agreement:SharedAgreement;pdf:string}){
  return <article className="panel debt-card shared-records">
    <div className="debt-card-top"><div><p className="debt-record-meta">Agreement {a.publicId} · Due {formatDate(a.dueDate)}</p><h3>{a.ownerRole==='BORROWER'?`Borrowed from ${a.otherName}`:`Lent to ${a.otherName}`}</h3></div><Paid paid={a.remainingMinor==='0'}/></div>
    <Amounts remaining={a.remainingMinor} original={a.principalMinor} currency={a.currency}/>
    <a className="text-link" href={pdf}><Download size={15} aria-hidden/>Download agreement PDF</a>
  </article>;
}
function DebtCard({debt:d}:{debt:SharedDebt}){
  return <article className="panel debt-card shared-records">
    <div className="debt-card-top"><div><p className="debt-record-meta">Private record · Debt date {formatDate(d.date)}</p><h3>Owes {d.person}</h3>{d.witnesses.length>0&&<p className="debt-witnessed"><UsersRound size={14} aria-hidden/>Witnessed by {d.witnesses.join(', ')}</p>}</div><Paid paid={d.remainingMinor==='0'}/></div>
    <Amounts remaining={d.remainingMinor} original={d.amountMinor} currency={d.currency}/>
    {d.dueDate&&<p className="quiet-note">Repayment due {formatDate(d.dueDate)}</p>}
  </article>;
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

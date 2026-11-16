'use client';
import {track} from '@/lib/analytics';
import Link from 'next/link';
import {canResendInvitation} from '@/modules/agreements/invitation-resend';
import {reminderMessage,waitingOn} from '@/modules/agreements/waiting-on';
import {calendarDate} from '@/lib/calendar';
import {useEffect,useState} from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Clock3,Download,FileCheck2,FileText,HeartHandshake,Info,MessageCircle,MoreHorizontal,Send,ShieldCheck,X} from '@/components/icons';
import type {Actor,Aggregate} from '@/modules/agreements/types';
import {usesDigitalWitnesses} from '@/modules/agreements/witness-policy';
import {money,parseMoney} from '@/lib/money';
import {RepaymentSchedule} from './repayment-schedule';
import {installmentProgress,repaymentLabel} from '@/modules/agreements/repayment-plan';
import {Avatar,Overline} from './kit';
import {SignFlow,AskPanels} from './sign-flow';
import {MomentOverlay,firstTime,type Moment} from './moments';
import {witnessDraftKey} from './create-blanks';
import {firstName} from './person-colour';
import {nextWhen} from './dates';
import {api,apiBase,appBase} from './client-api';
import {currentVersion,eventText,formatDate,formatTime,hasApproval,participantFor,witnesses} from './agreement-utils';
import {Button,DisclosureSummary,ErrorMessage} from './ui';
import {InviteLink,type InvitationLinkData} from './create-agreement';
import {ActionFlow} from './action-flow';
type DialogState={action:string;targetId?:string};
const titles:Record<string,string>={'agree-and-send':'Agree and invite the borrower',send:'Invite the borrower',approve:'Confirm the terms', 'request-change':'Ask for a change',decline:'Decline this proposal','invite-witness':'Invite a witness','invite-witnesses':'Invite witnesses',attest:'Your role as a witness','decline-witness':'Decline this invitation',finalize:'Preserve the agreed record',repayment:'Record a repayment','confirm-repayment':'Confirm this repayment','dispute-repayment':'Ask to clarify this repayment',forgiveness:'Offer forgiveness','confirm-forgiveness':'Acknowledge forgiveness',settle:'Acknowledge settlement',cancel:'Cancel this proposal'};
const actionLabels:Record<string,string>={'agree-and-send':'Agree and send',send:'Create private invitation',approve:'Approve these terms','request-change':'Send change request',decline:'Decline proposal','invite-witness':'Create witness invitation','invite-witnesses':'Create witness invitations',attest:'Confirm as witness','decline-witness':'Decline witness invitation',finalize:'Finalize agreement',repayment:'Record payment','confirm-repayment':'Confirm payment','dispute-repayment':'Record clarification request',forgiveness:'Offer forgiveness','confirm-forgiveness':'Acknowledge forgiveness',settle:'Confirm debt fully settled',cancel:'Cancel proposal'};
export function AgreementDetail({initial,actor,demo}:{initial:Aggregate;actor:Actor;demo:boolean}){
  const [a,setA]=useState(initial),[dialog,setDialog]=useState<DialogState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[invites,setInvites]=useState<InvitationLinkData[]>([]),[modalInvites,setModalInvites]=useState<InvitationLinkData[]>([]),[versionId,setVersionId]=useState(initial.currentVersionId);
  const [signature,setSignature]=useState(''),[affirmed,setAffirmed]=useState(false),[reason,setReason]=useState(''),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate()),[method,setMethod]=useState('Bank transfer'),[reference,setReference]=useState(''),[name,setName]=useState(''),[contact,setContact]=useState(''),[witnessDrafts,setWitnessDrafts]=useState([{name:'',contact:''},{name:'',contact:''}]),[file,setFile]=useState<File|null>(null),[proofId,setProofId]=useState<string|null>(null);
  const [resendingId,setResendingId]=useState<string|null>(null);
  const [signing,setSigning]=useState(false),[ask,setAsk]=useState<'change'|'reject'|null>(null),[moment,setMoment]=useState<Moment|null>(null);
  /** Picks the moment a change deserves: everyone signed, settled, or forgiveness offered. Automated browsers skip them. */
  function celebrate(prev:Aggregate,next:Aggregate,action:string,extra?:{amountMinor?:string}){
    if(typeof navigator!=='undefined'&&navigator.webdriver)return;
    const nv=next.versions.find(x=>x.id===next.currentVersionId)!,cur=nv.terms.currency;
    const borrower=next.participants.find(x=>x.role==='BORROWER');
    if(action==='forgiveness'&&extra?.amountMinor&&borrower){setMoment({kind:'eased',amountMinor:extra.amountMinor,currency:cur,person:borrower.name});return;}
    if(prev.status!=='ACTIVE'&&next.status==='ACTIVE'){firstTime('agreed',next.id);setMoment(agreedMoment(next));return;}
    if(prev.status!=='SETTLED'&&next.status==='SETTLED'){firstTime('settled',next.id);setMoment(settledMoment(next,actor.userId));}
  }
  // The other person sees the moment once, the first time they open it within a few days.
  useEffect(()=>{
    if(navigator.webdriver)return;const recent=(iso:string|null)=>!!iso&&Date.now()-Date.parse(iso)<4*86400000;
    if(initial.status==='ACTIVE'&&recent(initial.finalizedAt)&&firstTime('agreed',initial.id))setMoment(agreedMoment(initial));
    else if(initial.status==='SETTLED'&&recent(initial.settledAt)&&firstTime('settled',initial.id))setMoment(settledMoment(initial,actor.userId));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const [key,setKey]=useState(''),[closeAgreement,setCloseAgreement]=useState(false),[editSignature,setEditSignature]=useState(false);
  const v=currentVersion(a),shown=a.versions.find(v=>v.id===versionId)??v,p=participantFor(a,actor.userId),witness=p.role==='WITNESS',ownApproved=hasApproval(a,p.role),base=appBase(demo),endpoint=`${apiBase(demo)}/agreements/${a.id}`,waiting=waitingOn(a,p);
  const digitalWitnesses=usesDigitalWitnesses(v);
  const closed=['SETTLED','DECLINED','CANCELLED'].includes(a.status),pastDate=v.terms.dueDate<calendarDate()&&a.status==='ACTIVE';
  const attested=a.attestations.some(w=>w.participantId===p.id&&w.versionId===v.id),witnessCount=witnesses(a).length,requestedWitnessCount=a.participants.filter(x=>x.role==='WITNESS'&&x.versionIds.includes(v.id)).length;
  const invitationStorageKey=demo?`ahd:invites:${a.id}:${a.currentVersionId}`:'disabled';
  useEffect(()=>{if(invitationStorageKey==='disabled'){return;}try{const stored=sessionStorage.getItem(invitationStorageKey);setInvites(stored?JSON.parse(stored) as InvitationLinkData[]:[]);}catch{setInvites([]);}},[invitationStorageKey]);
  // The home brief links here with ?respond=sign or ?respond=decline: open that step once, then tidy the address.
  useEffect(()=>{const respond=new URLSearchParams(window.location.search).get('respond');if(respond!=='decline'&&respond!=='sign')return;window.history.replaceState(null,'',window.location.pathname);const pending=['AWAITING_BORROWER','AWAITING_APPROVAL'].includes(a.status);if(respond==='decline'&&p.role==='BORROWER'&&pending)setAsk('reject');if(respond==='sign'&&p.role!=='WITNESS'&&pending&&!ownApproved)setSigning(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  function rememberInvites(next:InvitationLinkData[]){setInvites(next);if(demo){try{sessionStorage.setItem(invitationStorageKey,JSON.stringify(next));}catch{}}}
  function open(action:string,targetId?:string){setDialog({action,targetId});setModalInvites([]);setError('');setSignature(actor.name);setAffirmed(false);setReason('');setAmount('');setReference('');setName('');setContact('');setWitnessDrafts(savedWitnesses(a.id,action));setFile(null);setProofId(null);setCloseAgreement(false);setEditSignature(false);setKey(crypto.randomUUID());}
  async function reload(){try{const r=await api<{agreement:Aggregate}>(endpoint);setA(r.agreement);setVersionId(r.agreement.currentVersionId);setDialog(null);setError('');setSuccess('The latest version is now shown. Review it before confirming.');}catch(e){setError((e as Error).message);}}
  async function submit(){
    if(!dialog)return;setBusy(true);setError('');
    try{
      const action=dialog.action;
      const body:Record<string,unknown>={action,expectedVersionId:v.id};
      if(dialog.targetId)body.targetId=dialog.targetId;
      if(['approve','attest','agree-and-send'].includes(action))Object.assign(body,{signature,affirmed});
      if(['repayment','confirm-repayment'].includes(action))body.closeAgreement=closeAgreement;
      if(action==='settle')body.affirmed=affirmed;
      if(['request-change','decline','decline-witness','forgiveness'].includes(action))body.reason=reason;
      if(action==='attest')Object.assign(body,{educated:affirmed});
      if(action==='invite-witness')Object.assign(body,{name:witnessDrafts[0].name,contact:witnessDrafts[0].contact});
      if(action==='invite-witnesses')body.witnesses=witnessDrafts.filter(w=>w.name.trim()&&w.contact.trim());
      if(action==='dispute-repayment')body.note=reason;
      if(action==='forgiveness')body.amountMinor=parseMoney(amount);
      if(action==='repayment'){
        let proof=proofId;
        if(file&&!proof){const form=new FormData();form.append('file',file);const response=await fetch(`${endpoint}/proof`,{method:'POST',body:form});const result=await response.json();if(!response.ok)throw new Error(result.message);proof=result.proofId;setProofId(proof);}
        Object.assign(body,{amountMinor:parseMoney(amount),date,method,reference,note:reason,...(proof?{proofId:proof}:{})});
      }
      const r=await api<{agreement:Aggregate;invitation?:InvitationLinkData;invitations?:InvitationLinkData[]}>(`${endpoint}/${action}`,body,key);celebrate(a,r.agreement,action,{amountMinor:action==='forgiveness'?String(body.amountMinor):undefined});setA(r.agreement);setVersionId(r.agreement.currentVersionId);setSuccess(eventText[r.agreement.events.at(-1)?.type??'']||'Your action has been recorded.');
      const issued=[...(r.invitation?[r.invitation]:[]),...(r.invitations??[])];
      if(issued.length){const byParticipant=new Map(invites.map(link=>[link.participantId??link.url,link]));issued.forEach(link=>byParticipant.set(link.participantId??link.url,link));rememberInvites([...byParticipant.values()]);setModalInvites(issued);}else setDialog(null);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  /** Runs one command for the sign flow and its panels, and shows the result here. */
  async function runAction(action:string,extra:Record<string,unknown>){
    const r=await api<{agreement:Aggregate}>(`${endpoint}/${action}`,{action,expectedVersionId:v.id,...extra},crypto.randomUUID());
    celebrate(a,r.agreement,action);setA(r.agreement);setVersionId(r.agreement.currentVersionId);setSuccess(eventText[r.agreement.events.at(-1)?.type??'']||'Your action has been recorded.');return r.agreement;
  }
  async function resend(participantId:string){
    if(busy)return;setBusy(true);setResendingId(participantId);setError('');setSuccess('');
    try{
      const r=await api<{agreement:Aggregate;invitation?:InvitationLinkData}>(`${endpoint}/resend-invitation`,{action:'resend-invitation',expectedVersionId:v.id,targetId:participantId},crypto.randomUUID());
      setA(r.agreement);if(r.invitation){const byParticipant=new Map(invites.map(link=>[link.participantId??link.url,link]));byParticipant.set(participantId,r.invitation);rememberInvites([...byParticipant.values()]);}
      const recipientName=r.invitation?.name??a.participants.find(person=>person.id===participantId)?.name??'the recipient';
      setSuccess(`A fresh private link is ready for ${recipientName}. Share it with them from Invitation links. The terms and existing confirmations are unchanged.`);
    }catch(e){setError((e as Error).message);}finally{setBusy(false);setResendingId(null);}
  }
  const clearedMinor=(BigInt(v.terms.principalMinor)-BigInt(a.balanceMinor)).toString();
  const clearedPercent=Number(BigInt(clearedMinor)*10000n/BigInt(v.terms.principalMinor))/100;
  const witnessDeclined=a.events.some(e=>e.type==='WITNESS_DECLINED'&&e.actorId===p.id&&e.versionId===v.id),witnessSlots=Math.max(1,Math.min(2,v.terms.requiredWitnesses-requestedWitnessCount));
  const them=a.participants.find(x=>x.role!=='WITNESS'&&x.userId!==actor.userId),themName=them?.name||'A shared agreement',lenderName=a.participants.find(x=>x.role==='LENDER')?.name||'The lender';
  const cur=v.terms.currency,principal=money(v.terms.principalMinor,cur),plan=v.terms.installments?.payments??[],progress=plan.length?installmentProgress(a,plan):[];
  const nextPart=progress.find(x=>x.remainingMinor!=='0'),done=progress.filter(x=>x.remainingMinor==='0').length,today=calendarDate();
  const showBalance=!witness&&!!a.finalizedAt&&a.status!=='SETTLED',heroMinor=showBalance?a.balanceMinor:v.terms.principalMinor,sign=cur==='NGN'?'₦':`${cur} `;
  const heroLine=a.status==='SETTLED'?(p.role==='BORROWER'?<>You repaid <Who name={themName}/></>:p.role==='LENDER'?<><Who name={themName}/> repaid you</>:<>Settled between both parties</>)
    :witness?<><Who name={lenderName}/> asked you to witness</>
    :!a.finalizedAt?(p.role==='LENDER'?<>Proposed to <Who name={themName}/></>:<><Who name={themName}/> wants to lend you</>)
    :p.role==='LENDER'?<><Who name={themName}/> owes you</>:<>You owe <Who name={themName}/></>;
  const purpose=v.terms.purpose.trim().replace(/\.$/,'');
  const sub=[showBalance?`of ${principal}`:'', 'interest-free', !a.finalizedAt?repaymentLabel(v.terms).toLowerCase():'', purpose?`for ${purpose.charAt(0).toLowerCase()}${purpose.slice(1)}`:''].filter(Boolean).join(' · ');
  const countText=plan.length?`${done} of ${plan.length} paid`:BigInt(clearedMinor)>0n?`${money(clearedMinor,cur)} paid`:'Nothing paid yet';
  // Near the finish line the line says so (goal-gradient: people speed up when the end is in sight).
  const nextText=a.status==='SETTLEMENT_PENDING'?'Fully repaid':nextPart?(plan.length>2&&plan.length-done===1?`1 part to go · ${nextWhen(nextPart.dueDate,today)}`:`Next ${money(nextPart.remainingMinor,cur)} · ${nextWhen(nextPart.dueDate,today)}`):`Due ${nextWhen(v.terms.dueDate,today)}`;
  const [allParts,setAllParts]=useState(false),[allEvents,setAllEvents]=useState(false),[readOpen,setReadOpen]=useState(!a.finalizedAt);
  const nextIndex=nextPart?progress.indexOf(nextPart):progress.length;
  const visibleParts=allParts||progress.length<=4?progress:progress.slice(Math.max(0,Math.min(nextIndex-2,progress.length-4)),Math.max(0,Math.min(nextIndex-2,progress.length-4))+4);
  const canEdit=p.role==='LENDER'&&['AWAITING_BORROWER','AWAITING_APPROVAL','DRAFT'].includes(a.status);
  const signers=a.participants.filter(x=>x.role!=='WITNESS'||x.versionIds.includes(v.id));
  return <div className="detail">
    <header className="detail-bar">
      <Link className="detail-icon-button detail-back" href={`${base}/agreements`} aria-label="Your agreements"><ArrowLeft size={18} aria-hidden/></Link>
      <p className="detail-ref record-heading-meta">{a.publicId} · Version {v.number}</p>
      <Dropdown.Root modal={false}>
        <Dropdown.Trigger className="detail-icon-button" aria-label="More options"><MoreHorizontal size={18} aria-hidden/></Dropdown.Trigger>
        <Dropdown.Portal><Dropdown.Content className="utility-menu" align="end" sideOffset={8} collisionPadding={16}>
          {canEdit&&<Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/agreements/${a.id}/edit`}><FileText size={20} aria-hidden/><span>{a.status==='DRAFT'?'Edit draft':'Propose a new version'}</span></Link></Dropdown.Item>}
          {a.manifest&&<Dropdown.Item className="utility-menu-item" asChild><a href={`${endpoint}/pdf`}><Download size={20} aria-hidden/><span>Download agreement PDF</span></a></Dropdown.Item>}
          {a.manifest&&<Dropdown.Item className="utility-menu-item" asChild><Link href={`${base}/verify/${a.publicId}`}><ShieldCheck size={20} aria-hidden/><span>Check record integrity</span></Link></Dropdown.Item>}
          <Dropdown.Item className="utility-menu-item" onSelect={()=>{setReadOpen(true);requestAnimationFrame(()=>document.getElementById('agreement-terms')?.scrollIntoView({block:'start'}));}}><FileCheck2 size={20} aria-hidden/><span>Read the agreement</span></Dropdown.Item>
          {p.role==='LENDER'&&!a.finalizedAt&&!closed&&<><Dropdown.Separator className="utility-menu-divider"/><Dropdown.Item className="utility-menu-item detail-menu-danger" onSelect={()=>open('cancel')}><X size={20} aria-hidden/><span>Cancel this proposal</span></Dropdown.Item></>}
        </Dropdown.Content></Dropdown.Portal>
      </Dropdown.Root>
      <Link className="detail-icon-button detail-close" href={`${base}/agreements`} aria-label="Close agreement"><X size={18} aria-hidden/></Link>
    </header>
    <div className="detail-body">
    <section className="detail-hero" aria-labelledby="detail-title">
      <h1 id="detail-title" className="detail-hero-line">{heroLine}</h1>
      <p className="detail-hero-amount big-amount"><span className="detail-hero-sign">{sign}</span>{money(heroMinor,cur).slice(sign.length)}</p>
      <p className="detail-hero-sub">{sub}</p>
      {!witness&&a.finalizedAt&&a.status!=='SETTLED'&&<div className="detail-progress"><span className="kit-bar" aria-hidden><span style={{transform:`scaleX(${clearedPercent/100})`}}/></span><p className="progress-caption"><span key={countText} className={`count-tick ${done||BigInt(clearedMinor)>0n?'kit-count':'kit-count-quiet'}`}>{countText}</span><span>{nextText}</span></p></div>}
      {a.status==='SETTLED'&&<div className="detail-settled"><CheckCircle2 size={18} aria-hidden/><div><h2>Settled, and remembered.</h2><p>{a.adjustmentConfirmations.length?'Cleared through repayment and acknowledged forgiveness.':'Both parties confirmed no balance remains.'}</p></div></div>}
    </section>
    <div className="notice-region" role="status">{success&&<div className="success-notice"><CheckCircle2 size={18}/>{success}<button onClick={()=>setSuccess('')} aria-label="Dismiss confirmation">Dismiss</button></div>}</div>
    <ErrorMessage message={!dialog?error:''}/>
    {!digitalWitnesses&&!a.finalizedAt&&v.terms.requiredWitnesses>0&&<div className="callout"><Info size={20}/><div><p>This version uses the earlier direct-witness statement. The lender can propose an updated version for witnesses to acknowledge the terms online. Both parties will need to approve it again.</p>{p.role==='LENDER'&&!closed&&<Link className="text-link" href={`${base}/agreements/${a.id}/edit`}>Update witness wording <ArrowRight size={16}/></Link>}</div></div>}
    {pastDate&&<div className="callout pending"><Clock3 size={20}/><p>The recorded repayment date has passed. No additional interest or penalties are added by treeti. You can keep recording payments and discuss any change in circumstances together.</p></div>}
    {!closed&&versionId===a.currentVersionId&&<div className="detail-actions">
      {p.role==='LENDER'&&a.status==='DRAFT'&&<Button onClick={()=>open('agree-and-send')}>Agree and send</Button>}
      {p.role!=='WITNESS'&&['AWAITING_BORROWER','AWAITING_APPROVAL'].includes(a.status)&&!ownApproved&&<Button onClick={()=>{setSuccess('');setSigning(true);}}>Review and approve</Button>}
      {p.role==='BORROWER'&&['AWAITING_BORROWER','AWAITING_APPROVAL'].includes(a.status)&&<><Button variant="secondary" onClick={()=>setAsk('change')}>Ask for a change</Button><Button variant="ghost" onClick={()=>setAsk('reject')}>Reject request</Button></>}
      {p.role==='LENDER'&&a.status==='CHANGES_REQUESTED'&&<Link className="button button-primary" href={`${base}/agreements/${a.id}/edit`}>Review and update terms</Link>}
      {p.role!=='WITNESS'&&a.status==='AWAITING_WITNESSES'&&<>{witnessCount>=v.terms.requiredWitnesses?<Button onClick={()=>open('finalize')}>Finalize agreement</Button>:!digitalWitnesses?<p className="quiet-note">Update this version to use the simplified witness acknowledgment.</p>:requestedWitnessCount<v.terms.requiredWitnesses?<Button onClick={()=>open('invite-witnesses')}>{requestedWitnessCount?'Add remaining witnesses':'Add witnesses'}</Button>:<p className="quiet-note">Waiting for the requested witnesses to confirm.</p>}{digitalWitnesses&&witnessCount>=v.terms.requiredWitnesses&&v.terms.requiredWitnesses>0&&<Button variant="secondary" onClick={()=>open('invite-witnesses')}>Invite another witness</Button>}</>}
      {witness&&digitalWitnesses&&a.status==='AWAITING_WITNESSES'&&!attested&&!witnessDeclined&&<><Button onClick={()=>open('attest')}>Review witness invitation</Button><Button variant="ghost" onClick={()=>open('decline-witness')}>Decline witness invitation</Button></>}
      {!witness&&a.status==='ACTIVE'&&<><Button onClick={()=>open('repayment')}>Record a payment</Button>{p.role==='LENDER'&&<Button variant="secondary" onClick={()=>open('forgiveness')}>Offer forgiveness</Button>}</>}
      {!witness&&a.status==='SETTLEMENT_PENDING'&&!a.settlements.some(s=>s.participantId===p.id)&&<Button onClick={()=>open('settle')}>Acknowledge settlement</Button>}
    </div>}
    {!a.finalizedAt&&!closed&&<p className="quiet-note detail-note">This agreement has not been finalized. Both parties review and approve the same terms.</p>}
    {witness&&witnessDeclined&&<p className="quiet-note detail-note">You declined this witness invitation. Your response is preserved.</p>}
    {witness&&attested&&<p className="recorded-line detail-note"><CheckCircle2 size={17}/>Your witness response is recorded for this version.</p>}
    {!witness&&a.status==='SETTLEMENT_PENDING'&&a.settlements.some(s=>s.participantId===p.id)&&<p className="quiet-note detail-note">Your settlement acknowledgment is recorded. The other party’s acknowledgment is still needed.</p>}
    {!witness&&a.approvals.filter(x=>x.versionId===v.id&&x.action==='REQUESTED_CHANGE').length>0&&<section className="kit-card changes-panel"><Overline as="h2">A change was requested</Overline>{a.approvals.filter(x=>x.versionId===v.id&&x.action==='REQUESTED_CHANGE').map(x=><p key={x.id}>{x.affirmation}</p>)}<small>The earlier version stays in the history. A new version requires fresh approvals.</small></section>}

    <section className="kit-card detail-schedule" aria-labelledby="detail-schedule-title">
      <div className="kit-card-head"><Overline as="h2" id="detail-schedule-title">Schedule</Overline>{progress.length>4&&<button type="button" className="kit-link detail-link-button" aria-expanded={allParts} onClick={()=>setAllParts(x=>!x)}>{allParts?'Show fewer':`See all ${progress.length}`}</button>}</div>
      <ul className="detail-parts">{(progress.length?visibleParts:[{dueDate:v.terms.dueDate,amountMinor:v.terms.principalMinor,remainingMinor:a.finalizedAt?a.balanceMinor:v.terms.principalMinor,clearedMinor:'0'}]).map((part,i)=>{
        const paid=a.finalizedAt&&part.remainingMinor==='0',isNext=!!a.finalizedAt&&!paid&&(progress.length?part===nextPart:true);
        return <li key={`${part.dueDate}-${i}`} className={`detail-part${paid?' paid':''}${isNext?' next':''}`}><span className="detail-part-mark" aria-hidden>{paid&&<Check size={12}/>}</span><span className="detail-part-date">{isNext?`${weekdayShort(part.dueDate)} ${formatDate(part.dueDate).replace(/ \d{4}$/,'')} · next`:formatDate(part.dueDate).replace(/ \d{4}$/,'')}<span className="sr-only">{paid?', paid':isNext?', next':''}</span></span><span className="detail-part-amount">{money(part.amountMinor,cur)}</span></li>;})}</ul>
    </section>

    <section className="kit-card detail-signers participants-panel" aria-labelledby="detail-signers-title">
      <Overline as="h2" id="detail-signers-title">{a.finalizedAt?'Signed by':'Agreed together'}</Overline>
      <ul className="detail-signer-grid">{signers.map(person=>{const approval=a.approvals.find(x=>x.participantId===person.id&&x.versionId===v.id&&x.action==='ACCEPTED'),attestation=a.attestations.find(x=>x.participantId===person.id&&x.versionId===v.id),ws=a.witnessStatuses?.find(x=>x.participantId===person.id&&x.versionId===v.id),ok=!!approval||!!attestation||ws?.status==='ATTESTED';const role=person.role==='LENDER'?'Lender':person.role==='BORROWER'?'Borrower':'Witness';
        return <li key={person.id} className="detail-signer"><Avatar name={person.name} size={36}/><span className="detail-signer-name">{person.id===p.id?'You':firstName(person.name)}</span><span className={`detail-signer-role${ok?' ok':''}`}>{role}{ok?<><Check size={12} aria-hidden/><span className="sr-only">, signed</span></>:<span className="detail-signer-wait"> · waiting</span>}</span></li>;})}</ul>
      {versionId===a.currentVersionId&&a.participants.filter(person=>canResendInvitation(a,p,person)||waiting.some(w=>w.person.id===person.id)).length>0&&<div className="detail-signer-actions">{a.participants.map(person=><span key={person.id} className="detail-signer-action-group">{versionId===a.currentVersionId&&canResendInvitation(a,p,person)&&<Button variant="ghost" className="resend-invitation" aria-label={`Resend invitation to ${person.name}`} busy={resendingId===person.id} disabled={busy} onClick={()=>void resend(person.id)}><Send size={14} aria-hidden/>Resend invitation</Button>}{waiting.filter(w=>w.person.id===person.id).map(w=><Button key={w.person.id} variant="ghost" className="resend-invitation" aria-label={`Remind ${person.name} on WhatsApp`} onClick={()=>{track('reminder_shared',{method:'whatsapp'});window.open(`https://wa.me/?text=${encodeURIComponent(reminderMessage(w,new URL(`${base}/agreements/${a.id}`,window.location.origin).href))}`,'_blank','noopener,noreferrer');}}><MessageCircle size={14} aria-hidden/>Remind {firstName(person.name)} on WhatsApp</Button>)}</span>)}</div>}
      {!a.participants.some(x=>x.role==='WITNESS')&&v.terms.requiredWitnesses>0&&<p className="quiet-note">Witness invitations open after both parties approve.</p>}
      {a.status==='AWAITING_WITNESSES'&&!witness&&<p className="quiet-note witness-progress">{witnessCount} of {v.terms.requiredWitnesses} requested witnesses complete</p>}
      {witness&&<p className="quiet-note">You are a witness, not a guarantor. Your access covers this agreement version, not future repayment or hardship details.</p>}
    </section>

    {!witness&&invites.length>0&&<section className="kit-card invitation-links-panel"><Overline as="h2">Invitation links</Overline><p className="quiet-note">These links are for the named people only. You can copy them again whenever you need to share this version.</p>{invites.map(link=><InviteLink key={link.url} url={link.url} name={link.name} role={link.role}/>)}</section>}

    {!witness&&a.finalizedAt&&(a.repayments.length>0||a.adjustments.length>0)&&<section className="kit-card detail-payments"><Overline as="h2">Payments</Overline>{a.repayments.map(r=><div className="payment-row" key={r.id}><div className="payment-top"><strong>{money(r.amountMinor,cur)}</strong><span className={`payment-status ${r.status.toLowerCase()}`}>{r.status==='PROPOSED'?'Awaiting confirmation':r.status==='DISPUTED'?'Needs clarification':'Confirmed'}</span></div><p>{formatDate(r.date)} · {r.method}{r.reference?` · ${r.reference}`:''}</p>{r.note&&<p>{r.note}</p>}{r.status==='DISPUTED'&&<div className="callout pending"><Info size={17}/><p>{a.repaymentConfirmations.find(c=>c.repaymentId===r.id)?.note} The confirmed balance has not changed. Once clarified together, record a corrected payment with a new reference.</p></div>}<div className="payment-actions">{r.status==='PROPOSED'&&r.participantId!==p.id&&a.status==='ACTIVE'&&<><Button variant="secondary" onClick={()=>open('confirm-repayment',r.id)}>Confirm payment</Button><Button variant="ghost" onClick={()=>open('dispute-repayment',r.id)}>Request clarification</Button></>}{r.status==='CONFIRMED'&&<a className="text-link" href={`${endpoint}/receipt?payment=${r.id}`}><Download size={15}/>Download receipt</a>}{r.proofId&&<a className="text-link" href={`${endpoint}/proof/${r.proofId}`}><FileText size={15}/>View payment proof</a>}</div></div>)}
      {a.adjustments.map(adj=>{const acknowledged=a.adjustmentConfirmations.some(c=>c.adjustmentId===adj.id);return <div className="payment-row" key={adj.id}><div className="payment-top"><strong>{money(adj.amountMinor,cur)} forgiveness</strong><span className="payment-status">{acknowledged?'Acknowledged':'Awaiting acknowledgment'}</span></div><p>{adj.reason}</p>{!acknowledged&&p.role==='BORROWER'&&a.status==='ACTIVE'&&<Button variant="secondary" onClick={()=>open('confirm-forgiveness',adj.id)}>Acknowledge forgiveness</Button>}</div>;})}</section>}

    <section className="kit-card terms-panel" id="agreement-terms" aria-labelledby="agreement-terms-title">
      <div className="kit-card-head"><h2 className="kit-overline" id="agreement-terms-title">The agreement</h2><span className="detail-read-links"><button type="button" className="kit-link detail-link-button" aria-expanded={readOpen} aria-controls="agreement-terms-body" onClick={()=>setReadOpen(x=>!x)}>{readOpen?'Hide':'Read'}</button>{a.manifest&&<> · <a className="kit-link" href={`${endpoint}/pdf`} aria-label="Agreement PDF">PDF</a></>}</span></div>
      <div id="agreement-terms-body" hidden={!readOpen} className="detail-terms">
        <label className="version-select"><span className="sr-only">View agreement version</span><select value={shown.id} onChange={e=>setVersionId(e.target.value)} aria-label="View agreement version">{a.versions.map(x=><option key={x.id} value={x.id}>Version {x.number}{x.id===a.currentVersionId?' · Current':''}</option>)}</select></label>
        {shown.id!==v.id&&<p className="callout">You’re reading an earlier version. Its approvals do not apply to the current terms.</p>}
        <dl className="terms-list"><div><dt>Principal</dt><dd>{money(shown.terms.principalMinor,shown.terms.currency)}</dd></div><div className="balance-facts"><dt>Interest</dt>{' '}<dd>{money(shown.terms.interestMinor,shown.terms.currency)} · 0%</dd></div><div><dt>Agreement date</dt><dd>{formatDate(shown.terms.agreementDate)}</dd></div><div><dt>Repayment date</dt><dd>{formatDate(shown.terms.dueDate)}</dd></div><div><dt>Repayment structure</dt><dd>{repaymentLabel(shown.terms)}</dd></div><div><dt>Requested witnesses</dt><dd>{shown.terms.requiredWitnesses}</dd></div></dl>
        <RepaymentSchedule terms={shown.terms} agreement={!witness&&a.finalizedAt&&shown.id===a.manifest?.version.id?a:undefined}/>
        <details className="wording" open><DisclosureSummary>Read the full agreement wording</DisclosureSummary><p>{shown.text}</p></details>
        <div className="hash-note"><ShieldCheck size={17}/><div><strong>Version fingerprint</strong><code>{shown.hash}</code><small>A change to the terms creates a different fingerprint.</small></div></div>
        <p className="quiet-note">{shown.reason} · Created {formatTime(shown.createdAt)} (WAT)</p>
        {a.manifest?<div className="documents-panel">{!witness&&a.status==='SETTLED'&&<a href={`${endpoint}/settlement`} className="document-link"><span className="document-icon"><CheckCircle2 size={22}/></span><span><strong>Settlement record</strong><small>Both acknowledgments included</small></span><Download size={17}/></a>}{!witness&&<a className="text-link" href={`${endpoint}/manifest`} target="_blank" rel="noreferrer">View evidence manifest <ArrowRight size={15}/></a>}</div>:<p className="quiet-note">The final PDF is preserved automatically once both parties agree and the requested witnesses confirm.</p>}
      </div>
    </section>

    <section className="kit-card detail-history" aria-labelledby="detail-history-title"><div className="kit-card-head"><Overline as="h2" id="detail-history-title">History</Overline>{a.events.length>4?<button type="button" className="kit-link detail-link-button" aria-expanded={allEvents} onClick={()=>setAllEvents(x=>!x)}>{allEvents?'Show fewer':`See all ${a.events.length}`}</button>:<span className="detail-muted">WAT</span>}</div><ol className="timeline">{(allEvents?a.events:a.events.slice(-4)).map(e=><li key={e.id}><span className="timeline-dot"/><div><strong>{eventText[e.type]||'Record updated'}</strong>{Boolean(e.payload.reason)&&<p>{String(e.payload.reason)}</p>}<time dateTime={e.createdAt}>{formatTime(e.createdAt)}</time></div></li>)}</ol></section>
    <p className="side-note detail-footnote"><HeartHandshake size={20}/>A witness reads the terms and agrees to act as a witness. They do not guarantee repayment.</p>
    </div>
    <SignFlow open={signing} onOpenChange={setSigning} a={a} v={v} me={p} actor={actor} home={demo?'/demo':'/app'} run={runAction}/>
    <AskPanels ask={ask} onAsk={setAsk} lenderFirst={firstName(lenderName)} witnesses={a.participants.filter(x=>x.role==='WITNESS'&&x.versionIds.includes(v.id))} run={runAction} onDone={()=>setAsk(null)}/>
    <MomentOverlay moment={moment} onClose={()=>setMoment(null)} actions={moment?.kind==='settled'?<a className="button sign-secondary" href={`https://wa.me/?text=${encodeURIComponent(moment.thanksTo==='lender'?'Thank you for trusting me with the loan. It’s fully repaid, and the record is kept on treeti.':'Thank you for repaying in full. It’s settled, and the record is kept on treeti.')}`} target="_blank" rel="noreferrer">Send a thank-you</a>:undefined}/>
    <ActionFlow action={dialog?.action??null} targetId={dialog?.targetId} a={a} v={v} me={p} demo={demo} busy={busy} error={error} issued={modalInvites} witnessSlots={witnessSlots} witnessCount={witnessCount}
      drafts={{amount,date,method,reference,reason,name,contact,witnessDrafts,file,affirmed,signature,closeAgreement,editSignature}}
      set={patch=>{if('amount' in patch)setAmount(patch.amount!);if('date' in patch)setDate(patch.date!);if('method' in patch)setMethod(patch.method!);if('reference' in patch)setReference(patch.reference!);if('reason' in patch)setReason(patch.reason!);if('name' in patch)setName(patch.name!);if('contact' in patch)setContact(patch.contact!);if('witnessDrafts' in patch)setWitnessDrafts(patch.witnessDrafts!);if('file' in patch){setFile(patch.file??null);setProofId(null);}if('affirmed' in patch)setAffirmed(patch.affirmed!);if('signature' in patch)setSignature(patch.signature!);if('closeAgreement' in patch)setCloseAgreement(patch.closeAgreement!);if('editSignature' in patch)setEditSignature(patch.editSignature!);}}
      title={dialog?titles[dialog.action]:'Confirm'} description={dialog?.action==='attest'?'Read the terms and confirm whether you agree to act as a witness.':'Your response becomes part of the agreement history.'}
      submitLabel={dialog?(closeAgreement&&dialog.action==='repayment'?'Record final payment and close':closeAgreement&&dialog.action==='confirm-repayment'?'Confirm final payment and close':actionLabels[dialog.action]):''} danger={!!dialog&&['decline','cancel'].includes(dialog.action)}
      onSubmit={()=>void submit()} onClose={()=>{setDialog(null);setError('');}} onReload={()=>void reload()}/>
  </div>;
}

/** A name with its avatar, inside the hero sentence. */
function Who({name}:{name:string}){return <span className="detail-who"><Avatar name={name} size={28}/><span className="detail-who-name">{firstName(name)}</span></span>;}
const weekdayShort=(date:string)=>new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
/** Witnesses written down when the agreement was created, kept on this device until they can be invited. */
function savedWitnesses(agreementId:string,action:string){
  const blank=[{name:'',contact:''},{name:'',contact:''}];if(action!=='invite-witnesses')return blank;
  try{const saved=JSON.parse(localStorage.getItem(witnessDraftKey(agreementId))||'[]') as {name:string;contact:string}[];return [...saved,...blank].slice(0,2);}catch{return blank;}
}

function agreedMoment(a:Aggregate):Moment{
  const people=a.participants.filter(x=>x.role!=='WITNESS'||x.versionIds.includes(a.currentVersionId)).map(x=>({name:x.name,role:x.role==='LENDER'?'Lender' as const:x.role==='BORROWER'?'Borrower' as const:'Witness' as const}));
  return {kind:'agreed',publicId:a.publicId,people};
}
function settledMoment(a:Aggregate,userId:string):Moment{
  const v=a.versions.find(x=>x.id===a.currentVersionId)!,lender=a.participants.find(x=>x.role==='LENDER'),borrower=a.participants.find(x=>x.role==='BORROWER'),me=a.participants.find(x=>x.userId===userId);
  return {kind:'settled',principalMinor:v.terms.principalMinor,currency:v.terms.currency,parts:v.terms.installments?.payments.length??1,lender:lender?.name??'Lender',borrower:borrower?.name??'Borrower',other:(me?.role==='LENDER'?borrower:lender)?.name??'',thanksTo:me?.role==='BORROWER'?'lender':'borrower'};
}

'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Button,ErrorMessage} from './ui';
import type {PendingBorrowerInvitation} from '@/modules/agreements/pending-invitations';
import {useState,useSyncExternalStore} from 'react';
import {ArrowRight,ArrowUpRight,BadgeCheck,BookOpen,Check,FilePenLine,FileText,History,MessageSquareMore,Plus,Search,Send,ShieldCheck,UsersRound,WalletCards} from 'lucide-react';
import type {Actor,Aggregate} from '@/modules/agreements/types';
import {money} from '@/lib/money';
import {api,apiBase,appBase} from './client-api';
import {agreementBalances,activityFormatters,currentVersion,eventText,formatDate,needsAttention,nextTask,participantFor,statusLabels} from './agreement-utils';

export function StatusBadge({status}:{status:string}){return <span className={`status-badge status-${status.toLowerCase()}`}><span aria-hidden className="status-dot"/>{statusLabels[status]??status}</span>;}
export function Dashboard({agreements,invitations=[],actor,demo,listing=false}:{agreements:Aggregate[];invitations?:PendingBorrowerInvitation[];actor:Actor;demo:boolean;listing?:boolean}){
  const router=useRouter(),[opening,setOpening]=useState(''),[inviteError,setInviteError]=useState('');
  async function openInvitation(id:string){setOpening(id);setInviteError('');try{const result=await api<{agreementId:string}>(`${apiBase(demo)}/pending-invitations/${id}/claim`,{});router.push(`${appBase(demo)}/agreements/${result.agreementId}`);router.refresh();}catch(e){setInviteError((e as Error).message);}finally{setOpening('');}}
  const [filter,setFilter]=useState('All'),[query,setQuery]=useState('');const base=appBase(demo),attention=agreements.filter(a=>needsAttention(a,actor.userId));
  const attentionCount=attention.length+invitations.length;
  const {owedToYou,youOwe}=agreementBalances(agreements,actor.userId);
  const currentCount=agreements.filter(a=>a.status!=='CANCELLED').length;
  const cancelledCount=agreements.length-currentCount;
  const filtered=agreements.filter(a=>{const person=a.participants.find(p=>p.role!=='WITNESS'&&p.userId!==actor.userId);const matches=`${a.publicId} ${person?.name??''} ${currentVersion(a).terms.purpose}`.toLowerCase().includes(query.trim().toLowerCase());return matches&&(filter==='All'&&a.status!=='CANCELLED'||filter==='Active'&&['ACTIVE','SETTLEMENT_PENDING'].includes(a.status)||filter==='In progress'&&['AWAITING_BORROWER','AWAITING_APPROVAL','AWAITING_WITNESSES','CHANGES_REQUESTED'].includes(a.status)||filter==='Drafts'&&a.status==='DRAFT'||filter==='Settled'&&a.status==='SETTLED'||filter==='Cancelled'&&a.status==='CANCELLED');});
  const emptyDefault=filter==='All'&&!query.trim()&&currentCount===0;
  const emptyCancelled=filter==='Cancelled'&&!query.trim();
  return <><div className="page-heading"><div><h1>{listing?'Your agreements.':`As-salamu alaykum, ${actor.name.split(' ')[0]}.`}</h1><p className="lede">{listing?'Every proposal, confirmation and repayment, kept together.':'Review agreements and keep track of repayments.'}</p></div><Link className="button button-primary" href={`${base}/agreements/new`}><Plus size={18}/>New agreement</Link></div>
    {!listing&&<section className="overview-summary" aria-label="Agreement overview">
      <div className="overview-balance"><div className="overview-obligations">{[{label:'Money owed to you',...owedToYou},{label:'Money you owe',...youOwe}].map(({label,totals,count})=><section className="overview-obligation" key={label} aria-label={label}><h2>{label}</h2><div className="overview-balances">{totals.size?Array.from(totals,([currency,total])=><strong key={currency}>{money(total.toString(),currency)}</strong>):<strong>0</strong>}</div><p>{count===1?'1 active agreement':`${count} active agreements`}</p></section>)}</div><p>Shared agreements only · Private debts are in My debts.</p></div>
      <div className="overview-counts"><Link href={`${base}/agreements`} className="overview-stat"><span>Agreements</span><strong>{currentCount}</strong><ArrowUpRight size={18} aria-hidden/></Link>{attentionCount>0?<a href="#needs-attention" className="overview-stat"><span>Needs your attention</span><strong>{attentionCount}</strong><ArrowUpRight size={18} aria-hidden/></a>:<div className="overview-stat"><span>Needs your attention</span><strong>0</strong><small>Nothing to review</small></div>}</div>
    </section>}
    {(attentionCount>0&&(!listing||invitations.length>0))&&<section className="attention-section" id="needs-attention"><div className="section-heading"><h2>Needs your attention <span className="count">{attentionCount}</span></h2></div><ErrorMessage message={inviteError}/><div className="attention-list">{invitations.map(i=><article key={i.id} className="attention-row"><div className="attention-person"><span className="avatar attention-avatar" aria-hidden>{i.lenderName.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><h3>{i.lenderName}</h3><small>{i.publicId}</small></div><span className="attention-status">Invited</span></div><div className="attention-next"><p>You’re invited to review a loan agreement.</p><Button onClick={()=>void openInvitation(i.id)} busy={opening===i.id} disabled={!!opening}>Review agreement<ArrowRight size={16} aria-hidden/></Button></div><p className="quiet-note invitation-review-note">Opening it does not mean you accept the terms.</p></article>)}{attention.slice(0,3).map(a=>{
      const other=a.participants.find(p=>p.role!=='WITNESS'&&p.userId!==actor.userId);
      const review=['AWAITING_BORROWER','AWAITING_APPROVAL','CHANGES_REQUESTED'].includes(a.status);
      return <Link key={a.id} className="attention-row" href={`${base}/agreements/${a.id}`} aria-labelledby={`attention-person-${a.id} attention-task-${a.id}`}>
        <div className="attention-person"><span className="avatar attention-avatar" aria-hidden>{other?.name.split(' ').map(n=>n[0]).slice(0,2).join('')||'A'}</span><div><h3 id={`attention-person-${a.id}`}>{other?.name||'Shared agreement'}</h3><small>{a.publicId}</small></div><span className="attention-status">Your turn</span></div>
        <div className="attention-next"><p id={`attention-task-${a.id}`}>{nextTask(a,actor.userId)}</p><span className="attention-action">{review?'Review agreement':'Open agreement'}<ArrowRight size={16} aria-hidden/></span></div>
      </Link>;
    })}</div></section>}
    <section className="agreements-section"><div className="section-heading"><h2>{listing?'All agreements':'Your agreements'}</h2>{!listing&&<Link className="text-link" href={`${base}/agreements`}>View all <ArrowRight size={15}/></Link>}</div><div className="list-toolbar"><div className="filter-tabs" aria-label="Filter agreements">{['All','Active','In progress','Drafts','Settled','Cancelled'].map(f=><button key={f} aria-pressed={filter===f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f}</button>)}</div><label className="search-field"><Search size={16}/><span className="sr-only">Search agreements</span><input placeholder="Search a name or record" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
    <div className="agreement-grid">{filtered.map(a=>{const p=participantFor(a,actor.userId),v=currentVersion(a),other=a.participants.find(x=>x.role!=='WITNESS'&&x.userId!==actor.userId);const proposed=!a.finalizedAt;return <Link className="agreement-card" key={a.id} href={`${base}/agreements/${a.id}`}><div className="card-top"><span className="avatar person-avatar">{other?.name.split(' ').map(n=>n[0]).slice(0,2).join('')||'A'}</span><StatusBadge status={a.status}/></div><h3>{other?.name||'Shared agreement'}</h3><p>{p.role==='WITNESS'?'You’re a witness':p.role==='LENDER'?'You’re the lender':'You’re the borrower'} <span>·</span> {a.publicId}</p><div className="card-amount"><span>{p.role==='WITNESS'?'Agreed principal':proposed?'Proposed amount':'Remaining balance'}</span><strong>{money(proposed?v.terms.principalMinor:a.balanceMinor,v.terms.currency)}</strong></div><div className="card-bottom"><span>{a.status==='CANCELLED'?'Cancelled proposal':a.status==='SETTLED'?'Settled together':`Due ${formatDate(v.terms.dueDate)}`}</span><ArrowUpRight size={19}/></div></Link>;})}</div>
    {!filtered.length&&<div className="empty-state"><span className="empty-icon"><FileText size={30}/></span><h3>{emptyCancelled?'No cancelled agreements.':emptyDefault?'Every good agreement starts with a conversation.':'No agreements match this view.'}</h3><p>{emptyCancelled?'Proposals you cancel will be kept here.':emptyDefault?(cancelledCount?'Your cancelled proposals are kept in the Cancelled tab.':'When you’re ready, put the details in writing and review them together.'):'Try another name or choose a different tab.'}</p>{emptyDefault?<>{cancelledCount>0&&<button className="button button-secondary" onClick={()=>setFilter('Cancelled')}>View cancelled agreements</button>}<Link className="button button-primary" href={`${base}/agreements/new`}>Create an agreement</Link></>:query.trim()?<button className="button button-secondary" onClick={()=>setQuery('')}>Clear search</button>:<button className="button button-secondary" onClick={()=>setFilter('All')}>View all agreements</button>}</div>}</section>
    {!listing&&<Link className="guide-card" href={`${base}/guide`}><span className="guide-card-icon" aria-hidden><BookOpen size={24}/></span><div><h2>How treeti works</h2><p>A guide to agreements, repayments, private debts, and investments.</p></div><span className="guide-card-action">Read the guide<ArrowRight size={18} aria-hidden/></span></Link>}
  </>;
}
const subscribeTimeZone=()=>()=>{};
const browserTimeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone=()=>null;
function activityAppearance(type:string){
  if(['LENDER_APPROVED','BORROWER_APPROVED'].includes(type))return {Icon:BadgeCheck,tone:'confirmed'};
  if(['WITNESS_INVITED','WITNESS_ATTESTED','WITNESS_DECLINED'].includes(type))return {Icon:UsersRound,tone:type==='WITNESS_ATTESTED'?'confirmed':'neutral'};
  if(['AGREEMENT_FINALIZED','AGREEMENT_SETTLED','SETTLEMENT_ACKNOWLEDGED'].includes(type))return {Icon:ShieldCheck,tone:'confirmed'};
  if(type==='REPAYMENT_CONFIRMED')return {Icon:Check,tone:'confirmed'};
  if(type==='REPAYMENT_PROPOSED')return {Icon:WalletCards,tone:'pending'};
  if(['REPAYMENT_DISPUTED','BORROWER_REQUESTED_CHANGE'].includes(type))return {Icon:MessageSquareMore,tone:'pending'};
  if(type==='BORROWER_INVITED')return {Icon:Send,tone:'neutral'};
  if(['AGREEMENT_CREATED','VERSION_CREATED'].includes(type))return {Icon:FilePenLine,tone:'neutral'};
  return {Icon:History,tone:'neutral'};
}
export function Activity({agreements,demo}:{agreements:Aggregate[];demo:boolean}){
  const timeZone=useSyncExternalStore(subscribeTimeZone,browserTimeZone,serverTimeZone);
  const formats=activityFormatters(timeZone??'UTC');
  const entries=agreements.flatMap(a=>a.events.map(e=>({...e,agreementId:a.id,publicId:a.publicId,people:a.participants.filter(p=>p.role!=='WITNESS').map(p=>p.name).join(' & ')}))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||(a.agreementId===b.agreementId?b.sequence-a.sequence:0));
  const groups=new Map<string,typeof entries>();
  for(const entry of entries){const key=formats.dateKey.format(new Date(entry.createdAt));const day=groups.get(key);if(day)day.push(entry);else groups.set(key,[entry]);}
  return <div className="activity-page"><div className="page-heading"><div><h1>Activity</h1><p className="lede">Approvals, witness responses, and repayments across your agreements.</p></div><span className="activity-zone">{timeZone?`Your local time · ${timeZone.replaceAll('_',' ')}`:'Loading local time…'}</span></div>
    {timeZone&&Array.from(groups,([key,day])=><section className="activity-day" key={key} aria-labelledby={`activity-date-${key}`}><div className="activity-day-heading"><h2 id={`activity-date-${key}`}>{formats.day.format(new Date(day[0].createdAt))}</h2><span>{day.length===1?'1 event':`${day.length} events`}</span></div><ol className="activity-events">{day.map(e=>{const {Icon,tone}=activityAppearance(e.type);return <li key={e.id}><Link className="activity-event" href={`${appBase(demo)}/agreements/${e.agreementId}`}><span className={`activity-event-icon tone-${tone}`} aria-hidden><Icon size={20}/></span><div className="activity-event-copy"><h3>{eventText[e.type]||'Record updated'}</h3><p>{e.people}</p><small>{e.publicId}</small></div><time dateTime={e.createdAt} title={formats.full.format(new Date(e.createdAt))}>{formats.clock.format(new Date(e.createdAt))}</time><ArrowUpRight className="activity-event-arrow" size={18} aria-hidden/></Link></li>;})}</ol></section>)}
    {!entries.length&&<div className="activity-empty"><span className="empty-icon" aria-hidden><History size={28}/></span><h2>No activity yet</h2><p>Approvals, witness responses, and repayment updates will appear here.</p><Link className="button button-secondary" href={`${appBase(demo)}/agreements`}>View agreements<ArrowRight size={16} aria-hidden/></Link></div>}
  </div>;
}

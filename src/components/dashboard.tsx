'use client';
import Link from 'next/link';
import type {PendingBorrowerInvitation} from '@/modules/agreements/pending-invitations';
import {useState,useSyncExternalStore} from 'react';
import {ArrowLeft,History} from '@/components/icons';
import type {Actor,Aggregate} from '@/modules/agreements/types';
import {appBase} from './client-api';
import {Brief} from './brief';
import {AgreementsList} from './agreements-list';
import {activityFormatters,eventByline,eventText,statusLabels} from './agreement-utils';
import {Chips} from './kit';
import {activityAppearance} from './activity-look';
import {firstName} from './person-colour';

export function StatusBadge({status}:{status:string}){return <span className={`status-badge status-${status.toLowerCase()}`}><span aria-hidden className="status-dot"/>{statusLabels[status]??status}</span>;}
export function Dashboard({agreements,invitations=[],actor,demo,listing=false,accessRequests=[]}:{agreements:Aggregate[];invitations?:PendingBorrowerInvitation[];actor:Actor;demo:boolean;listing?:boolean;accessRequests?:{id:string;name:string;opensAt:string}[]}){
  if(!listing)return <Brief agreements={agreements} invitations={invitations} actor={actor} demo={demo} accessRequests={accessRequests}/>;
  return <AgreementsList agreements={agreements} invitations={invitations} actor={actor} demo={demo}/>;
}
const subscribeTimeZone=()=>()=>{};
const browserTimeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone=()=>null;
/** Your own events, in the first person. */
const youDid:Record<string,string>={AGREEMENT_CREATED:'You drafted an agreement',BORROWER_INVITED:'You sent the agreement to review',INVITATION_RESENT:'You sent a fresh link',INVITATION_CLAIMED:'You opened the invitation',VERSION_CREATED:'You sent a new version',BORROWER_REQUESTED_CHANGE:'You asked for a change',AGREEMENT_DECLINED:'You said no to the agreement',LENDER_APPROVED:'You signed the agreement',BORROWER_APPROVED:'You signed the agreement',WITNESS_INVITED:'You invited a witness',WITNESS_ATTESTED:'You witnessed the agreement',WITNESS_DECLINED:'You declined to witness',AGREEMENT_FINALIZED:'Your agreement became active',REPAYMENT_PROPOSED:'You recorded a payment',REPAYMENT_CONFIRMED:'You confirmed a payment',REPAYMENT_DISPUTED:'You asked about a payment',FORGIVENESS_PROPOSED:'You offered to forgive part of the balance',FORGIVENESS_CONFIRMED:'You acknowledged forgiveness',SETTLEMENT_ACKNOWLEDGED:'You confirmed it’s settled',AGREEMENT_SETTLED:'The agreement is settled',AGREEMENT_CANCELLED:'You cancelled the proposal'};
/** Other people's events that notifications never show. */
const theyDid:Record<string,string>={AGREEMENT_CREATED:'drafted an agreement',INVITATION_CLAIMED:'opened the invitation',WITNESS_INVITED:'invited a witness'};
type ActivityFilter='All'|'Payments'|'Signatures'|'Changes';
const paymentEvents=['REPAYMENT_PROPOSED','REPAYMENT_CONFIRMED','REPAYMENT_DISPUTED','FORGIVENESS_PROPOSED','FORGIVENESS_CONFIRMED','SETTLEMENT_ACKNOWLEDGED','AGREEMENT_SETTLED'];
const signatureEvents=['LENDER_APPROVED','BORROWER_APPROVED','WITNESS_ATTESTED','WITNESS_DECLINED','AGREEMENT_FINALIZED'];
const subscribeMinute=(update:()=>void)=>{const t=setInterval(update,60000);return ()=>clearInterval(t);};
const currentMinute=()=>Math.floor(Date.now()/60000);
export function Activity({agreements,demo,userId}:{agreements:Aggregate[];demo:boolean;userId?:string}){
  const timeZone=useSyncExternalStore(subscribeTimeZone,browserTimeZone,serverTimeZone);
  const formats=activityFormatters(timeZone??'UTC'),[filter,setFilter]=useState<ActivityFilter>('All');
  const entries=agreements.flatMap(a=>a.events.map(e=>{const actor=a.participants.find(p=>p.id===e.actorId),other=a.participants.find(p=>p.role!=='WITNESS'&&p.userId!==userId);return {...e,agreementId:a.id,publicId:a.publicId,actor,other,people:a.participants.filter(p=>p.role!=='WITNESS').map(p=>p.name).join(' & ')};}))
    .filter(e=>filter==='All'||(filter==='Payments'?paymentEvents.includes(e.type):filter==='Signatures'?signatureEvents.includes(e.type):!paymentEvents.includes(e.type)&&!signatureEvents.includes(e.type)))
    .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||(a.agreementId===b.agreementId?b.sequence-a.sequence:0));
  const groups=new Map<string,typeof entries>();
  for(const entry of entries){const key=formats.dateKey.format(new Date(entry.createdAt));const day=groups.get(key);if(day)day.push(entry);else groups.set(key,[entry]);}
  const minute=useSyncExternalStore(subscribeMinute,currentMinute,()=>0),todayKey=timeZone&&minute?formats.dateKey.format(new Date(minute*60000)):'';
  const dayLabel=(key:string,iso:string)=>{if(key===todayKey)return 'Today';const y=new Date(Date.parse(`${todayKey}T12:00:00Z`)-86400000).toISOString().slice(0,10);if(key===y)return 'Yesterday';return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:timeZone??'UTC'}).format(new Date(iso));};
  return <div className="notices activity-page">
    <header className="detail-bar notices-bar"><Link className="detail-icon-button" href={appBase(demo)||'/app'} aria-label="Back to overview"><ArrowLeft size={18} aria-hidden/></Link><h1 className="notices-title">Activity</h1><span/></header>
    <div className="activity-filters"><Chips label="Filter activity" value={filter} onChange={setFilter} options={(['All','Payments','Signatures','Changes'] as ActivityFilter[]).map(id=>({id,label:id}))}/></div>
    {timeZone&&Array.from(groups,([key,day])=><section className="activity-day notices-group" key={key} aria-labelledby={`activity-date-${key}`}>
      <div className="activity-day-heading"><h2 className="kit-overline agreements-group-title" id={`activity-date-${key}`} title={formats.day.format(new Date(day[0].createdAt))}>{dayLabel(key,day[0].createdAt)}</h2></div>
      <ol className="activity-events notices-list">{day.map(e=>{const {Icon,tone}=activityAppearance(e.type),mine=e.actor?.userId===userId;
        return <li key={e.id}><Link className="activity-event notice-row activity-row" href={`${appBase(demo)}/agreements/${e.agreementId}`}>
          <span className={`activity-tile tone-${tone}`} aria-hidden><Icon size={16}/></span>
          <span className="notice-copy"><span className="notice-text">{mine?(youDid[e.type]??eventText[e.type]??'Record updated'):!e.actor?(eventText[e.type]||'Record updated'):<><strong className="notice-by">{firstName(e.actor.name)}</strong> {eventByline[e.type]??theyDid[e.type]??(eventText[e.type]||'updated the record').toLowerCase()}</>}</span>
            <span className="notice-meta">{e.other&&e.other.id!==e.actor?.id?`With ${firstName(e.other.name)} · `:''}{e.publicId}</span></span>
          <time dateTime={e.createdAt} title={formats.full.format(new Date(e.createdAt))}>{formats.clock.format(new Date(e.createdAt))}</time>
        </Link></li>;})}</ol>
    </section>)}
    {timeZone&&!entries.length&&<section className="agreements-empty"><span className="agreements-empty-icon" aria-hidden><History size={26}/></span><h2>{filter==='All'?'No activity yet':'Nothing here yet'}</h2><p>Signatures, payments and changes will show up here, in your time.</p></section>}
    <p className="quiet-note debt-footnote activity-zone">{timeZone?`Times in your local time · ${timeZone.replaceAll('_',' ')}`:'Loading local time…'}</p>
  </div>;
}

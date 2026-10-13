'use client';
import Link from 'next/link';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {ArrowRight,ArrowUpRight,Bell} from 'lucide-react';
import type {Notice} from '@/modules/notifications/feed';
import {activityFormatters,eventText} from './agreement-utils';
import {apiBase,appBase} from './client-api';

// Read state is kept on this device: a notice is new until the Notifications page has been opened after it.
const seenKey=(userId:string)=>`treeti:notices-seen:${userId}`,changed='treeti:notices-seen';
const text:Record<string,string>={...eventText,INVITED_TO_REVIEW:'Invited you to review an agreement',BORROWER_INVITED:'An agreement is ready for you to review'};
function readSeen(userId:string){try{return localStorage.getItem(seenKey(userId));}catch{return null;}}
function writeSeen(userId:string,value:string){try{localStorage.setItem(seenKey(userId),value);}catch{}window.dispatchEvent(new Event(changed));}
function subscribe(onChange:()=>void){window.addEventListener(changed,onChange);window.addEventListener('storage',onChange);return ()=>{window.removeEventListener(changed,onChange);window.removeEventListener('storage',onChange);};}
const useSeen=(userId:string)=>useSyncExternalStore(subscribe,()=>readSeen(userId),()=>null);
const subscribeTimeZone=()=>()=>{},browserTimeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone,serverTimeZone=()=>null;

export function NotificationBell({userId,demo,rail=false}:{userId:string;demo:boolean;rail?:boolean}){
  const [latest,setLatest]=useState<string[]|null>(null),seen=useSeen(userId);
  useEffect(()=>{
    let cancelled=false;
    const load=()=>fetch(`${apiBase(demo)}/notifications`,{headers:{Accept:'application/json'},cache:'no-store'}).then(r=>r.ok?r.json():null).then((data:{notices:Notice[]}|null)=>{
      if(cancelled||!data)return;
      // The first visit on a device starts with a clean slate instead of marking old history as new.
      if(!readSeen(userId))writeSeen(userId,new Date().toISOString());
      setLatest(data.notices.map(n=>n.createdAt));
    }).catch(()=>{});
    void load();
    const refocus=()=>{if(document.visibilityState==='visible')void load();};
    document.addEventListener('visibilitychange',refocus);
    return ()=>{cancelled=true;document.removeEventListener('visibilitychange',refocus);};
  },[userId,demo]);
  const unread=latest&&seen?latest.filter(createdAt=>createdAt>seen).length:0,label=unread?`Notifications, ${unread} new`:'Notifications';
  const badge=unread>0&&<span className="notice-count" aria-hidden>{unread>9?'9+':unread}</span>;
  if(rail)return <Link className="nav-link notice-rail" href={`${appBase(demo)}/notifications`} aria-label={label}><Bell size={19}/>Notifications{badge}</Link>;
  return <Link className="button button-secondary icon-button notice-bell" href={`${appBase(demo)}/notifications`} aria-label={label}><Bell size={20} aria-hidden/>{badge}</Link>;
}

export function Notifications({notices,userId,demo}:{notices:Notice[];userId:string;demo:boolean}){
  const timeZone=useSyncExternalStore(subscribeTimeZone,browserTimeZone,serverTimeZone),formats=activityFormatters(timeZone??'UTC'),short=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:timeZone??'UTC'});
  // Remember what was new when the page opened, then mark everything as seen.
  const [seenAtOpen,setSeenAtOpen]=useState<string|null|undefined>(undefined);
  useEffect(()=>{const timer=setTimeout(()=>{setSeenAtOpen(readSeen(userId));writeSeen(userId,new Date().toISOString());},0);return ()=>clearTimeout(timer);},[userId]);
  const isNew=(n:Notice)=>seenAtOpen!==undefined&&seenAtOpen!==null&&n.createdAt>seenAtOpen;
  return <div className="activity-page notices-page"><div className="page-heading"><div><h1>Notifications</h1><p className="lede">What other people have done on your agreements. treeti only emails you a sign-in code; everything else arrives here.</p></div></div>
    {notices.length>0&&<ol className="activity-events">{notices.map(n=><li key={n.id}><Link className="activity-event" href={n.agreementId?`${appBase(demo)}/agreements/${n.agreementId}`:appBase(demo)||'/app'}><span className={`activity-event-icon ${isNew(n)?'tone-new':''}`} aria-hidden><Bell size={20}/></span><div className="activity-event-copy"><h3>{text[n.type]||'Record updated'}{isNew(n)&&<span className="notice-new">New</span>}</h3><p>{n.by||'treeti'}</p><small>{n.publicId}</small></div><time dateTime={n.createdAt} title={timeZone?formats.full.format(new Date(n.createdAt)):undefined}>{timeZone?`${short.format(new Date(n.createdAt))} · ${formats.clock.format(new Date(n.createdAt))}`:''}</time><ArrowUpRight className="activity-event-arrow" size={18} aria-hidden/></Link></li>)}</ol>}
    {!notices.length&&<div className="activity-empty"><span className="empty-icon" aria-hidden><Bell size={28}/></span><h2>Nothing new yet</h2><p>When someone approves, witnesses, or records a repayment on one of your agreements, you’ll see it here.</p><Link className="button button-secondary" href={`${appBase(demo)}/agreements`}>View agreements<ArrowRight size={16} aria-hidden/></Link></div>}
  </div>;
}

'use client';
import Link from 'next/link';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {ArrowLeft,Bell,BellRing,Settings} from '@/components/icons';
import {activityAppearance} from './activity-look';
import {firstName} from './person-colour';
import type {Notice} from '@/modules/notifications/feed';
import {activityFormatters,eventByline as byline,eventText} from './agreement-utils';
import {api,apiBase,appBase} from './client-api';
import {Button,ErrorMessage} from './ui';
import {InstallTreeti} from './pwa';

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
    // Moving between pages reuses the last answer for a minute instead of asking the server again.
    const cacheKey=`treeti:notices:${userId}`;
    const load=async()=>{
      let data:{notices:Notice[]}|null=null;
      try{const cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null') as {at:number;notices:Notice[]}|null;if(cached&&Date.now()-cached.at<60000)data=cached;}catch{}
      if(!data){
        data=await fetch(`${apiBase(demo)}/notifications`,{headers:{Accept:'application/json'},cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null);
        if(data)try{sessionStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),notices:data.notices}));}catch{}
      }
      if(cancelled||!data)return;
      // The first visit on a device starts with a clean slate instead of marking old history as new.
      if(!readSeen(userId))writeSeen(userId,new Date().toISOString());
      setLatest(data.notices.map(n=>n.createdAt));
    };
    void load();
    const refocus=()=>{if(document.visibilityState==='visible')void load();};
    document.addEventListener('visibilitychange',refocus);
    return ()=>{cancelled=true;document.removeEventListener('visibilitychange',refocus);};
  },[userId,demo]);
  const unread=latest&&seen?latest.filter(createdAt=>createdAt>seen).length:0,label=unread?`Notifications, ${unread} new`:'Notifications';
  const badge=unread>0&&<span className="notice-count" aria-hidden>{unread>9?'9+':unread}</span>;
  if(rail)return <Link className="nav-link notice-rail section-notifications" href={`${appBase(demo)}/notifications`} aria-label={label}><Bell size={19}/>Notifications{badge}</Link>;
  return <Link className="button button-secondary icon-button notice-bell" href={`${appBase(demo)}/notifications`} aria-label={label}><Bell size={20} aria-hidden/>{badge}</Link>;
}

// ── Notifications on this device (web push). The server only ever sends a short generic line.
type PushState='checking'|'hidden'|'install-first'|'blocked'|'off'|'on';
const keyBytes=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
const pushSupported=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
async function currentSubscription(){return pushSupported()?(await navigator.serviceWorker.ready).pushManager.getSubscription():null;}
/** Stops this device receiving notifications, for example before signing out. Never throws. */
export async function disablePushOnThisDevice(demo:boolean){
  try{const subscription=await currentSubscription();if(!subscription)return;await api(`${apiBase(demo)}/push/unsubscribe`,{endpoint:subscription.endpoint}).catch(()=>{});await subscription.unsubscribe();}catch{}
}
export function PushSettings({demo}:{demo:boolean}){
  const [state,setState]=useState<PushState>('checking'),[publicKey,setPublicKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const {publicKey}=await api<{publicKey:string|null}>(`${apiBase(demo)}/push`).catch(()=>({publicKey:null}));
      if(cancelled)return;
      if(!publicKey){setState('hidden');return;}
      setPublicKey(publicKey);
      if(!pushSupported()){
        // iPhone and iPad only allow notifications for an app added to the home screen.
        const standalone=window.matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;
        setState(/iPad|iPhone|iPod/.test(navigator.userAgent)&&!standalone?'install-first':'hidden');return;
      }
      if(Notification.permission==='denied'){setState('blocked');return;}
      const subscription=await currentSubscription().catch(()=>null);
      if(cancelled)return;
      if(subscription&&Notification.permission==='granted'){
        setState('on');
        // Keep the device attached to whoever is signed in now, at most once per browser session.
        try{if(!sessionStorage.getItem('treeti:push-synced')){await api(`${apiBase(demo)}/push/subscribe`,subscription.toJSON());sessionStorage.setItem('treeti:push-synced','1');}}catch{}
      }else setState('off');
    })();
    return ()=>{cancelled=true;};
  },[demo]);
  async function enable(){
    setBusy(true);setError('');
    try{
      if(await Notification.requestPermission()!=='granted'){setState(Notification.permission==='denied'?'blocked':'off');return;}
      const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription()??await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
      await api(`${apiBase(demo)}/push/subscribe`,subscription.toJSON());setState('on');
    }catch(e){setError((e as Error).message||'Notifications could not be turned on. Try again.');}finally{setBusy(false);}
  }
  async function disable(){setBusy(true);setError('');await disablePushOnThisDevice(demo);setState('off');setBusy(false);}
  if(state==='checking'||state==='hidden')return null;
  return <section className="push-card" aria-label="Notifications on this device"><span className="push-card-icon" aria-hidden><BellRing size={20}/></span><div className="push-card-copy">
    {state==='on'&&<><strong>Notifications are on for this device</strong><p>You’ll be told when someone responds on one of your agreements. The alert never shows names or amounts.</p></>}
    {state==='off'&&<><strong>Get notified on this device</strong><p>treeti can tell you when someone approves, witnesses or records a repayment, so you don’t have to keep checking. The alert never shows names or amounts.</p></>}
    {state==='blocked'&&<><strong>Notifications are blocked for treeti</strong><p>Your browser is set to block them. Allow notifications for treeti in your browser or phone settings, then return here.</p></>}
    {state==='install-first'&&<><strong>Add treeti to your home screen first</strong><p>On iPhone and iPad, notifications only work for an app on your home screen. Add treeti, open it from there, then turn notifications on.</p></>}
    <ErrorMessage message={error}/></div>
    <div className="push-card-action">{state==='off'&&<Button busy={busy} onClick={()=>void enable()}>Turn on notifications</Button>}{state==='on'&&<Button variant="secondary" busy={busy} onClick={()=>void disable()}>Turn off</Button>}{state==='install-first'&&<InstallTreeti/>}</div></section>;
}

export function Notifications({notices,userId,demo}:{notices:Notice[];userId:string;demo:boolean}){
  const timeZone=useSyncExternalStore(subscribeTimeZone,browserTimeZone,serverTimeZone),formats=activityFormatters(timeZone??'UTC');
  // Remember what was new when the page opened, then mark everything as seen.
  const [seenAtOpen,setSeenAtOpen]=useState<string|null|undefined>(undefined);
  useEffect(()=>{const timer=setTimeout(()=>{setSeenAtOpen(readSeen(userId));writeSeen(userId,new Date().toISOString());},0);return ()=>clearTimeout(timer);},[userId]);
  const isNew=(n:Notice)=>seenAtOpen!==undefined&&seenAtOpen!==null&&n.createdAt>seenAtOpen;
  // Minutes since epoch on the client, 0 on the server, so relative times never mismatch during hydration.
  const minute=useSyncExternalStore(subscribeMinute,currentMinute,()=>0),now=minute*60000;
  const dayKey=(iso:string)=>formats.dateKey.format(new Date(iso)),todayKey=minute?formats.dateKey.format(new Date(now)):'',yesterdayKey=minute?formats.dateKey.format(new Date(now-86400000)):'';
  const groups=new Map<string,Notice[]>();for(const n of notices){const k=dayKey(n.createdAt);const g=groups.get(k);if(g)g.push(n);else groups.set(k,[n]);}
  const dayLabel=(key:string,iso:string)=>key===todayKey?'Today':key===yesterdayKey?'Yesterday':new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:timeZone??'UTC'}).format(new Date(iso));
  return <div className="notices activity-page">
    <header className="detail-bar notices-bar"><Link className="detail-icon-button" href={appBase(demo)||'/app'} aria-label="Back to overview"><ArrowLeft size={18} aria-hidden/></Link><h1 className="notices-title">Notifications</h1><Link className="detail-icon-button" href={`${appBase(demo)}/account`} aria-label="Notification settings"><Settings size={18} aria-hidden/></Link></header>
    {notices.length>0?(timeZone?Array.from(groups,([key,list])=><section key={key} className="activity-day notices-group" aria-labelledby={`notices-${key}`}>
      <div className="activity-day-heading"><h2 className="kit-overline agreements-group-title" id={`notices-${key}`} title={formats.day.format(new Date(list[0].createdAt))}>{dayLabel(key,list[0].createdAt)}</h2></div>
      <ol className="activity-events notices-list">{list.map(n=>{const {Icon,tone}=activityAppearance(n.type);return <li key={n.id}><Link className="activity-event notice-row activity-row" href={n.agreementId?`${appBase(demo)}/agreements/${n.agreementId}`:appBase(demo)||'/app'}>
        <span className={`activity-tile tone-${tone}`} aria-hidden><Icon size={16}/></span>
        <span className="notice-copy"><span className="notice-text"><strong className="notice-by">{firstName(n.by||'treeti')}</strong> {byline[n.type]??sentence(text[n.type]||n.text||'Record updated')}</span>
          {n.publicId&&<span className="notice-meta">{n.publicId}</span>}</span>
        <span className="notice-end"><time dateTime={n.createdAt} title={formats.full.format(new Date(n.createdAt))}>{formats.clock.format(new Date(n.createdAt))}</time>{isNew(n)&&<span className="notice-new"><span className="sr-only">New</span></span>}</span>
      </Link></li>;})}</ol>
    </section>):null)
    :<section className="agreements-empty notices-empty"><span className="agreements-empty-icon" aria-hidden><Bell size={26}/></span><h2>You’re all caught up</h2><p>Requests, payments and signatures will show up here.</p></section>}
    <p className="quiet-note debt-footnote">treeti only emails you a sign-in code. Everything else arrives here.</p>
  </div>;
}
const subscribeMinute=(update:()=>void)=>{const t=setInterval(update,60000);return ()=>clearInterval(t);};
const currentMinute=()=>Math.floor(Date.now()/60000);
/** Turns "Borrower approved the terms" into "approved the terms", so it reads after the person's name. */
function sentence(t:string){const rest=t.replace(/^(The )?(Borrower|Lender|Witness|A witness|Someone)\s+/i,'');return rest===t?t.charAt(0).toLowerCase()+t.slice(1):rest;}

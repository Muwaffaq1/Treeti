'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, FileText, Home, LockKeyhole, LogOut, ArrowUpRight, ArrowLeft, ChevronRight, Clock3, WalletCards, Layers3, ShieldCheck, Plus, Search, Sprout } from '@/components/icons';
import { Panel } from './kit';
import { maskContact } from '@/lib/contact';
import type { Actor } from '@/modules/agreements/types';
import { demoPeople } from '@/modules/agreements/demo-people';
import { api,appBase } from './client-api';
import { Button,ErrorMessage } from './ui';
import {InstallTreeti,InstallNudge} from './pwa';
import {FeedbackNudge} from './feedback';
import {NotificationBell,PushSettings,disablePushOnThisDevice} from './notifications';
import {AppearanceSettings} from './appearance';
import {ProfileSwitcher} from './profile-switcher';
import {UtilityMenu} from './utility-menu';
export function Brand(){return <span className="wordmark">treeti<span>.</span></span>;}
export function Shell({actor,demo,people=demoPeople,children}:{actor:Actor;demo:boolean;people?:Actor[];children:React.ReactNode}){
  const pathname=usePathname(),base=appBase(demo),home=demo?'/demo':'/app';
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const links:{href:string;label:string;short?:string;Icon:typeof Home;section:string}[]=[{href:home,label:'Overview',Icon:Home,section:'overview'},{href:`${base}/agreements`,label:'Agreements',Icon:FileText,section:'agreements'},{href:`${base}/debts`,label:'My debts',Icon:WalletCards,section:'debts'},{href:`${base}/investments`,label:'Investments',Icon:Layers3,section:'investments'}];
  async function switchPerson(userId:string){setBusy(true);try{await api('/api/demo/session',{userId});window.location.reload();}catch(e){setError((e as Error).message);setBusy(false);}}
  const selected=(href:string,section:string)=>pathname===href||(section==='agreements'&&pathname.startsWith(`${base}/agreements/`)&&pathname!==`${base}/agreements/new`);
  return <div className="app-shell"><a href="#main" className="skip-link">Skip to content</a>
    <aside className="sidebar"><Link className="brand-link" href={home} aria-label="treeti overview"><Brand/></Link>
      <NewChooser base={base} className="button-primary sidebar-new" iconSize={18}/>
      <nav aria-label="Main navigation">{links.map(({href,label,short,Icon,section})=><Link key={href} href={href} className={`nav-link section-${section} ${selected(href,section)?'selected':''}`} aria-current={selected(href,section)?'page':undefined}><Icon size={20}/>{short??label}</Link>)}</nav>
      <div className="sidebar-divider" role="separator"/>
      <div className="sidebar-bottom"><NotificationBell userId={actor.userId} demo={demo} rail/><Link className={`nav-link ${pathname===`${base}/activity`?'selected':''}`} href={`${base}/activity`}><Clock3 size={20}/>Activity</Link><Link className={`nav-link section-trusted ${pathname.startsWith(`${base}/trusted-contacts`)?'selected':''}`} href={`${base}/trusted-contacts`}><ShieldCheck size={20}/>Trusted contacts</Link></div>
      <div className="sidebar-account"><UtilityMenu actor={actor} base={base} demo={demo} rail/></div>
    </aside>
    <div className="workspace">{demo&&<div className="demo-bar"><span><span className="demo-dot"/>Demonstration<span className="demo-detail">· sample records, simulated verification</span></span><ProfileSwitcher actor={actor} people={people} disabled={busy} onChange={switchPerson}/></div>}
      <header className="top-bar"><p className="top-bar-title">{pageTitle(pathname,base,home)}</p><TopSearch base={base}/></header>
      <header className="mobile-header"><Link href={home} aria-label="treeti overview"><Brand/></Link><div className="mobile-header-actions"><NewChooser base={base} className="mobile-new" iconSize={16}/><NotificationBell userId={actor.userId} demo={demo}/><UtilityMenu actor={actor} base={base} demo={demo}/></div></header>
      <ErrorMessage message={error}/><main id="main" className="main-content">{children}</main></div>
    <InstallNudge/><FeedbackNudge demo={demo}/><MobileNav links={links} pathname={pathname}/></div>;
}
/** Phone tab bar. Tapping anywhere on a tab plays that tab's icon motion once, then it settles back. */
function MobileNav({links,pathname}:{links:{href:string;label:string;short?:string;Icon:typeof Home;section:string}[];pathname:string}){
  const [tapped,setTapped]=useState<string|null>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  function play(section:string){
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    clearTimeout(timer.current);setTapped(section);timer.current=setTimeout(()=>setTapped(null),650);
  }
  return <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(({href,label,short,Icon,section})=><Link href={href} key={href} className={`section-${section}`} aria-current={pathname===href?'page':undefined} onPointerDown={()=>play(section)} onKeyDown={e=>{if(e.key==='Enter')play(section);}}><Icon size={20} trigger="none" hover={tapped===section}/><span>{short??label}</span></Link>)}</nav>;
}
/** "New" asks what you're writing down (Figma: New · What are you writing down? 138:5652). */
function NewChooser({base,className,iconSize}:{base:string;className:string;iconSize:number}){
  const [open,setOpen]=useState(false);
  const options=[{href:`${base}/agreements/new`,title:'An agreement',detail:'Lending to someone. You both sign.',Icon:FileText},{href:`${base}/debts?new=1`,title:'A debt',detail:'Money you owe. Only you see it.',Icon:WalletCards},{href:`${base}/investments?new=1`,title:'An investment',detail:'Money you’ve put in. Only you see it.',Icon:Sprout}];
  return <><button type="button" className={className} aria-haspopup="dialog" onClick={()=>setOpen(true)}><Plus size={iconSize} aria-hidden/>New</button>
    <Panel open={open} onOpenChange={setOpen} title="What are you writing down?" description="Pick one. You can always add more later.">
      <ul className="new-options">{options.map(({href,title,detail,Icon})=><li key={href}><Link className="new-option" href={href} onClick={()=>setOpen(false)}><span className="new-option-icon" aria-hidden><Icon size={18}/></span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={18} aria-hidden/></Link></li>)}</ul>
    </Panel></>;
}
/** The desktop page name shown in the top bar. The page keeps its own h1, so this is plain text. */
function pageTitle(pathname:string,base:string,home:string){
  if(pathname===home)return 'Overview';
  const rest=pathname.slice(base.length+1),[first,second]=rest.split('/');
  if(first==='agreements')return second==='new'?'New agreement':second?'Agreement':'Agreements';
  return ({debts:'My debts',investments:'Investments',notifications:'Notifications',activity:'Activity','trusted-contacts':'Trusted contacts',account:'Account',guide:'How treeti works',feedback:'Send feedback'} as Record<string,string>)[first]??'';
}
/** Desktop search. Looks through agreements; ⌘K or Ctrl+K moves focus here from anywhere. */
function TopSearch({base}:{base:string}){
  const router=useRouter(),input=useRef<HTMLInputElement>(null),[value,setValue]=useState('');
  const [mac,setMac]=useState(true);
  useEffect(()=>{
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
    const onKey=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.current?.focus();}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[]);
  return <form className="top-search" role="search" onSubmit={e=>{e.preventDefault();router.push(`${base}/agreements${value.trim()?`?q=${encodeURIComponent(value.trim())}`:''}`);}}>
    <Search size={18} aria-hidden/><label className="sr-only" htmlFor="top-search">Search people or records</label>
    <input id="top-search" ref={input} type="search" placeholder="Search people or records" value={value} onChange={e=>setValue(e.target.value)} autoComplete="off"/>
    <kbd aria-hidden>{mac?'⌘K':'Ctrl K'}</kbd>
  </form>;
}
export function DemoStart(){const router=useRouter();const [busy,setBusy]=useState(false),[error,setError]=useState('');return <div className="auth-panel"><Brand/><h1>A little clarity goes a long way.</h1><p>Explore treeti with sample agreements. You can switch between lender, borrower and witness to follow the whole journey.</p><Button busy={busy} onClick={async()=>{setBusy(true);try{await api('/api/demo/session',{fresh:true});router.push('/demo');router.refresh();}catch(e){setError((e as Error).message);setBusy(false);}}}>Open demonstration <ArrowUpRight size={18}/></Button><ErrorMessage message={error}/><small>No real identity checks, messages or payments take place.</small><Link href="/">Return to treeti</Link></div>;}
export function Account({actor,demo}:{actor:Actor;demo:boolean}){
  const router=useRouter(),base=appBase(demo),[error,setError]=useState('');
  async function leave(){try{if(demo){await api('/api/demo/session',{fresh:true});router.push('/demo');router.refresh();}else{await disablePushOnThisDevice(false);await api('/api/auth/sign-out',{});router.push('/');router.refresh();}}catch(e){setError((e as Error).message);}}
  const contact=actor.contacts[0];
  return <div className="account">
    <header className="detail-bar notices-bar"><Link className="detail-icon-button" href={demo?'/demo':'/app'} aria-label="Back to overview"><ArrowLeft size={18} aria-hidden/></Link><h1 className="notices-title">Account</h1><span/></header>
    <section className="account-who"><span className="account-avatar" aria-hidden>{actor.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><h2>{actor.name}</h2><p>{contact?`${maskContact(contact)} · ${demo?'simulated':'verified'}`:demo?'Demonstration profile':'Verified contact'}</p></section>
    <div className="account-card">
      <PushSettings demo={demo}/>
      <AppearanceSettings compact/>
      <Link className="account-row" href={`${base}/trusted-contacts`}><span><strong>Trusted contacts</strong><small>People who can see your debts if you can’t reach them</small></span><ChevronRight size={18} aria-hidden/></Link>
      <Link className="account-row" href={`${base}/activity`}><span><strong>Activity</strong><small>Everything that happened, in your time</small></span><ChevronRight size={18} aria-hidden/></Link>
    </div>
    <div className="account-card">
      <Link className="account-row" href={`${base}/guide`}><span><strong>How treeti works</strong></span><ChevronRight size={18} aria-hidden/></Link>
      <Link className="account-row" href={`${base}/feedback`}><span><strong>Send feedback</strong></span><ChevronRight size={18} aria-hidden/></Link>
      <div className="account-row account-install"><span><strong>Install treeti</strong><small>Add it to your home screen</small></span><InstallTreeti compact/></div>
    </div>
    {demo&&<p className="quiet-note account-note"><LockKeyhole size={14} aria-hidden/>This identity is simulated for the demonstration.</p>}
    <ErrorMessage message={error}/>
    <button type="button" className="button sign-danger account-leave" onClick={()=>void leave()}><LogOut size={17} aria-hidden/>{demo?'Start a fresh demonstration':'Sign out'}</button>
    <nav className="legal-links account-legal" aria-label="Policies and support"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link></nav>
  </div>;
}
export function Guide(){return <><h1>How treeti works</h1><p className="lede">Agree on interest-free loans together, keep track of what you owe, and record where you’ve invested.</p><div className="guide-grid">{[
  ['01','Sign in with your email','Enter your email and the sign-in code sent to you. No password is needed. If your code expires, request a new one from the same screen.'],
  ['02','Agree on the details','Choose an amount and currency, name the borrower, and set a single repayment or weekly, monthly, or custom instalments. Agree and send shares your terms with the borrower.'],
  ['03','Review and accept','The borrower opens the private link you share with them; if they already use treeti, the invitation also appears under Needs your attention. They can accept, request changes, or decline. Signed-in participants can approve without requesting another code. Both parties must agree to the same version; earlier versions remain available.'],
  ['04','Invite witnesses if needed','Witnesses open their invitation, verify their email, enter their name, and confirm they’ve read the terms and agree to witness. They don’t need to create an account or be physically present, and they don’t guarantee repayment. The agreement finalizes once all required confirmations are complete.'],
  ['05','Record repayments together','Money is exchanged outside treeti. Either party can record a repayment; the other confirms it before the balance changes. Each agreement keeps its own currency. Both parties acknowledge settlement when the balance reaches zero. Download the final agreement PDF and confirmed payment receipts from the agreement.'],
  ['06','Track private debts','Use My debts for money you owe outside treeti. Add an amount, currency, date, and optional repayment plan. Record repayments and correct mistakes in your entries. These records are private to you; the person you name isn’t invited.'],
  ['07','Keep an investment record','Use My investments to record where you’ve invested, in any supported currency. Add dated contributions, edit your entries, and archive records you no longer need. Only you can see them. Totals show the money you recorded investing, without estimating profits, losses, or current value.'],
  ['08','Find your records','Overview separates money owed to you from money you owe, keeping currencies separate. Find cancelled proposals in the Cancelled tab. Open Activity from the menu to see agreement updates in your local time.']
].map(([n,title,body])=><section className="panel" key={n}><span className="step-number">{n}</span><h2>{title}</h2><p>{body}</p></section>)}</div><div className="callout"><BookOpen size={22} aria-hidden/><p>Inspired by the care for clarity in Surah Al-Baqarah 2:282. treeti keeps a shared record of your agreement; it does not lend money, process payments, or guarantee repayment.</p></div></>;}

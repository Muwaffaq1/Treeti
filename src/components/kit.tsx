'use client';
// treeti UI kit: the shared pieces from the Figma design system (v3 · Atoms/Molecules/Organisms).
// Every screen of the revamp is built from these, so a change here updates phone and desktop together.
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import {useEffect,type ReactNode} from 'react';
import {money} from '@/lib/money';
import {initials} from './person-colour';
import {ChevronRight,X} from './icons';

/*
  On-screen keyboard. iOS Safari shrinks only the visual viewport when the keyboard opens, so anything
  position:fixed stays put and ends up under the keyboard, and 100dvh ignores it (no keyboard-inset env vars
  in Safari). While a panel or full-screen layer is open we publish where the keyboard is as CSS variables:
  --kb-inset (keyboard height over the layout viewport), --vv-height and --vv-top (the visible area).
  Android uses interactiveWidget:'resizes-content' (app/layout.tsx), so its inset stays 0 here.
*/
let keyboardUsers=0,stopKeyboard:(()=>void)|null=null;
function startKeyboardTracking(){
  const vv=window.visualViewport;if(!vv)return ()=>{};
  const root=document.documentElement.style;
  // visualViewport fires at most once a frame while the keyboard moves, so update straight away.
  const update=()=>{
    const open=vv.height<window.innerHeight-1;
    // iOS 26 can leave offsetTop non-zero after the keyboard closes, so only trust it while the keyboard is up.
    const top=open?vv.offsetTop:0,inset=Math.max(0,Math.round(window.innerHeight-(top+vv.height)));
    root.setProperty('--kb-inset',`${inset}px`);root.setProperty('--vv-height',`${Math.round(vv.height)}px`);root.setProperty('--vv-top',`${Math.round(top)}px`);
    // Keep the field being typed in visible inside its scrolling panel once the space shrinks.
    const field=document.activeElement;
    if(open&&field instanceof HTMLElement&&field.matches('input,textarea,select,[contenteditable]'))field.scrollIntoView({block:'nearest'});
  };
  vv.addEventListener('resize',update);vv.addEventListener('scroll',update);update();
  return ()=>{vv.removeEventListener('resize',update);vv.removeEventListener('scroll',update);for(const name of ['--kb-inset','--vv-height','--vv-top'])root.removeProperty(name);};
}
/** Track the on-screen keyboard while `active`. Shared: listeners stay on until the last open layer closes. */
export function useKeyboardInset(active:boolean){
  useEffect(()=>{
    if(!active)return;
    if(keyboardUsers++===0)stopKeyboard=startKeyboardTracking();
    return ()=>{if(--keyboardUsers===0){stopKeyboard?.();stopKeyboard=null;}};
  },[active]);
}

/** Character count for the fit-to-width totals: font-size = container width ÷ characters (see .ledger-amount). */
export const fitChars=(text:string)=>({'--chars':Array.from(text).length} as React.CSSProperties);
/** An amount too long to sit beside a name in a list row; the row then puts it underneath. */
export const longAmount=(text:string)=>Array.from(text).length>10;

/** Initials in a dark-purple circle with a purple ring (Figma: Avatar). Decorative: the name is always shown beside it. */
export function Avatar({name,size=32}:{name:string;size?:24|28|32|36|40|48|56|64}){
  return <span className="kit-avatar" style={{'--size':`${size}px`} as React.CSSProperties} aria-hidden>{initials(name)}</span>;
}

/** Avatar wrapped in a ring that fills with money repaid (Zip-style progress). The ring is decorative; the row says the progress in words. */
export function RingAvatar({name,fraction,size=40}:{name:string;fraction:number;size?:number}){
  const r=(size-3)/2,c=2*Math.PI*r,f=Math.max(0,Math.min(1,fraction)),inner=size-10;
  return <span className="kit-ring" style={{'--size':`${size}px`} as React.CSSProperties} aria-hidden>
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}><circle className="kit-ring-track" cx={size/2} cy={size/2} r={r}/>{f>0&&<circle className="kit-ring-fill" cx={size/2} cy={size/2} r={r} strokeDasharray={`${Math.max(f*c,2)} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`}/>}</svg>
    <span className="kit-avatar" style={{'--size':`${inner}px`} as React.CSSProperties}>{initials(name)}</span>
  </span>;
}

/** Amount with a smaller, lighter currency sign, so the figure leads (₦ at full weight reads like a strikethrough). */
export function Amount({text,currency}:{text:string;currency:string}){
  const sign=currency==='NGN'?'₦':`${currency} `;
  return text.startsWith(sign)?<><span className="kit-sign">{sign.trim()}</span>{currency==='NGN'?'':'\u00a0'}{text.slice(sign.length)}</>:<>{text}</>;
}

/** Owed to you / You owe as one quiet panel with two halves (Wise/Starling-style). Each half opens the breakdown. */
export function TotalsPanel({owed,owe,onOpen}:{owed:{parts:[string,string][];people:number};owe:{parts:[string,string][];people:number};onOpen:(side:'owed'|'owe')=>void}){
  const half=(side:'owed'|'owe',label:string,v:{parts:[string,string][];people:number},none:string)=>{const empty=!v.parts.length,multi=v.parts.length>1;
    return <button type="button" className={`kit-totals-half${empty?' empty':''}`} aria-haspopup="dialog" onClick={()=>onOpen(side)}>
      <span className="kit-totals-label">{label}</span>
      <span className={`kit-totals-amount${multi?' multi':''}`}>{empty?<Amount text={money('0','NGN')} currency="NGN"/>:v.parts.map(([c,m],i)=><span key={c}>{i>0&&' '}<span><Amount text={money(m,c)} currency={c}/>{i<v.parts.length-1&&' +'}</span></span>)}</span>
      <span className="kit-totals-sub">{empty?none:<>{v.people===1?'1 person':`${v.people} people`}<ChevronRight size={12} aria-hidden/></>}</span>
    </button>;};
  return <div className="kit-totals" role="group" aria-label="Your totals">{half('owed','Owed to you',owed,'Nothing owed')}{half('owe','You owe',owe,'All clear')}</div>;
}

/** Small rounded label. action = lilac "Your turn", positive = green, neutral = soft grey. */
export function Tag({tone='action',children}:{tone?:'action'|'positive'|'neutral';children:ReactNode}){
  return <span className={`kit-tag kit-tag-${tone}`}>{children}</span>;
}

/** Section heading in small capitals (Figma: Overline). Written in sentence case; CSS uppercases it. */
export function Overline({children,id,as:As='h2'}:{children:ReactNode;id?:string;as?:'h2'|'h3'|'p'}){
  return <As className="kit-overline" id={id}>{children}</As>;
}

/** Amount with a lighter currency sign and tabular figures (Figma: Money). */
export function Money({minor,currency,size='md'}:{minor:string;currency:string;size?:'md'|'lg'}){
  const sign=currency==='NGN'?'₦':`${currency} `,text=money(minor,currency).slice(sign.length);
  return <span className={`kit-money kit-money-${size}`}><span className="kit-money-sign">{sign}</span>{text}</span>;
}

/** One continuous bar filled by money repaid, with the count in words (works for 2 or 60 parts). */
export function ProgressCount({fraction,count,next,quiet}:{fraction:number;count:string;next?:ReactNode;quiet?:boolean}){
  const pct=Math.max(0,Math.min(1,fraction))*100;
  return <div className="kit-progress">
    <div className="kit-bar" aria-hidden><span style={{width:`${pct}%`}}/></div>
    <p className="kit-progress-meta"><span className={quiet?'kit-count-quiet':'kit-count'}>{count}</span>{next&&<span>{next}</span>}</p>
  </div>;
}

/** Filter chips: one selected at a time (Figma: Filter chip). */
export function Chips<T extends string>({options,value,onChange,label}:{options:{id:T;label:string}[];value:T;onChange:(id:T)=>void;label:string}){
  return <div className="kit-chips" role="group" aria-label={label}>
    {options.map(o=><button key={o.id} type="button" className="kit-chip" aria-pressed={value===o.id} onClick={()=>onChange(o.id)}>{o.label}</button>)}
  </div>;
}

/** Two halves that each show a total; the selected half is raised (Figma: Value switch). */
export function ValueSwitch<T extends string>({options,value,onChange,label}:{options:{id:T;label:string;amount:ReactNode}[];value:T;onChange:(id:T)=>void;label:string}){
  return <div className="kit-switch" role="group" aria-label={label}>
    {options.map(o=><button key={o.id} type="button" className="kit-switch-half" aria-pressed={value===o.id} onClick={()=>onChange(o.id)}>
      <span className="kit-switch-label">{o.label}</span><span className="kit-switch-amount">{o.amount}</span>
    </button>)}
  </div>;
}

/** A person row used by agreements, debts, breakdowns and shared records (Figma: Agreement row / Breakdown row). */
export function PersonRow({name,title,detail,amount,caption,href,onClick,tile}:{name:string;title?:string;detail?:ReactNode;amount?:ReactNode;caption?:string;href?:string;onClick?:()=>void;tile?:ReactNode}){
  const body=<>
    {tile??<Avatar name={name} size={32}/>}
    <span className="kit-row-main"><span className="kit-row-title">{title??name}</span>{detail&&<span className="kit-row-detail">{detail}</span>}</span>
    {(amount||caption)&&<span className="kit-row-end">{amount&&<span className="kit-row-amount">{amount}</span>}{caption&&<span className="kit-row-caption">{caption}</span>}</span>}
  </>;
  if(href)return <Link className="kit-row kit-row-action" href={href}>{body}</Link>;
  if(onClick)return <button type="button" className="kit-row kit-row-action" onClick={onClick}>{body}</button>;
  return <div className="kit-row">{body}</div>;
}

/** A tappable blank in a fill-in sentence (Figma: Blank). */
export function Blank({state,children,onClick,label}:{state:'empty'|'current'|'filled';children:ReactNode;onClick?:()=>void;label?:string}){
  return <button type="button" className={`kit-blank kit-blank-${state}`} onClick={onClick} aria-label={label}>{children}</button>;
}

/** Soft card with a small heading and optional link (Figma: detail cards). */
export function Card({title,link,children}:{title?:string;link?:{label:string;href:string};children:ReactNode}){
  return <section className="kit-card">{(title||link)&&<div className="kit-card-head">{title&&<Overline as="h3">{title}</Overline>}{link&&<Link className="kit-link" href={link.href}>{link.label}</Link>}</div>}{children}</section>;
}

/**
 * Panel (Figma: request panel / breakdown panel). On phones it slides up from the bottom, 8px from the sides.
 * On wide screens a "sheet" becomes a centred dialog and a "drawer" becomes a 480px side panel.
 */
export function Panel({open,onOpenChange,title,description,variant='sheet',hideTitle,children}:{open:boolean;onOpenChange:(open:boolean)=>void;title:string;description?:string;variant?:'sheet'|'drawer';hideTitle?:boolean;children:ReactNode}){
  useKeyboardInset(open);
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="kit-scrim"/>
      <Dialog.Content className={`kit-panel kit-panel-${variant}`} {...(description?{}:{'aria-describedby':undefined})} onOpenAutoFocus={e=>{const field=(e.currentTarget as HTMLElement).querySelector<HTMLElement>('input:not([type=radio]):not([type=checkbox]),textarea');if(field){e.preventDefault();field.focus();}}}>
        <Dialog.Close className="kit-grabber" aria-label="Close"><span aria-hidden/></Dialog.Close>
        <Dialog.Close className="kit-panel-close" aria-label="Close"><X size={18} aria-hidden/></Dialog.Close>
        <Dialog.Title className={hideTitle?'sr-only':'kit-panel-title'}>{title}</Dialog.Title>
        {description&&<Dialog.Description className="kit-panel-description">{description}</Dialog.Description>}
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

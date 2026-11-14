'use client';
// Moments (Figma: v3 · Screens · Moments · storyboards 184:11100). Rare celebrations only: everyone signed, settled,
// forgiveness. Each is under ~2.5 s, a tap skips to the end, transform and opacity only, at most 14 particles,
// and reduced motion turns each one into a plain fade of the final state.
import * as Dialog from '@radix-ui/react-dialog';
import {useEffect,useRef,useState,type CSSProperties,type ReactNode} from 'react';
import {money} from '@/lib/money';
import {Avatar,Amount} from './kit';
import {Check} from './icons';
import {firstName} from './person-colour';

/** The easing-hardship line waits for scholar approval before it can be shown (see memory: religious wording). */
export const EASING_LINE_APPROVED=false;
const EASING_LINE='Whoever eases someone’s hardship, ease will find them too.';

export type Moment=
  |{kind:'agreed';publicId:string;people:{name:string;role:'Lender'|'Borrower'|'Witness'}[]}
  |{kind:'settled';principalMinor:string;currency:string;parts:number;lender:string;borrower:string;other:string;thanksTo:string}
  |{kind:'eased';amountMinor:string;currency:string;person:string};

const seenKey=(kind:string,id:string)=>`treeti:moment:${kind}:${id}`;
/** True the first time this moment is asked for on this device, so each one plays once. */
export function firstTime(kind:string,id:string){try{if(localStorage.getItem(seenKey(kind,id)))return false;localStorage.setItem(seenKey(kind,id),'1');return true;}catch{return false;}}

function haptic(pattern:number[]){try{navigator.vibrate?.(pattern);}catch{}}

export function MomentOverlay({moment,onClose,actions}:{moment:Moment|null;onClose:()=>void;actions?:ReactNode}){
  const [skipped,setSkipped]=useState(false);
  useEffect(()=>{setSkipped(false);if(moment)haptic([12,40,18]);},[moment]);
  if(!moment)return null;
  const title=moment.kind==='agreed'?'Agreed, together':moment.kind==='settled'?'Settled, and remembered':`You eased ${firstName(moment.person)}’s burden`;
  return <Dialog.Root open onOpenChange={o=>{if(!o)onClose();}}>
    <Dialog.Portal>
      <Dialog.Content className={`moment moment-${moment.kind}${skipped?' moment-skip':''}`} aria-describedby={undefined} onPointerDown={()=>setSkipped(true)}>
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {moment.kind==='agreed'&&<Agreed moment={moment}/>}
        {moment.kind==='settled'&&<Settled moment={moment} skipped={skipped}/>}
        {moment.kind==='eased'&&<Eased moment={moment}/>}
        <div className="moment-actions">{actions}<Dialog.Close className="button button-primary sign-primary moment-done">{moment.kind==='agreed'?'See the agreement':moment.kind==='settled'?'Keep the record':'Done'}</Dialog.Close></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

const d=(ms:number)=>({'--d':`${ms}ms`}) as CSSProperties;

function Agreed({moment}:{moment:Extract<Moment,{kind:'agreed'}>}){
  const lender=moment.people.find(p=>p.role==='Lender'),borrower=moment.people.find(p=>p.role==='Borrower'),witnesses=moment.people.filter(p=>p.role==='Witness');
  return <div className="moment-body">
    <div className="moment-stage" aria-hidden>
      <span className="moment-halo" style={d(820)}/>
      <div className="moment-pair">{lender&&<span className="moment-from-left" style={d(0)}><Avatar name={lender.name} size={56}/></span>}{borrower&&<span className="moment-from-right" style={d(0)}><Avatar name={borrower.name} size={56}/></span>}</div>
      {witnesses.length>0&&<div className="moment-witnesses">{witnesses.map((w,i)=><span key={w.name} className="moment-rise" style={d(180+i*60)}><Avatar name={w.name} size={36}/></span>)}</div>}
    </div>
    <div className="moment-words moment-fade" style={d(820)}><h2>Agreed, together</h2><p>Everyone has signed {moment.publicId}.</p></div>
    <ul className="moment-list">{moment.people.map((p,i)=><li key={p.name} className="moment-fade" style={d(1050+i*70)}><span className="moment-tick" aria-hidden><Check size={12}/></span><strong>{firstName(p.name)}</strong> signed<small>{p.role}</small></li>)}</ul>
  </div>;
}

function Settled({moment,skipped}:{moment:Extract<Moment,{kind:'settled'}>;skipped:boolean}){
  const amount=useCountDown(moment.principalMinor,skipped);
  const leaves=Array.from({length:14},(_,i)=>({left:`${(i*37)%96+2}%`,delay:650+i*55,drift:(i%2?1:-1)*(12+(i*7)%18)}));
  return <div className="moment-body">
    <div className="moment-leaves" aria-hidden>{leaves.map((l,i)=><span key={i} className="moment-leaf" style={{left:l.left,'--d':`${l.delay}ms`,'--drift':`${l.drift}px`} as CSSProperties}><Leaf/></span>)}</div>
    <p className="moment-caption">{firstName(moment.borrower)} owes {firstName(moment.lender)}</p>
    <p className="moment-amount moment-pop"><Amount text={money(amount,moment.currency)} currency={moment.currency}/></p>
    <div className="moment-bar" aria-hidden><span/></div>
    <p className="moment-count">{moment.parts>1?`${moment.parts} of ${moment.parts} paid`:'Paid back in full'}</p>
    <article className="moment-keepsake moment-rise" style={d(760)}>
      <span className="moment-stamp">Repaid in full</span>
      <h2>Settled, and remembered</h2>
      <p>{money(moment.principalMinor,moment.currency)} · lent by {firstName(moment.lender)} to {firstName(moment.borrower)}</p>
      <div className="moment-signatures"><span>{moment.lender}</span><span>{moment.borrower}</span></div>
    </article>
  </div>;
}
/** Counts the remaining balance down to zero over 600 ms (text only), or jumps to zero when skipped or reduced. */
function useCountDown(fromMinor:string,skipped:boolean){
  const [value,setValue]=useState(fromMinor),frame=useRef(0);
  useEffect(()=>{
    if(skipped||window.matchMedia('(prefers-reduced-motion: reduce)').matches){setValue('0');return;}
    const from=BigInt(fromMinor),start=performance.now();
    const tick=(now:number)=>{const p=Math.min(1,(now-start)/600),eased=1-Math.pow(1-p,3);setValue(((from*BigInt(Math.round((1-eased)*1000)))/1000n/100n*100n).toString());if(p<1)frame.current=requestAnimationFrame(tick);else setValue('0');};
    frame.current=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(frame.current);
  },[fromMinor,skipped]);
  return value;
}
const Leaf=()=><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20 4C11 4 5 8.5 5 15c0 1.6.4 3 1 4.2C7.5 14 11 10.5 15 9c-3.3 2.2-6 5.4-7.4 9.6C8.8 19.5 10.3 20 12 20c6 0 8-7 8-16z"/></svg>;

function Eased({moment}:{moment:Extract<Moment,{kind:'eased'}>}){
  const sparks=Array.from({length:10},(_,i)=>({left:`${30+((i*13)%40)}%`,delay:1250+i*40}));
  return <div className="moment-body">
    <div className="moment-stage moment-burden" aria-hidden>
      <span className="moment-halo" style={d(1350)}/>
      <span className="moment-weight"><Amount text={money(moment.amountMinor,moment.currency)} currency={moment.currency}/></span>
      <span className="moment-person"><Avatar name={moment.person} size={64}/></span>
      {sparks.map((s,i)=><span key={i} className="moment-spark" style={{left:s.left,'--d':`${s.delay}ms`} as CSSProperties}/>)}
    </div>
    <div className="moment-words moment-fade" style={d(1700)}>
      <h2>You eased {firstName(moment.person)}’s burden</h2>
      <p>{money(moment.amountMinor,moment.currency)} forgiven. {firstName(moment.person)} will be asked to acknowledge it.</p>
      {EASING_LINE_APPROVED&&<p className="moment-line">{EASING_LINE}</p>}
    </div>
  </div>;
}

'use client';
// Landing: it writes itself (Figma: Moments · Landing page, 184:11100). Plays once per visit, never loops, starts only
// when on screen. Without script, with reduced motion, or on a second visit, the finished card shows straight away.
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Check} from './icons';

const words:[string,boolean][]=[['I’m',false],['lending',false],['₦150,000',true],['to',false],['Aisha Bello',true],['for',false],['their',false],['shop',true],['rent.',true],['They’ll',false],['repay',false],['₦25,000',true],['a',true],['month',true],['from',false],['1 Dec.',true]];
export function LandingCard(){
  const ref=useRef<HTMLElement>(null),[mode,setMode]=useState<'still'|'ready'|'play'>('still');
  useEffect(()=>{
    let seen=false;try{seen=sessionStorage.getItem('treeti:landing-played')==='1';}catch{}
    if(seen||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const el=ref.current;if(!el)return;
    const start=setTimeout(()=>setMode('ready'),0);
    const io=new IntersectionObserver(([e])=>{if(e.isIntersecting){setMode('play');try{sessionStorage.setItem('treeti:landing-played','1');}catch{}io.disconnect();}},{threshold:.4});
    io.observe(el);return ()=>{clearTimeout(start);io.disconnect();};
  },[]);
  return <figure ref={ref} className={`landing-card landing-writes ${mode}`} aria-label="An example agreement">
    <p className="landing-sentence">{words.map(([w,blank],i)=><span key={i} className={`lw${blank?' lw-blank':''}`} style={{'--d':`${i*110}ms`} as CSSProperties}>{w} </span>)}</p>
    <div className="landing-signatures"><div><span className="landing-ink lw-ink" style={{'--d':'1900ms'} as CSSProperties}>Abdullah Musa</span><small><Check size={12} aria-hidden/>Lender</small></div><div><span className="landing-ink lw-ink" style={{'--d':'2350ms'} as CSSProperties}>Aisha Bello</span><small><Check size={12} aria-hidden/>Borrower</small></div></div>
    <span className="sign-seal landing-seal" style={{'--d':'3100ms'} as CSSProperties} aria-hidden><Check size={18}/></span>
  </figure>;
}

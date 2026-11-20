'use client';
import {startTransition,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from '@/components/app-link';

/**
 * On Cloudflare's free plan a page request on a freshly started Worker is sometimes cut off. A second try
 * usually lands on a warm Worker, so the page refetches itself once before showing this message.
 * "Try again" refetches too: reset() alone only redraws the same failed result.
 */
const retriedAt='treeti:page-retried-at';
export default function ErrorPage({reset}:{reset:()=>void}){
  const router=useRouter();
  const [retrying,setRetrying]=useState(true);
  const again=()=>startTransition(()=>{router.refresh();reset();});
  useEffect(()=>{
    let recent=false;
    try{recent=Date.now()-Number(sessionStorage.getItem(retriedAt)||0)<15000;sessionStorage.setItem(retriedAt,String(Date.now()));}catch{}
    if(recent){setRetrying(false);return;}
    const timer=setTimeout(again,500),giveUp=setTimeout(()=>setRetrying(false),4000);
    return ()=>{clearTimeout(timer);clearTimeout(giveUp);};
  // eslint-disable-next-line react-hooks/exhaustive-deps -- one automatic try when the error first appears
  },[]);
  if(retrying)return <main className="auth-panel" role="status" aria-live="polite"><p>Loading…</p></main>;
  return <main className="auth-panel"><h1>The page could not be loaded.</h1><p>Your records have not been changed. Check your connection and try again.</p><button className="button button-primary" onClick={()=>{setRetrying(true);again();setTimeout(()=>setRetrying(false),4000);}}>Try again</button><Link href="/">Return to treeti</Link></main>;
}

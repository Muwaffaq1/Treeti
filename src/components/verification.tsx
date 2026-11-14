'use client';
// Record check (Figma: Public · Record check 174:10583). Runs once on open; shows no amounts, names or payments.
import {useCallback,useEffect,useState} from 'react';
import {ShieldCheck,TriangleAlert} from '@/components/icons';
import {api,apiBase} from './client-api';
import {ErrorMessage} from './ui';
import {formatDate} from './agreement-utils';
import {PublicHeader} from './auth';
type Result={publicId:string;hashConsistent:boolean;finalizedAt:string;version:number;documentStatus:string};
const documentText:Record<string,string>={MATCHED:'Matches',DEMONSTRATION:'Demonstration PDF',MISMATCH:'Doesn’t match'};
export function Verification({publicId,demo,inApp=false}:{publicId:string;demo:boolean;inApp?:boolean}){
  const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const check=useCallback(async()=>{setBusy(true);setError('');try{setResult(await api<Result>(`${apiBase(demo)}/verify/${encodeURIComponent(publicId)}`));}catch(e){setError((e as Error).message);}finally{setBusy(false);}},[demo,publicId]);
  useEffect(()=>{const t=setTimeout(()=>void check(),0);return ()=>clearTimeout(t);},[check]);
  const ok=result?.hashConsistent;
  return <div className={`public-page verification-page${inApp?' in-app':''}`}>
    {!inApp&&<PublicHeader signIn/>}
    <main id="main" className="public-main">
      <div className="public-heading"><span className={`public-mark${result&&!ok?' warn':' ok'}`} aria-hidden>{result&&!ok?<TriangleAlert size={22}/>:<ShieldCheck size={22}/>}</span>
        <h1>{!result?(busy?'Checking the record…':'Check the record'):ok?'This record hasn’t changed':'This record doesn’t match'}</h1>
        <p>{!result?`${publicId}${demo?' · demonstration':''}`:ok?`${publicId} matches what was saved when it was finalised.`:`Contact treeti before relying on ${publicId}.`}</p></div>
      {result&&<dl className="public-card public-facts"><div><dt>Finalised</dt><dd>{formatDate(result.finalizedAt)}</dd></div><div><dt>Version</dt><dd>{result.version}</dd></div><div><dt>Saved PDF</dt><dd>{documentText[result.documentStatus]??'Not available yet'}</dd></div></dl>}
      <ErrorMessage message={error}/>
      {(error||result)&&<button type="button" className="button sign-tertiary public-recheck" disabled={busy} onClick={()=>void check()}>Check again</button>}
      <p className="public-note">This check shows no amounts, names or payments. It confirms the saved record hasn’t been changed. It isn’t proof of identity, a cryptographic signature, a religious ruling or a legal judgment.</p>
    </main>
  </div>;
}

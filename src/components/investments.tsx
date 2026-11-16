'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Archive,ArchiveRestore,CheckCircle2,ChevronRight,FileText,LockKeyhole,Pencil,Plus,Search,Sprout,Users} from '@/components/icons';
import {Amount,Chips,Panel,fitChars,longAmount} from './kit';
import {money} from '@/lib/money';
import {investmentTotal,investmentTotals,isShared,type Investment,type InvestmentContribution,type InvestmentPartner} from '@/modules/investments/model';
import {api,apiBase,appBase} from './client-api';
import {JointList,type JointSummary} from './investment-agreement';
import {formatDate} from './agreement-utils';
import {Button,ErrorMessage} from './ui';
import {ContributionBlanks,InvestmentBlanks,PartnersPanel} from './record-blanks';
import {firstName} from './person-colour';

const noPartners:InvestmentPartner[]=[];
/** The two kinds of investment, side by side, so people pick the one that fits. */
function InvestmentKinds({demo,onPrivate}:{demo:boolean;onPrivate:()=>void}){
  return <ul className="new-options investment-kinds">
    <li><button type="button" className="new-option" onClick={onPrivate}><span className="new-option-icon" aria-hidden><LockKeyhole size={18}/></span><span><strong>A private record</strong><small>Just for you. Only you see it, and nobody signs, even if others are in it.</small></span><ChevronRight size={18} aria-hidden/></button></li>
    <li><Link className="new-option" href={`${appBase(demo)}/investments/agreements/new`}><span className="new-option-icon" aria-hidden><Users size={18}/></span><span><strong>An agreement with partners</strong><small>You all agree who puts in how much. Everyone signs, and each of you gets the record.</small></span><ChevronRight size={18} aria-hidden/></Link></li>
  </ul>;
}
export function InvestmentTracker({initial,demo,agreements=[],joint=true}:{initial:Investment[];demo:boolean;agreements?:JointSummary[];joint?:boolean}){
  const [records,setRecords]=useState(initial);
  const [editing,setEditing]=useState<Investment|null>(null),[contributing,setContributing]=useState<{id:string;contribution?:InvestmentContribution}|null>(null);
  const [filter,setFilter]=useState<'Active'|'Archived'>('Active'),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[adding,setAdding]=useState(false),[choosing,setChoosing]=useState(false);
  const request=useRef<{text:string;key:string}|null>(null);
  const totals=investmentTotals(records),visible=records.filter(record=>record.archived===(filter==='Archived')&&`${record.name} ${record.note} ${record.currency}`.toLowerCase().includes(search.trim().toLowerCase()));
  // "New" → "An investment" lands here with ?new=1: open the form once, then tidy the address.
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('new')!=='1')return;window.history.replaceState(null,'',window.location.pathname);setNotice('');setAdding(true);
   
  },[]);
  function keyFor(url:string,body:unknown){const text=JSON.stringify({url,body});if(request.current?.text!==text)request.current={text,key:crypto.randomUUID()};return request.current!.key;}
  function replace(record:Investment){setRecords(current=>current.some(r=>r.id===record.id)?current.map(r=>r.id===record.id?record:r):[record,...current]);}
  async function archive(record:Investment){
    if(busy)return;setBusy(true);setError('');
    try{
      const url=`${apiBase(demo)}/investments/${record.id}`,body={action:'archive',archived:!record.archived,expectedRevision:record.revision};
      const {investment}=await api<{investment:Investment}>(url,body,keyFor(url,body));replace(investment);setNotice(record.archived?'Investment restored to Active.':'Investment moved to Archived. Its contributions are preserved.');request.current=null;
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const [sharingFor,setSharingFor]=useState<Investment|null>(null),[sharingError,setSharingError]=useState('');
  async function saveSharing(record:Investment,partners:InvestmentPartner[],myShare?:number){
    if(busy)return;setBusy(true);setSharingError('');
    try{
      const url=`${apiBase(demo)}/investments/${record.id}`,body={action:'edit',name:record.name,currency:record.currency,note:record.note,partners,...(myShare===undefined?{}:{myShare}),expectedRevision:record.revision};
      const {investment}=await api<{investment:Investment}>(url,body,keyFor(url,body));replace(investment);setSharingFor(null);setDetailFor(investment.id);
      setNotice(partners.length?`Shares saved for ${investment.name}.`:`${investment.name} is now just yours.`);request.current=null;
    }catch(e){setSharingError((e as Error).message);}finally{setBusy(false);}
  }
  async function reload(){
    if(busy)return;setBusy(true);
    try{const data=await api<{investments:Investment[]}>(`${apiBase(demo)}/investments`);setRecords(data.investments);setError('');setNotice('Latest records loaded. Open the entry again to edit it.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function latest(id:string){const data=await api<{investments:Investment[]}>(`${apiBase(demo)}/investments`);setRecords(data.investments);return data.investments.find(r=>r.id===id);}
  const [detailFor,setDetailFor]=useState<string|null>(null),detail=records.find(r=>r.id===detailFor);
  const active=records.filter(r=>!r.archived),main=totals.find(t=>t.currency==='NGN')??totals[0],others=totals.filter(t=>t!==main);
  const mainCount=main?active.filter(r=>r.currency===main.currency).length:0;
  const row=(record:Investment)=>{const latest=[...record.contributions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))[0],count=record.contributions.length;
        return <li key={record.id}><article className="ledger-row" aria-label={record.name}><button type="button" className="agreement-row ledger-row-button" aria-haspopup="dialog" onClick={()=>setDetailFor(record.id)}>
          <span className="agreement-row-avatar"><span className="ledger-tile" aria-hidden><Sprout size={18}/></span></span>
          <span className="agreement-row-person"><span className="agreement-row-name">{record.name}</span></span>
          <span className="agreement-row-progress"><span className="agreement-row-meta">{isShared(record)?`With ${record.partners!.map(p=>firstName(p.name)).join(', ')} · your share ${record.myShare}%`:`Last added ${money(latest.amountMinor,record.currency)} · ${formatDate(latest.date).replace(/ \d{4}$/,'')}`}</span></span>
          <span className={`agreement-row-left${longAmount(money(investmentTotal(record),record.currency))?' long':''}`}><span className="agreement-row-amount"><Amount text={money(investmentTotal(record),record.currency)} currency={record.currency}/></span><span className="agreement-row-caption">{count===1?'once':`${count} times`}</span></span>
        </button></article></li>;};
  return <div className="ledger">
    {joint&&<Panel open={choosing} onOpenChange={setChoosing} title="What kind of investment?" description="Pick the one that fits what you want to keep.">
      <InvestmentKinds demo={demo} onPrivate={()=>{setChoosing(false);setNotice('');setAdding(true);}}/>
    </Panel>}
    <InvestmentBlanks open={adding} onOpenChange={setAdding} demo={demo} onSaved={investment=>{setRecords(current=>[investment,...current]);setFilter('Active');setSearch('');setNotice('Investment saved.');}}/>
    <InvestmentBlanks open={!!editing} onOpenChange={o=>{if(!o)setEditing(null);}} demo={demo} investment={editing} onReload={()=>editing?latest(editing.id):Promise.resolve(undefined)} onSaved={investment=>{replace(investment);setNotice('Changes saved.');}}/>
    <ContributionBlanks open={!!contributing} onOpenChange={o=>{if(!o)setContributing(null);}} demo={demo} records={contributing?.contribution?records.filter(r=>r.id===contributing.id):active} startId={contributing?.id??null} contribution={contributing?.contribution} onSaved={(investment,edited)=>{replace(investment);setNotice(edited?'Changes saved.':'Contribution recorded.');}}/>
    <header className="ledger-head">
      <h1>My investments</h1>
      <p className="ledger-private"><LockKeyhole size={14} aria-hidden/>{joint?'Only you see your private records':'Only you can see these'}</p>
      {totals.length>0&&<section className="ledger-total" aria-label="Active investment totals by currency">
        <p className="ledger-amount" style={fitChars(money(main.amountMinor,main.currency))}><Amount text={money(main.amountMinor,main.currency)} currency={main.currency}/></p>
        <p className="ledger-caption">put in {mainCount===1?'one investment':`across ${mainCount} investments`}{others.length>0&&<> · plus {others.map(t=>money(t.amountMinor,t.currency)).join(' and ')}</>}</p>
      </section>}
      {totals.length>0&&<p className="ledger-next">What you’ve put in, not what it’s worth today.</p>}
    </header>
    <div role="status">{notice&&<div className="success-notice"><CheckCircle2 size={18} aria-hidden/>{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}</div>
    <ErrorMessage message={error}/>{error.includes('changed since')&&<Button variant="secondary" disabled={busy} onClick={()=>void reload()}>Load latest records</Button>}
    <JointList agreements={agreements} demo={demo}/>
    {records.length>0&&<div className="agreements-tools ledger-tools"><Chips label="Filter investments" value={filter as 'Active'|'Archived'} onChange={setFilter} options={[{id:'Active',label:'Active'},{id:'Archived',label:'Archived'}]}/><label className="agreements-search"><Search size={18} aria-hidden/><span className="sr-only">Search investments</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a name or currency"/></label></div>}
    {!records.length?<section className="agreements-empty"><span className="agreements-empty-icon" aria-hidden><Sprout size={28}/></span><h2>Keep track of what you’ve put in</h2><p>A business, a co-op, gold or something else. {joint?'Choose how you want to keep it.':'Add a name, the amount and the date to start.'}</p>{joint?<InvestmentKinds demo={demo} onPrivate={()=>{setNotice('');setAdding(true);}}/>:<div className="agreements-empty-actions"><button type="button" className="button button-primary" onClick={()=>{setNotice('');setAdding(true);}}>Add an investment</button></div>}</section>
     :!visible.length?<section className="agreements-empty"><p>{search?'No investments match your search.':filter==='Archived'?'No archived investments.':'No active investments. Add one or restore an archived record.'}</p></section>
     :<>{(filter==='Archived'?[{id:'ledger-archived',title:'Archived',items:visible}]:[{id:'ledger-shared',title:'Shared',items:visible.filter(isShared)},{id:'ledger-mine',title:'Just mine',items:visible.filter(r=>!isShared(r))}]).filter(g=>g.items.length>0).map(g=><section key={g.id} className="agreements-group ledger-group" aria-labelledby={g.id}><h2 className="kit-overline agreements-group-title" id={g.id}>{g.title} · {g.items.length}</h2>
      <ul>{g.items.map(row)}</ul>
     </section>)}</>}
    {records.length>0&&<div className="ledger-dock">
      {active.length>0&&<button type="button" className="brief-cta" onClick={()=>{setNotice('');setContributing({id:active[0].id});}}>Add money</button>}
      <button type="button" className="button sign-tertiary ledger-add" disabled={busy} aria-haspopup={joint?'dialog':undefined} onClick={()=>{setNotice('');if(joint)setChoosing(true);else setAdding(true);}}><Plus size={16} aria-hidden/>Add an investment</button>
    </div>}
    <p className="quiet-note debt-footnote">Totals include active records only. Each currency stays separate.</p>

    <Panel open={!!detail} onOpenChange={o=>{if(!o)setDetailFor(null);}} title={detail?.name??'Investment'} description={detail?`${detail.currency}${detail.archived?' · Archived':''} · ${money(investmentTotal(detail),detail.currency)} put in`:undefined}>
      {detail&&<div className="ledger-detail">
        {detail.note&&<p className="debt-note">{detail.note}</p>}
        {detail.agreementId&&<Link className="ledger-agreement-link" href={`${appBase(demo)}/investments/agreements/${detail.agreementId}`}><FileText size={16} aria-hidden/><span>From the signed agreement {detail.agreementPublicId}</span><ChevronRight size={16} aria-hidden/></Link>}
        {isShared(detail)?<div className="ledger-shares"><h3 className="kit-overline">Who it’s shared with</h3><ul><li><span>You</span><strong>{detail.myShare}%</strong></li>{detail.partners!.map((p,i)=><li key={i}><span>{p.name}</span><strong>{p.share}%</strong></li>)}</ul>{!detail.archived&&!detail.agreementId&&<button type="button" className="kit-link detail-link-button" disabled={busy} onClick={()=>{setSharingError('');setSharingFor(detail);setDetailFor(null);}}>Change who’s in it</button>}</div>
         :!detail.archived&&<button type="button" className="kit-link detail-link-button ledger-share-add" disabled={busy} onClick={()=>{setSharingError('');setSharingFor(detail);setDetailFor(null);}}>+ Shared with someone? Add them</button>}
        <div className="ledger-contributions"><h3 className="kit-overline">Each time you added money</h3>{[...detail.contributions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).map(c=><div className="investment-contribution" key={c.id}><div><span>{formatDate(c.date)}</span><strong>{money(c.amountMinor,detail.currency)}</strong>{c.note&&<p>{c.note}</p>}{c.updatedAt&&<small>Edited {formatDate(c.updatedAt)}</small>}</div>{!detail.archived&&<Button variant="ghost" disabled={busy} aria-label={`Edit contribution of ${money(c.amountMinor,detail.currency)} on ${formatDate(c.date)} to ${detail.name}`} onClick={()=>{setDetailFor(null);setNotice('');setContributing({id:detail.id,contribution:c});}}><Pencil size={16} aria-hidden/>Edit</Button>}</div>)}</div>
        <div className="ledger-detail-actions">
          {!detail.archived&&<button type="button" className="button button-primary sign-primary" disabled={busy} onClick={()=>{setDetailFor(null);setNotice('');setContributing({id:detail.id});}}>Record contribution</button>}
          <div className="ledger-detail-row"><button type="button" className="button sign-secondary" disabled={busy} aria-label={`Edit investment ${detail.name}`} onClick={()=>{setDetailFor(null);setNotice('');setEditing(detail);}}><Pencil size={16} aria-hidden/>Edit</button><button type="button" className="button sign-secondary" disabled={busy} aria-label={`${detail.archived?'Restore':'Archive'} investment ${detail.name}`} onClick={()=>{setDetailFor(null);void archive(detail);}}>{detail.archived?<ArchiveRestore size={16} aria-hidden/>:<Archive size={16} aria-hidden/>}{detail.archived?'Restore':'Archive'}</button></div>
        </div>
      </div>}
    </Panel>
    <PartnersPanel open={!!sharingFor} onOpenChange={o=>{if(!o&&!busy){setSharingFor(null);setSharingError('');}}} partners={sharingFor?.partners??noPartners} busy={busy} error={sharingError} onDone={(partners,mine)=>{if(sharingFor)void saveSharing(sharingFor,partners,mine);}}/>
  </div>;
}

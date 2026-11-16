'use client';
// Agreements list (Figma: v3 · Screens · Brief v2 · Agreements 127:4067, Desktop · Agreements 151:7370).
// Phones group rows under small headings; wide screens show the same rows as a table.
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import type {Actor,Aggregate} from '@/modules/agreements/types';
import type {PendingBorrowerInvitation} from '@/modules/agreements/pending-invitations';
import {installmentProgress} from '@/modules/agreements/repayment-plan';
import {calendarDate} from '@/lib/calendar';
import {money} from '@/lib/money';
import {Search,FileText} from './icons';
import {Avatar,Chips,Tag,Panel,RingAvatar,Amount,TotalsPanel,longAmount} from './kit';
import {Breakdown,breakdown,type Side} from './brief';
import {currentVersion,needsAttention,participantFor} from './agreement-utils';
import {nextWhen,shortDate} from './dates';
import {firstName} from './person-colour';
import {api,apiBase,appBase} from './client-api';
import {ErrorMessage} from './ui';

type Filter='Open'|'Lent'|'Borrowed'|'Settled'|'Cancelled';
type Group='Needs you'|'Waiting on others'|'Active'|'Drafts'|'Settled'|'Cancelled';
const GROUPS:Group[]=['Needs you','Waiting on others','Active','Drafts','Settled','Cancelled'];
const IN_PROGRESS=['AWAITING_BORROWER','AWAITING_APPROVAL','AWAITING_WITNESSES','CHANGES_REQUESTED'];

type Row={a:Aggregate;group:Group;name:string;describe:string;progress?:{fraction:number;count:string;quiet:boolean};tag?:{tone:'action'|'positive'|'neutral';text:string};next:string;nextShort:string;amount:string;caption:string};

function purposeText(purpose:string){const text=purpose.trim().replace(/\.$/,'');return text?`for ${text.charAt(0).toLowerCase()}${text.slice(1)}`:'';}

function rowFor(a:Aggregate,actor:Actor,today:string):Row{
  const me=participantFor(a,actor.userId),them=a.participants.find(p=>p.role!=='WITNESS'&&p.userId!==actor.userId),name=them?.name||'Shared agreement';
  const t=currentVersion(a).terms,cur=t.currency,purpose=purposeText(t.purpose),principal=money(t.principalMinor,cur),turn=needsAttention(a,actor.userId);
  const join=(...parts:string[])=>parts.filter(Boolean).join(' · ');
  const base={a,name,next:'',nextShort:''};
  if(a.status==='CANCELLED')return {...base,group:'Cancelled',describe:join('Cancelled proposal',purpose),tag:{tone:'neutral',text:'Cancelled'},amount:principal,caption:'cancelled'};
  if(a.status==='SETTLED')return {...base,group:'Settled',describe:join(`Settled${a.settledAt?` ${shortDate(a.settledAt.slice(0,10))}`:''}`,purpose),tag:{tone:'positive',text:'Settled'},amount:principal,caption:'repaid'};
  if(a.status==='DRAFT')return {...base,group:'Drafts',describe:join('Not sent yet',purpose),tag:{tone:'neutral',text:'Draft'},amount:principal,caption:'draft'};
  if(IN_PROGRESS.includes(a.status)){
    const who=firstName(name);
    const text=a.status==='CHANGES_REQUESTED'?(turn?`${who} asked for changes`:'You asked for changes')
      :a.status==='AWAITING_WITNESSES'?(me.role==='WITNESS'?'Asked you to witness':'Waiting for witnesses')
      :turn?(me.role==='BORROWER'?'Wants to lend you':'Waiting for your approval'):`Waiting for ${who}`;
    return {...base,group:turn?'Needs you':'Waiting on others',describe:join(text,purpose),tag:turn?{tone:'action',text:'Your turn'}:{tone:'neutral',text:'Waiting'},amount:principal,caption:'proposed'};
  }
  // Active or waiting for settlement: progress by money repaid, and the next part due.
  const plan=t.installments?.payments??[],total=BigInt(t.principalMinor),left=BigInt(a.balanceMinor),fraction=total>0n?Number(total-left)/Number(total):0;
  let count:string,quiet:boolean,due=t.dueDate,part=a.balanceMinor;
  if(plan.length){const progress=installmentProgress(a,plan),done=progress.filter(p=>p.remainingMinor==='0').length,next=progress.find(p=>p.remainingMinor!=='0');count=`${done} of ${plan.length} paid`;quiet=done===0;if(next){due=next.dueDate;part=next.remainingMinor;}}
  else{const paid=total-left;count=paid>0n?`${money(paid.toString(),cur)} repaid`:'Nothing repaid yet';quiet=paid===0n;}
  const whenText=nextWhen(due,today),settling=a.status==='SETTLEMENT_PENDING';
  const caption=me.role==='LENDER'?'owes you':me.role==='BORROWER'?'you owe':'witnessed';
  const proposed=a.repayments.some(r=>r.status==='PROPOSED'&&r.participantId!==me.id);
  const soft=/^(Today|Tomorrow|In |Was )/.test(whenText)?whenText.charAt(0).toLowerCase()+whenText.slice(1):whenText;
  const next=settling?'Fully repaid':/^was /.test(soft)?soft:plan.length?`next ${soft}`:`due ${soft}`;
  const nextShort=settling?'Fully repaid':plan.length?`${whenText.replace(/^(\w{3})\w+day$/,'$1')} · ${money(part,cur)}`:soft;
  return {...base,group:turn?'Needs you':'Active',describe:turn?(settling?'Fully repaid · confirm it’s settled':proposed?`${firstName(name)} recorded a payment`:'Your turn'):next,progress:{fraction,count,quiet},tag:turn?{tone:'action',text:'Your turn'}:undefined,next,nextShort,amount:money(a.balanceMinor,cur),caption};
}

export function AgreementsList({agreements,invitations,actor,demo}:{agreements:Aggregate[];invitations:PendingBorrowerInvitation[];actor:Actor;demo:boolean}){
  const base=appBase(demo),today=calendarDate(),[filter,setFilter]=useState<Filter>('Open'),[query,setQuery]=useState('');
  const [sheet,setSheet]=useState(false),[side,setSide]=useState<Side>('owed');
  // The desktop top-bar search lands here with ?q=.
  useEffect(()=>{const q=new URLSearchParams(window.location.search).get('q');if(q)setQuery(q);},[]);
  const totals=breakdown(agreements,actor,today,base);
  const open=agreements.filter(a=>!['SETTLED','CANCELLED'].includes(a.status)).length,settled=agreements.filter(a=>a.status==='SETTLED').length,cancelledCount=agreements.filter(a=>a.status==='CANCELLED').length;
  const q=query.trim().toLowerCase();
  const rows=agreements.filter(a=>{
    const role=participantFor(a,actor.userId)?.role,person=a.participants.find(p=>p.role!=='WITNESS'&&p.userId!==actor.userId);
    const matches=!q||`${a.publicId} ${person?.name??''} ${currentVersion(a).terms.purpose}`.toLowerCase().includes(q);
    const live=a.status!=='CANCELLED';
    return matches&&(filter==='Open'&&live&&a.status!=='SETTLED'||filter==='Lent'&&live&&role==='LENDER'||filter==='Borrowed'&&live&&role==='BORROWER'||filter==='Settled'&&a.status==='SETTLED'||filter==='Cancelled'&&a.status==='CANCELLED');
  }).map(a=>rowFor(a,actor,today)).sort((x,y)=>GROUPS.indexOf(x.group)-GROUPS.indexOf(y.group));
  const groups=GROUPS.map(g=>[g,rows.filter(r=>r.group===g)] as const).filter(([,r])=>r.length);
  const emptyDefault=filter==='Open'&&!q&&open===0,emptyCancelled=filter==='Cancelled'&&!q;
  const showSide=(s:Side)=>{setSide(s);setSheet(true);};
  return <div className="agreements-page">
    <header className="agreements-head">
      <div className="agreements-title"><h1>Your agreements</h1><p>{open} open · {settled} settled</p></div>
      {totals.any&&<div className="agreements-totals"><TotalsPanel owed={{parts:totals.owed.totals,people:new Set(totals.owed.rows.map(r=>r.name)).size}} owe={{parts:totals.owe.totals,people:new Set(totals.owe.rows.map(r=>r.name)).size}} onOpen={showSide}/></div>}
    </header>
    <div className="agreements-tools">
      <label className="agreements-search"><Search size={18} aria-hidden/><span className="sr-only">Search agreements</span><input type="text" enterKeyHint="search" placeholder="Search a name or record" value={query} onChange={e=>setQuery(e.target.value)} autoComplete="off"/></label>
      <Chips label="Filter agreements" value={filter} onChange={setFilter} options={(['Open','Lent','Borrowed','Settled','Cancelled'] as Filter[]).map(id=>({id,label:id}))}/>
    </div>
    {invitations.length>0&&filter==='Open'&&!q&&<Invitations invitations={invitations} demo={demo}/>}
    {rows.length>0?<div className="agreements-table">
      <div className="agreements-table-head" aria-hidden><span>Person</span><span>Progress</span><span>Next</span><span>Left</span></div>
      {groups.map(([group,list])=><section key={group} className="agreements-group" aria-labelledby={`group-${group.replace(/\s/g,'-')}`}>
        <h2 className="kit-overline agreements-group-title" id={`group-${group.replace(/\s/g,'-')}`}>{group} · {list.length}</h2>
        <ul>{list.map(r=><li key={r.a.id}><AgreementRow row={r} href={`${base}/agreements/${r.a.id}`}/></li>)}</ul>
      </section>)}
    </div>:<div className="agreements-empty">
      <span className="agreements-empty-icon" aria-hidden><FileText size={28}/></span>
      <h2>{emptyCancelled?'No cancelled agreements':emptyDefault?'Every good agreement starts with a conversation':'No agreements match this view'}</h2>
      <p>{emptyCancelled?'Proposals you cancel will be kept here.':emptyDefault?(cancelledCount?'Your cancelled proposals are kept in the Cancelled tab.':'When you’re ready, put the details in writing and review them together.'):'Try another name or choose a different tab.'}</p>
      <div className="agreements-empty-actions">{emptyDefault?<>{cancelledCount>0&&<button type="button" className="button button-secondary" onClick={()=>setFilter('Cancelled')}>View cancelled agreements</button>}<Link className="button button-primary" href={`${base}/agreements/new`}>Create an agreement</Link></>:q?<button type="button" className="button button-secondary" onClick={()=>setQuery('')}>Clear search</button>:<button type="button" className="button button-secondary" onClick={()=>setFilter('Open')}>View open agreements</button>}</div>
    </div>}
    {totals.any&&<Panel open={sheet} onOpenChange={setSheet} title="Totals breakdown" hideTitle><Breakdown totals={totals} side={side} onSide={setSide}/></Panel>}
  </div>;
}

function AgreementRow({row:r,href}:{row:Row;href:string}){
  const current=usePathname()===href;
  const pct=r.progress?Math.max(0,Math.min(1,r.progress.fraction))*100:0;
  return <Link className={`agreement-row agreement-card group-${r.group.split(' ')[0].toLowerCase()}`} href={href} aria-current={current?'page':undefined}>
    <span className="agreement-row-avatar">{r.progress?<RingAvatar name={r.name} fraction={r.progress.fraction}/>:<Avatar name={r.name} size={32}/>}</span>
    <span className="agreement-row-person"><h3 className="agreement-row-name">{r.name}</h3><span className="sr-only">{r.a.publicId}</span></span>
    <span className="agreement-row-progress">
      {r.progress&&<span className="agreement-row-bar" aria-hidden><span style={{width:`${pct}%`}}/></span>}
      <span className="agreement-row-meta">
        {r.progress&&<span className={r.progress.quiet?'kit-count-quiet':'kit-count'}>{r.progress.count}</span>}
        {r.progress&&r.next&&<span className="agreement-row-next-inline"> · {r.next}</span>}
        {!r.progress&&<span className="agreement-row-describe"><span className="agreement-row-dot" aria-hidden/>{r.describe}</span>}
      </span>
      {r.tag&&(r.tag.tone==='action'||!r.progress)&&<span className={r.tag.tone==='action'?'agreement-row-tag':'agreement-row-tag agreement-row-tag-wide'}><Tag tone={r.tag.tone}>{r.tag.text}</Tag></span>}
    </span>
    <span className="agreement-row-next">{r.progress?r.nextShort:r.describe}</span>
    <span className={`agreement-row-left${longAmount(r.amount)?' long':''}`}><span className="agreement-row-amount"><Amount text={r.amount} currency={currentVersion(r.a).terms.currency}/></span><span className="agreement-row-caption">{r.caption}</span></span>
  </Link>;
}

/** Invitations not opened yet: reviewing one opens the agreement without accepting anything. */
function Invitations({invitations,demo}:{invitations:PendingBorrowerInvitation[];demo:boolean}){
  const router=useRouter(),[opening,setOpening]=useState(''),[error,setError]=useState('');
  async function open(id:string){setOpening(id);setError('');try{const r=await api<{agreementId:string}>(`${apiBase(demo)}/pending-invitations/${id}/claim`,{});router.push(`${appBase(demo)}/agreements/${r.agreementId}`);router.refresh();}catch(e){setError((e as Error).message);setOpening('');}}
  return <section className="agreements-group" aria-labelledby="group-invitations"><h2 className="kit-overline agreements-group-title agreements-invite-title" id="group-invitations">Invitations</h2><ErrorMessage message={error}/>
    <ul>{invitations.map(i=><li key={i.id}><article className="agreement-invite"><Avatar name={i.lenderName} size={32}/><span className="agreement-invite-text"><strong>{i.lenderName} invited you to review an agreement</strong><small>{i.publicId} · Opening it doesn’t mean you accept the terms.</small></span><button type="button" className="create-share-button" disabled={!!opening} aria-busy={opening===i.id} onClick={()=>void open(i.id)}>Review agreement</button></article></li>)}</ul>
  </section>;
}

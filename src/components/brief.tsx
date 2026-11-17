'use client';
// The home "brief" (Figma: v3 · Screens · Brief v2 · Home 120:3793, Totals breakdown 120:4005, Desktop · Home 151:6780).
// A few short sentences about what needs you, what's coming up and what changed since yesterday.
// Each sentence opens a slide-up panel or a page with the one thing to do next.
import Link from '@/components/app-link';
import {useRouter} from 'next/navigation';
import {useState,type ReactNode} from 'react';
import * as Sheet from '@radix-ui/react-dialog';
import type {Actor,Aggregate,Participant} from '@/modules/agreements/types';
import type {PendingBorrowerInvitation} from '@/modules/agreements/pending-invitations';
import {installmentProgress} from '@/modules/agreements/repayment-plan';
import {calendarDate} from '@/lib/calendar';
import {money} from '@/lib/money';
import {ErrorMessage} from './ui';
import {ChevronRight,FileText,Sprout,Users,WalletCards} from './icons';
import {DAY,daysBetween,shortDate,when,nextWhen} from './dates';
import {Panel as KitPanel,ValueSwitch,PersonRow,RingAvatar,Amount,TotalsPanel,Avatar as KitAvatar} from './kit';
import {api,apiBase,appBase} from './client-api';
import {initials,firstName} from './person-colour';
import {currentVersion,formatDate,hasApproval,needsAttention,participantFor} from './agreement-utils';

type Detail={label:string;value:string};
type Panel={kicker:string;since?:string;person:string;title:string;amount?:{minor:string;currency:string};tag?:string;details:Detail[];primary:{label:string;href?:string;invitationId?:string};secondary?:{label:string;href:string};note?:string};
type Line={key:string;sentence:ReactNode;href?:string;panel?:Panel;cta?:string};

/** "2h ago" style, used only inside the panel (rendered on the client, so no hydration mismatch). */
function ago(iso:string){const m=Math.max(0,Math.round((Date.now()-Date.parse(iso))/60000));if(m<1)return 'just now';if(m<60)return `${m}m ago`;const h=Math.round(m/60);if(h<24)return `${h}h ago`;const d=Math.round(h/24);return d===1?'yesterday':`${d}d ago`;}

// Sentence pieces. Each piece is one item in a centred wrapping row, 4px apart, like the Figma auto layout.
// The real space after each piece is dropped by flex layout but kept for screen readers and copying.
const Avatar=({name}:{name:string})=><span className="brief-avatar" aria-hidden>{initials(name)}</span>;
const P=({children}:{children:ReactNode})=><><span className="brief-chunk">{children}</span>{' '}</>;
const N=({name,possessive}:{name:string;possessive?:boolean})=><><span className="brief-chunk brief-person"><Avatar name={name}/><span className="brief-name">{firstName(name)}{possessive?'’s':''}</span></span>{' '}</>;
const A=({minor,currency,end=''}:{minor:string;currency:string;end?:string})=><><span className="brief-chunk brief-amount">{money(minor,currency)}{end}</span>{' '}</>;
const E=({children,tone}:{children:ReactNode;tone?:'positive'|'danger'})=><><span className={`brief-chunk brief-em${tone?` brief-${tone}`:''}`}>{children}</span>{' '}</>;

const other=(a:Aggregate,userId:string)=>a.participants.find(p=>p.role!=='WITNESS'&&p.userId!==userId);
const named=(p:Participant|undefined,fallback:string)=>p?.name||fallback;
function purposeText(purpose:string){const text=purpose.trim().replace(/\.$/,'');return text?text.charAt(0).toLowerCase()+text.slice(1):'';}
const lastEvent=(a:Aggregate)=>a.events.at(-1)?.createdAt??a.createdAt;

/** The facts a person needs before opening an agreement: what it's for, how it's repaid, who witnesses. */
function facts(a:Aggregate):{tag:string;details:Detail[]}{
  const t=currentVersion(a).terms,plan=t.installments?.payments??[],details:Detail[]=[];
  if(t.purpose.trim())details.push({label:'For',value:t.purpose.trim()});
  if(t.repaymentType==='INSTALLMENTS'&&plan.length){
    const same=plan.every(p=>p.amountMinor===plan[0].amountMinor),per=t.installments?.frequency==='WEEKLY'?' a week':t.installments?.frequency==='MONTHLY'?' a month':'';
    details.push({label:'Payment',value:same?`${money(plan[0].amountMinor,t.currency)}${per}`:`${plan.length} payments`});
    details.push({label:'First part',value:formatDate(plan[0].dueDate)});
  }else details.push({label:'Repaid by',value:formatDate(t.dueDate)});
  const witnessNames=a.participants.filter(p=>p.role==='WITNESS'&&p.versionIds.includes(a.currentVersionId)).map(p=>firstName(p.name));
  if(witnessNames.length)details.push({label:'Witnesses',value:witnessNames.join(' and ')});
  else if(t.requiredWitnesses>0)details.push({label:'Witnesses',value:t.requiredWitnesses===1?'1 to be invited':`${t.requiredWitnesses} to be invited`});
  return {tag:t.repaymentType==='INSTALLMENTS'&&plan.length?`to be repaid in ${plan.length} installments`:`to be repaid by ${formatDate(t.dueDate)}`,details};
}

function needsLine(a:Aggregate,actor:Actor,base:string):Line{
  const me=participantFor(a,actor.userId),them=other(a,actor.userId),t=currentVersion(a).terms,href=`${base}/agreements/${a.id}`;
  const amount=<A minor={t.principalMinor} currency={t.currency}/>,purpose=purposeText(t.purpose),{tag,details}=facts(a);
  const lender=a.participants.find(p=>p.role==='LENDER'),theirName=named(them,'Someone');
  const panel=(kicker:string,title:string,primary:string,extra:Partial<Panel>={}):Panel=>({kicker,since:lastEvent(a),person:theirName,title,amount:{minor:t.principalMinor,currency:t.currency},tag,details,primary:{label:primary,href},...extra});
  const proposed=a.repayments.find(r=>r.status==='PROPOSED'&&r.participantId!==me.id);
  if(a.status==='CHANGES_REQUESTED')return {key:a.id,sentence:<><N name={theirName}/><P>asked for changes to</P>{amount}</>,panel:panel('Change request',`${theirName} asked for changes`,'See what changed'),cta:`See ${firstName(theirName)}’s changes`};
  if(['AWAITING_BORROWER','AWAITING_APPROVAL'].includes(a.status)&&!hasApproval(a,me.role)){
    if(me.role==='BORROWER')return {key:a.id,sentence:<><N name={theirName}/><P>wants to lend you</P>{amount}{purpose&&<P>for {purpose}</P>}</>,panel:panel('Loan request',`${theirName} wants to lend you`,'Read and sign',{primary:{label:'Read and sign',href:`${href}?respond=sign`},secondary:{label:'Reject request',href:`${href}?respond=decline`},note:'Opening it doesn’t mean you accept the terms.'}),cta:`Review ${firstName(theirName)}’s request`};
    return {key:a.id,sentence:<><N name={theirName} possessive/><P>agreement for</P>{amount}<P>is waiting for</P><E>your approval</E></>,panel:panel('Waiting for you',`${theirName} is waiting for your approval`,'Read and approve',{primary:{label:'Read and approve',href:`${href}?respond=sign`}}),cta:`Review ${firstName(theirName)}’s agreement`};
  }
  if(a.status==='AWAITING_WITNESSES'){
    if(me.role==='WITNESS'){const l=named(lender,'Someone');return {key:a.id,sentence:<><N name={l}/><P>asked you to witness</P>{amount}</>,panel:{...panel('Witness request',`${l} asked you to witness`,'Review and witness'),person:l},cta:`Review ${firstName(l)}’s request`};}
    return {key:a.id,sentence:<><P>Your agreement with</P><N name={theirName}/><P>for</P>{amount}<P>needs</P><E>witnesses</E></>,panel:panel('Witnesses',`Your agreement with ${theirName} needs witnesses`,'Invite witnesses'),cta:'Invite witnesses'};
  }
  if(a.status==='SETTLEMENT_PENDING')return {key:a.id,sentence:<><P>Your agreement with</P><N name={theirName}/><P>is</P><E tone="positive">fully repaid.</E><P>Confirm it’s settled</P></>,panel:panel('Fully repaid',`${theirName}’s agreement is fully repaid`,'Confirm it’s settled'),cta:'Confirm it’s settled'};
  if(proposed)return {key:a.id,sentence:<><N name={theirName}/><P>recorded a payment of</P><A minor={proposed.amountMinor} currency={t.currency} end="."/><P>Check it came in</P></>,panel:{...panel('Payment to check',`${theirName} recorded a payment`,'Check this payment'),since:proposed.createdAt,amount:{minor:proposed.amountMinor,currency:t.currency}},cta:`Check ${firstName(theirName)}’s payment`};
  const l=named(lender,'Your lender');
  return {key:a.id,sentence:<><N name={l}/><P>forgave part of your balance.</P><E>Acknowledge it</E></>,panel:{...panel('Forgiveness',`${l} forgave part of your balance`,'Acknowledge it'),person:l},cta:'Acknowledge it'};
}

function comingLine(a:Aggregate,actor:Actor,today:string,base:string):(Line&{due:string})|null{
  const me=participantFor(a,actor.userId),them=other(a,actor.userId),t=currentVersion(a).terms;
  if(me?.role==='WITNESS'||!them)return null;
  const next=t.installments?.payments.length?installmentProgress(a,t.installments.payments).find(p=>p.remainingMinor!=='0'):undefined;
  const due=next?.dueDate??t.dueDate,partMinor=next?.remainingMinor??a.balanceMinor,days=daysBetween(today,due),late=days<0,href=`${base}/agreements/${a.id}`,dueText=when(due,today);
  if(me.role==='LENDER'){
    const what=next?<><P>next part of</P><A minor={partMinor} currency={t.currency}/></>:<A minor={partMinor} currency={t.currency}/>;
    return {key:a.id,due,href,sentence:late?<><N name={them.name} possessive/>{what}<P>was due</P><E tone="danger">{shortDate(due)}</E></>:<><N name={them.name} possessive/>{what}<P>is due</P><E>{dueText}</E></>};
  }
  return {key:a.id,due,href,sentence:late?<><P>You owe</P><N name={them.name}/><A minor={a.balanceMinor} currency={t.currency} end="."/><P>Your payment of</P><A minor={partMinor} currency={t.currency}/><P>was due</P><E tone="danger">{shortDate(due)}.</E></>
    :<><P>You owe</P><N name={them.name}/><A minor={a.balanceMinor} currency={t.currency} end="."/><P>Your next payment is</P><E>{dueText}{days>=7?',':'.'}</E>{days>=7&&<P>so you’ve got time.</P>}</>};
}

/** Payments confirmed and agreements settled or finalised since the start of yesterday (Nigerian calendar). */
function sinceLines(agreements:Aggregate[],actor:Actor,today:string,base:string):Line[]{
  const yesterday=new Date(Date.parse(`${today}T00:00:00+01:00`)-DAY).toISOString(),lines:(Line&{at:string})[]=[];
  for(const a of agreements){
    const me=participantFor(a,actor.userId),them=other(a,actor.userId),t=currentVersion(a).terms,href=`${base}/agreements/${a.id}`;
    if(!me||me.role==='WITNESS'||!them)continue;
    for(const c of a.repaymentConfirmations){
      if(c.action!=='CONFIRMED'||c.createdAt<yesterday)continue;const r=a.repayments.find(x=>x.id===c.repaymentId);if(!r)continue;
      const plan=t.installments?.payments,progress=plan?.length?installmentProgress(a,plan):null,done=progress?.filter(p=>p.remainingMinor==='0').length??0;
      const parts=progress?<><E tone="positive">{done} of {progress.length} parts</E><P>{done===1?'has':'have'} been paid.</P></>:null;
      const amount=<A minor={r.amountMinor} currency={t.currency} end="."/>;
      lines.push({key:c.id,at:c.createdAt,href,sentence:r.participantId===me.id?<><P>You paid</P><N name={them.name}/>{amount}{parts}</>:<><N name={them.name}/><P>paid</P>{amount}{parts}</>});
    }
    const settled=a.events.find(e=>e.type==='AGREEMENT_SETTLED'&&e.createdAt>=yesterday),finalized=a.events.find(e=>e.type==='AGREEMENT_FINALIZED'&&e.createdAt>=yesterday);
    if(settled)lines.push({key:settled.id,at:settled.createdAt,href,sentence:<><P>Your agreement with</P><N name={them.name}/><P>is</P><E tone="positive">settled.</E></>});
    else if(finalized)lines.push({key:finalized.id,at:finalized.createdAt,href,sentence:<><P>Your agreement with</P><N name={them.name}/><P>for</P><A minor={t.principalMinor} currency={t.currency}/><P>is</P><E>now active.</E></>});
  }
  return lines.sort((x,y)=>y.at.localeCompare(x.at)).slice(0,3);
}

function countText(n:number){if(n===0)return 'Nothing needs you today';if(n===1)return 'One thing needs you today';return `${n} things need you today`;}
const sectionId=(title:string)=>`brief-${title.replace(/\s/g,'-').toLowerCase()}`;

/** An investment agreement waiting on this person: sign it, witness it, or answer a change request. */
export type JointRequest={id:string;person:string;venture:string;turn:'sign'|'witness'|'revise'};
export function Brief({agreements,invitations,actor,demo,accessRequests,jointRequests=[],joint=true}:{joint?:boolean;agreements:Aggregate[];invitations:PendingBorrowerInvitation[];actor:Actor;demo:boolean;accessRequests:{id:string;name:string;opensAt:string}[];jointRequests?:JointRequest[]}){
  const base=appBase(demo),today=calendarDate(),[open,setOpen]=useState<Panel|null>(null);
  const needs:Line[]=[
    ...invitations.map(i=>({key:i.id,sentence:<><N name={i.lenderName}/><P>invited you to review an agreement</P></>,panel:{kicker:`Invitation · ${i.publicId}`,since:i.createdAt,person:i.lenderName,title:`${i.lenderName} invited you to review an agreement`,details:[],primary:{label:'Review agreement',invitationId:i.id},note:'Opening it does not mean you accept the terms.'},cta:`Review ${firstName(i.lenderName)}’s invitation`} satisfies Line)),
    ...accessRequests.map(r=>({key:r.id,href:`${base}/trusted-contacts`,sentence:<><N name={r.name}/><P>asked to see your debts.</P><P>They can from</P><E>{shortDate(r.opensAt.slice(0,10))}</E><P>unless you refuse</P></>,cta:`Review ${firstName(r.name)}’s request`} satisfies Line)),
    ...jointRequests.map(r=>({key:r.id,href:`${base}/investments/agreements/${r.id}`,sentence:r.turn==='revise'?<><N name={r.person}/><P>asked for a change to your investment in</P><E>{r.venture}.</E></>:<><N name={r.person}/><P>asked you to {r.turn==='sign'?'sign':'witness'} an investment in</P><E>{r.venture}.</E></>,cta:r.turn==='revise'?'Review the change':r.turn==='sign'?'Read and sign':'Read and witness'} satisfies Line)),
    ...agreements.filter(a=>needsAttention(a,actor.userId)).map(a=>needsLine(a,actor,base)),
  ];
  const needed=new Set(needs.map(n=>n.key));
  const coming=agreements.filter(a=>a.status==='ACTIVE'&&!needed.has(a.id)).map(a=>comingLine(a,actor,today,base)).filter(x=>x!==null).sort((x,y)=>x.due.localeCompare(y.due));
  const since=sinceLines(agreements,actor,today,base);
  const empty=!agreements.some(a=>a.status!=='CANCELLED')&&!invitations.length&&!jointRequests.length&&!accessRequests.length;
  const sections:[string,Line[]][]=[['Needs you',needs],['Coming up',coming.slice(0,3)],['Since yesterday',since]];
  const totals=breakdown(agreements,actor,today,base),[sheet,setSheet]=useState(false),[side,setSide]=useState<Side>('owed');
  const top=needs[0],openLine=(line:Line)=>{if(line.panel)setOpen(line.panel);};
  const showSide=(s:Side)=>{setSide(s);setSheet(true);};
  return <div className="brief-home">
  <div className="brief">
    <header className="brief-intro"><h1>As-salamu alaykum, {firstName(actor.name)}.</h1><p>{empty?'Nothing written down yet':countText(needs.length)}</p></header>
    {totals.any&&<div className="brief-totals-wrap"><TotalsPanel owed={{parts:totals.owed.totals,people:peopleIn(totals.owed.rows)}} owe={{parts:totals.owe.totals,people:peopleIn(totals.owe.rows)}} onOpen={showSide}/></div>}
    <div className="brief-sections">
      {empty?<div className="brief-start"><p className="brief-welcome">Lending to someone you trust? Put it in writing, agree it together, and keep track of every payment.</p>
        <ul className="new-options">{[{href:`${base}/agreements/new`,title:'Write an agreement',detail:'You lend, you both sign',Icon:FileText},{href:`${base}/debts?new=1`,title:'Record a debt',detail:'Money you owe, just for you',Icon:WalletCards},{href:`${base}/investments?new=1`,title:'Record an investment',detail:'A private record, just for you',Icon:Sprout},{href:`${base}/investments/agreements/new`,title:'Write an investment agreement',detail:'With partners, everyone signs',Icon:Users}].filter(o=>joint||!o.href.includes('/investments/agreements')).map(({href,title,detail,Icon})=><li key={href}><Link className="new-option" href={href}><span className="new-option-icon" aria-hidden><Icon size={18}/></span><span><strong>{title}</strong><small>{detail}</small></span><ChevronRight size={18} aria-hidden/></Link></li>)}</ul>
        <Link className="brief-link" href={`${base}/guide`}>See how treeti works</Link></div>:
      sections.filter(([,lines])=>lines.length).map(([title,lines])=><section className={`brief-section${title==='Needs you'?' brief-needs':''}`} key={title} aria-labelledby={sectionId(title)}>
        <h2 id={sectionId(title)}>{title.toUpperCase()}</h2>
        <ul>{lines.map(line=><li key={line.key}>{line.panel?<button type="button" className="brief-line brief-action" aria-haspopup="dialog" onClick={()=>openLine(line)}>{line.sentence}<span className="brief-chunk brief-chevron" aria-hidden><ChevronRight size={18}/></span></button>:line.href?<Link className="brief-line brief-action" href={line.href}>{line.sentence}</Link>:<p className="brief-line">{line.sentence}</p>}</li>)}</ul>
        {title==='Coming up'&&coming.length>3&&<Link className="brief-link" href={`${base}/agreements`}>See all agreements</Link>}
      </section>)}
    </div>
    {!empty&&<div className="brief-dock">{top?.cta?(top.panel
      ?<button type="button" className="brief-cta" aria-haspopup="dialog" onClick={()=>openLine(top)}><KitAvatar name={top.panel.person} size={24}/>{top.cta}</button>
      :<Link className="brief-cta" href={top.href!}>{top.cta}</Link>)
      :<Link className="brief-cta" href={`${base}/agreements/new`}>Create agreement</Link>}</div>}
    <BriefPanel panel={open} demo={demo} onClose={()=>setOpen(null)}/>
  </div>
  {totals.any&&<aside className="brief-side" aria-label="Totals breakdown"><Breakdown totals={totals} side={side} onSide={setSide}/></aside>}
  <KitPanel open={sheet} onOpenChange={setSheet} title="Totals breakdown" hideTitle><Breakdown totals={totals} side={side} onSide={setSide}/></KitPanel>
  </div>;
}

export type Side='owed'|'owe';
type Row={id:string;currency:string;name:string;href:string;leftMinor:string;fraction:number;count:string;quiet:boolean;next:string;due:string};
export type Totals={any:boolean;currency:string;owed:{totals:[string,string][];rows:Row[]};owe:{totals:[string,string][];rows:Row[]}};
/** One amount per currency, joined: "₦250,000 + GBP 1,100". Nothing owed shows as zero in the main currency. */
const peopleIn=(rows:{name:string}[])=>new Set(rows.map(r=>r.name)).size;
export function totalText(list:[string,string][],fallback:string){return list.length?list.map(([c,m])=>money(m,c)).join(' + '):money('0',fallback);}
/** Money still to come back to you and still to pay, from shared agreements in one currency (the one used most). */
export function breakdown(agreements:Aggregate[],actor:Actor,today:string,base:string):Totals{
  const live=agreements.filter(a=>['ACTIVE','SETTLEMENT_PENDING'].includes(a.status)&&a.balanceMinor!=='0'&&['LENDER','BORROWER'].includes(participantFor(a,actor.userId)?.role??''));
  const side=(role:string)=>{
    const rows=live.filter(a=>participantFor(a,actor.userId).role===role).map(a=>{
      const t=currentVersion(a).terms,currency=t.currency,them=other(a,actor.userId),plan=t.installments?.payments??[];
      const principal=BigInt(t.principalMinor),left=BigInt(a.balanceMinor),fraction=principal>0n?Number(principal-left)/Number(principal):0;
      if(plan.length){const progress=installmentProgress(a,plan),done=progress.filter(p=>p.remainingMinor==='0').length,next=progress.find(p=>p.remainingMinor!=='0');
        return {id:a.id,currency,name:named(them,'Someone'),href:`${base}/agreements/${a.id}`,leftMinor:a.balanceMinor,fraction,count:`${done} of ${plan.length} paid`,quiet:done===0,next:next?`${money(next.remainingMinor,currency)} · ${nextWhen(next.dueDate,today)}`:'',due:next?.dueDate??t.dueDate};}
      const paid=principal-left;
      return {id:a.id,currency,name:named(them,'Someone'),href:`${base}/agreements/${a.id}`,leftMinor:a.balanceMinor,fraction,count:paid>0n?`${money(paid.toString(),currency)} repaid`:'Nothing repaid yet',quiet:paid===0n,next:nextWhen(t.dueDate,today),due:t.dueDate};
    }).sort((x,y)=>x.due.localeCompare(y.due));
    const sums=new Map<string,bigint>();for(const r of rows)sums.set(r.currency,(sums.get(r.currency)??0n)+BigInt(r.leftMinor));
    return {totals:[...sums].sort((x,y)=>x[0]==='NGN'?-1:y[0]==='NGN'?1:x[0].localeCompare(y[0])).map(([c,m])=>[c,m.toString()] as [string,string]),rows};
  };
  const owed=side('LENDER'),owe=side('BORROWER'),main=owed.totals[0]?.[0]??owe.totals[0]?.[0]??'NGN';
  return {any:live.length>0,currency:main,owed,owe};
}
const soft=(w:string)=>/^(Today|Tomorrow|In |Was )/.test(w)?w.charAt(0).toLowerCase()+w.slice(1):w;
export function Breakdown({totals,side,onSide}:{totals:Totals;side:Side;onSide:(s:Side)=>void}){
  const current=totals[side],people=new Set(current.rows.map(r=>r.name)).size,first=current.rows[0];
  const split=(list:[string,string][])=>{if(list.length>1)return <span className="brief-switch-multi">{list.map(([c,m],i)=><span key={c}>{i>0&&' + '}<Amount text={money(m,c)} currency={c}/></span>)}</span>;const [c,m]=list[0]??[totals.currency,'0'];return <Amount text={money(m,c)} currency={c}/>;};
  return <div className="brief-breakdown">
    <ValueSwitch label="Show money" value={side} onChange={onSide} options={[{id:'owed',label:'Owed to you',amount:split(totals.owed.totals)},{id:'owe',label:'You owe',amount:split(totals.owe.totals)}]}/>
    {current.rows.length?<>
      <p className="brief-breakdown-summary">{people===1?'1 person':`${people} people`}{first?` · next payment ${soft(first.next.split(' · ').at(-1)!)}`:''}</p>
      <div className="brief-breakdown-rows">{current.rows.map(r=><PersonRow key={r.id} name={r.name} href={r.href} tile={<RingAvatar name={r.name} fraction={r.fraction}/>} detail={<><span className={r.quiet?'kit-count-quiet':'kit-count'}>{r.count}</span>{r.next&&<> · {r.next}</>}</>} amount={<Amount text={money(r.leftMinor,r.currency)} currency={r.currency}/>} caption="left"/>)}</div>
    </>:<p className="brief-breakdown-summary">{side==='owed'?'Nobody owes you money on a shared agreement.':'You don’t owe anyone on a shared agreement.'}</p>}
    <p className="brief-breakdown-note">Shared agreements only. Private debts are in My debts.</p>
  </div>;
}

function Money({minor,currency}:{minor:string;currency:string}){
  const text=money(minor,currency),sign=currency==='NGN'?'₦':currency;
  return <p className="brief-panel-money"><span className="brief-panel-sign">{sign}</span><span className="brief-panel-amount">{text.slice(currency==='NGN'?1:currency.length+1)}</span></p>;
}

function BriefPanel({panel,demo,onClose}:{panel:Panel|null;demo:boolean;onClose:()=>void}){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function claim(id:string){setBusy(true);setError('');try{const r=await api<{agreementId:string}>(`${apiBase(demo)}/pending-invitations/${id}/claim`,{});router.push(`${appBase(demo)}/agreements/${r.agreementId}`);router.refresh();}catch(e){setError((e as Error).message);setBusy(false);}}
  return <Sheet.Root open={!!panel} onOpenChange={value=>{if(!value){onClose();setError('');setBusy(false);}}}>
    <Sheet.Portal><Sheet.Overlay className="brief-scrim"/>
      <Sheet.Content className="brief-panel" aria-describedby={undefined}>
        {panel&&<>
          <Sheet.Close className="brief-grabber" aria-label="Close"><span aria-hidden/></Sheet.Close>
          <div className="brief-panel-head">
            <p className="brief-panel-kicker">{panel.kicker}{panel.since?` · ${ago(panel.since)}`:''}</p>
            <Sheet.Title className="brief-panel-title"><Avatar name={panel.person}/><span>{panel.title}</span></Sheet.Title>
            {panel.amount&&<Money {...panel.amount}/>}
            {panel.tag&&<span className="brief-panel-tag">{panel.tag}</span>}
          </div>
          {panel.details.length>0&&<dl className="brief-panel-details">{panel.details.map(d=><div key={d.label}><dt>{d.label}</dt><dd>{d.value}</dd></div>)}</dl>}
          <ErrorMessage message={error}/>
          <div className="brief-panel-actions">
            {panel.primary.invitationId?<button type="button" className="brief-panel-button brief-panel-primary" disabled={busy} aria-busy={busy} onClick={()=>void claim(panel.primary.invitationId!)}>{panel.primary.label}</button>:<Link className="brief-panel-button brief-panel-primary" href={panel.primary.href!}>{panel.primary.label}</Link>}
            {panel.secondary&&<Link className="brief-panel-button brief-panel-secondary" href={panel.secondary.href}>{panel.secondary.label}</Link>}
          </div>
          {panel.note&&<p className="brief-panel-note">{panel.note}</p>}
        </>}
      </Sheet.Content>
    </Sheet.Portal>
  </Sheet.Root>;
}

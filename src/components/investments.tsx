'use client';
import {useRef,useState} from 'react';
import {Archive,ArchiveRestore,Banknote,CheckCircle2,Layers3,LockKeyhole,NotebookPen,Pencil,Plus,Search} from 'lucide-react';
import {currencies} from '@/lib/currencies';
import {calendarDate} from '@/lib/calendar';
import {groupMoneyInput,money,moneyInput,parseMoney} from '@/lib/money';
import {investmentTotal,investmentTotals,type Investment,type InvestmentContribution} from '@/modules/investments/model';
import {api,apiBase} from './client-api';
import {formatMoneyChange} from './money-input';
import {formatDate} from './agreement-utils';
import {Button,DisclosureSummary,ErrorMessage,Field,Modal} from './ui';

type Editor={kind:'create'}|{kind:'edit'|'contribute';record:Investment}|{kind:'edit-contribution';record:Investment;contribution:InvestmentContribution};
export function InvestmentTracker({initial,demo}:{initial:Investment[];demo:boolean}){
  const [records,setRecords]=useState(initial),[editor,setEditor]=useState<Editor|null>(null);
  const [name,setName]=useState(''),[currency,setCurrency]=useState('NGN'),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate()),[note,setNote]=useState('');
  const [filter,setFilter]=useState('Active'),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const request=useRef<{text:string;key:string}|null>(null);
  const totals=investmentTotals(records),visible=records.filter(record=>record.archived===(filter==='Archived')&&`${record.name} ${record.note} ${record.currency}`.toLowerCase().includes(search.trim().toLowerCase()));
  function keyFor(url:string,body:unknown){const text=JSON.stringify({url,body});if(request.current?.text!==text)request.current={text,key:crypto.randomUUID()};return request.current!.key;}
  function open(next:Editor){
    const record=next.kind==='create'?null:next.record,c=next.kind==='edit-contribution'?next.contribution:null;
    setName(record?.name??'');setCurrency(record?.currency??'NGN');setNote(next.kind==='edit'?next.record.note:c?.note??'');
    setAmount(c?groupMoneyInput(moneyInput(c.amountMinor)):'');setDate(c?.date??calendarDate());setError('');request.current=null;setEditor(next);
  }
  function replace(record:Investment){setRecords(current=>current.some(r=>r.id===record.id)?current.map(r=>r.id===record.id?record:r):[record,...current]);}
  async function save(){
    if(!editor||busy)return;setBusy(true);setError('');
    try{
      const url=`${apiBase(demo)}/investments${editor.kind==='create'?'':`/${editor.record.id}`}`;
      const body=editor.kind==='create'?{name,currency,amountMinor:parseMoney(amount),date,note}:editor.kind==='edit'?{action:'edit',name,currency,note,expectedRevision:editor.record.revision}:{action:editor.kind,amountMinor:parseMoney(amount),date,note,expectedRevision:editor.record.revision,...(editor.kind==='edit-contribution'?{contributionId:editor.contribution.id}:{})};
      const {investment}=await api<{investment:Investment}>(url,body,keyFor(url,body));replace(investment);setEditor(null);setNotice(editor.kind==='create'?'Investment saved.':editor.kind==='contribute'?'Contribution recorded.':'Changes saved.');
      if(editor.kind==='create'){setFilter('Active');setSearch('');}request.current=null;
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function archive(record:Investment){
    if(busy)return;setBusy(true);setError('');
    try{
      const url=`${apiBase(demo)}/investments/${record.id}`,body={action:'archive',archived:!record.archived,expectedRevision:record.revision};
      const {investment}=await api<{investment:Investment}>(url,body,keyFor(url,body));replace(investment);setNotice(record.archived?'Investment restored to Active.':'Investment moved to Archived. Its contributions are preserved.');request.current=null;
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function reload(){
    if(busy)return;setBusy(true);
    try{const data=await api<{investments:Investment[]}>(`${apiBase(demo)}/investments`);setRecords(data.investments);setEditor(null);setError('');setNotice('Latest records loaded. Open the entry again to edit it.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  const editingMetadata=editor?.kind==='edit',hasMultiple=editor&&editor.kind!=='create'&&editor.record.contributions.length>1;
  return <>
    <div className="page-heading"><div><h1>Where I’ve invested.</h1><p className="lede">Keep a private record of where you’ve put your money.</p></div><Button onClick={()=>open({kind:'create'})} disabled={busy}><Plus size={18} aria-hidden/>Add an investment</Button></div>
    <aside className="private-ledger-note" aria-label="Private investment records"><span className="private-ledger-icon" aria-hidden><LockKeyhole size={20}/></span><div><h2>Only visible to you</h2><p>Record what you’ve invested, in its original currency. These amounts show your contributions, not current value or returns.</p></div></aside>
    <div role="status">{notice&&<div className="success-notice"><CheckCircle2 size={18} aria-hidden/>{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}</div>
    {!editor&&<><ErrorMessage message={error}/>{error.includes('changed since')&&<Button variant="secondary" disabled={busy} onClick={()=>void reload()}>Load latest records</Button>}</>}
    {totals.length>0&&<section className="debt-summary" aria-label="Active investment totals by currency">{totals.map(total=><div key={total.currency}><span>Amount invested · {total.currency}</span><strong>{money(total.amountMinor,total.currency)}</strong><small>{records.filter(r=>!r.archived&&r.currency===total.currency).length} active {records.filter(r=>!r.archived&&r.currency===total.currency).length===1?'investment':'investments'}</small></div>)}</section>}
    {records.length>0&&<div className="investment-toolbar"><div className="filter-tabs" aria-label="Filter investments">{['Active','Archived'].map(item=><button key={item} aria-pressed={filter===item} className={filter===item?'active':''} onClick={()=>setFilter(item)}>{item}</button>)}</div><label className="search-field"><Search size={18} aria-hidden/><span className="sr-only">Search investments</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a name or currency"/></label></div>}
    {!records.length?<section className="empty-state"><span className="empty-icon"><Layers3 size={30} aria-hidden/></span><h3>A record of every investment.</h3><p>A business, property, fund or something else. Add a name, the amount, currency and date to start.</p><Button variant="secondary" onClick={()=>open({kind:'create'})}>Add your first investment <Plus size={16} aria-hidden/></Button></section>:!visible.length&&<section className="panel inline-empty"><Layers3 size={25} aria-hidden/><p>{search?'No investments match your search.':filter==='Archived'?'No archived investments.':'No active investments. Add one or restore an archived record.'}</p></section>}
    <div className="debt-grid investment-grid">{visible.map(record=>{
      const contributions=[...record.contributions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),latest=contributions[0];
      return <article className="panel investment-card" key={record.id} aria-label={record.name}>
        <div className="investment-card-heading"><span className="investment-symbol" aria-hidden><Layers3 size={22}/></span><div><p className="debt-record-meta">{record.currency}{record.archived?' · Archived':''}</p><h2>{record.name}</h2></div></div>
        <div className="investment-amount"><span>Amount invested</span><strong>{money(investmentTotal(record),record.currency)}</strong><small>Last contribution {formatDate(latest.date)}</small></div>
        {record.note&&<p className="debt-note">{record.note}</p>}
        <details className="debt-history"><DisclosureSummary>{record.contributions.length} {record.contributions.length===1?'contribution':'contributions'} recorded</DisclosureSummary><div>{contributions.map(c=><div className="investment-contribution" key={c.id}><div><span>{formatDate(c.date)}</span><strong>{money(c.amountMinor,record.currency)}</strong>{c.note&&<p>{c.note}</p>}{c.updatedAt&&<small>Edited {formatDate(c.updatedAt)}</small>}</div>{!record.archived&&<Button variant="ghost" disabled={busy} aria-label={`Edit contribution of ${money(c.amountMinor,record.currency)} on ${formatDate(c.date)} to ${record.name}`} onClick={()=>open({kind:'edit-contribution',record,contribution:c})}><Pencil size={16} aria-hidden/>Edit</Button>}</div>)}</div></details>
        <div className="investment-card-actions">{!record.archived&&<Button variant="secondary" disabled={busy} onClick={()=>open({kind:'contribute',record})}><Plus size={16} aria-hidden/>Record contribution</Button>}<Button variant="ghost" disabled={busy} aria-label={`Edit investment ${record.name}`} onClick={()=>open({kind:'edit',record})}><Pencil size={16} aria-hidden/>Edit</Button><Button variant="ghost" disabled={busy} aria-label={`${record.archived?'Restore':'Archive'} investment ${record.name}`} onClick={()=>void archive(record)}>{record.archived?<ArchiveRestore size={16} aria-hidden/>:<Archive size={16} aria-hidden/>}{record.archived?'Restore':'Archive'}</Button></div>
      </article>;
    })}</div>
    <p className="quiet-note debt-footnote">Totals include active records only. Each currency stays separate.</p>
    <Modal open={!!editor} onOpenChange={value=>{if(!busy&&!value){setEditor(null);setError('');}}} title={editor?.kind==='create'?'Add an investment':editingMetadata?'Edit investment':editor?.kind==='contribute'?'Record a contribution':'Edit contribution'} description={editor?.kind==='create'?'Record money you’ve already invested outside treeti.':editingMetadata?'Correct the name, currency or note for this personal record.':editor&&'record' in editor?`Record your contribution to ${editor.record.name} in ${editor.record.currency}.`:undefined}>
      {editor&&<form className="dialog-form" onSubmit={e=>{e.preventDefault();void save();}}>
        {(editor.kind==='create'||editingMetadata)&&<Field label="Investment name or place" icon={Layers3}><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. My business or a property" required minLength={2} maxLength={120}/></Field>}
        {(editor.kind==='create'||editingMetadata)&&<Field label="Currency" hint={hasMultiple?'Currency is fixed because additional contributions have been recorded.':undefined}><select value={currency} disabled={!!hasMultiple} onChange={e=>setCurrency(e.target.value)}>{currencies.map(c=><option key={c}>{c}</option>)}</select></Field>}
        {!editingMetadata&&<><Field label={`Amount invested (${currency})`} icon={Banknote} hint="Up to two decimal places."><input value={amount} onChange={e=>{formatMoneyChange(e);setAmount(e.target.value);}} required inputMode="decimal" placeholder="e.g. 50,000.00" maxLength={20}/></Field><Field label="Investment date"><input type="date" required max={calendarDate()} value={date} onChange={e=>setDate(e.target.value)}/></Field></>}
        <Field label="Note (optional)" icon={NotebookPen}><textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} maxLength={2000} placeholder="A little context for your record"/></Field>
        <ErrorMessage message={error}/>{error.includes('changed since')&&<Button type="button" variant="secondary" disabled={busy} onClick={()=>void reload()}>Load latest records</Button>}
        <div className="dialog-actions"><Button type="button" variant="ghost" disabled={busy} onClick={()=>{setEditor(null);setError('');}}>Cancel</Button><Button type="submit" busy={busy}>{editor.kind==='create'?'Save investment':editor.kind==='contribute'?'Save contribution':'Save changes'}</Button></div>
      </form>}
    </Modal>
  </>;
}

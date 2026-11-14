'use client';
import {useEffect,useRef,useState} from 'react';
import {Archive,ArchiveRestore,Banknote,CheckCircle2,Layers3,LockKeyhole,NotebookPen,Pencil,Plus,Search,Sprout} from '@/components/icons';
import {Amount,Chips,Panel} from './kit';
import {currencies} from '@/lib/currencies';
import {calendarDate} from '@/lib/calendar';
import {groupMoneyInput,money,moneyInput,parseMoney} from '@/lib/money';
import {investmentTotal,investmentTotals,type Investment,type InvestmentContribution} from '@/modules/investments/model';
import {api,apiBase} from './client-api';
import {formatMoneyChange} from './money-input';
import {formatDate} from './agreement-utils';
import {Button,ErrorMessage,Field,Modal} from './ui';

type Editor={kind:'create'}|{kind:'edit'|'contribute';record:Investment}|{kind:'edit-contribution';record:Investment;contribution:InvestmentContribution};
export function InvestmentTracker({initial,demo}:{initial:Investment[];demo:boolean}){
  const [records,setRecords]=useState(initial),[editor,setEditor]=useState<Editor|null>(null);
  const [name,setName]=useState(''),[currency,setCurrency]=useState('NGN'),[amount,setAmount]=useState(''),[date,setDate]=useState(calendarDate()),[note,setNote]=useState('');
  const [filter,setFilter]=useState<'Active'|'Archived'>('Active'),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const request=useRef<{text:string;key:string}|null>(null);
  const totals=investmentTotals(records),visible=records.filter(record=>record.archived===(filter==='Archived')&&`${record.name} ${record.note} ${record.currency}`.toLowerCase().includes(search.trim().toLowerCase()));
  // "New" → "An investment" lands here with ?new=1: open the form once, then tidy the address.
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('new')!=='1')return;window.history.replaceState(null,'',window.location.pathname);open({kind:'create'});
   
  },[]);
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
  const [detailFor,setDetailFor]=useState<string|null>(null),detail=records.find(r=>r.id===detailFor);
  const active=records.filter(r=>!r.archived),main=totals.find(t=>t.currency==='NGN')??totals[0],others=totals.filter(t=>t!==main);
  const mainCount=main?active.filter(r=>r.currency===main.currency).length:0;
  return <div className="ledger">
    <header className="ledger-head">
      <h1>My investments</h1>
      <p className="ledger-private"><LockKeyhole size={14} aria-hidden/>Only you can see these</p>
      {totals.length>0&&<section className="ledger-total" aria-label="Active investment totals by currency">
        <p className="ledger-amount"><Amount text={money(main.amountMinor,main.currency)} currency={main.currency}/></p>
        <p className="ledger-caption">put in {mainCount===1?'one investment':`across ${mainCount} investments`}{others.length>0&&<> · plus {others.map(t=>money(t.amountMinor,t.currency)).join(' and ')}</>}</p>
      </section>}
      {totals.length>0&&<p className="ledger-next">What you’ve put in, not what it’s worth today.</p>}
    </header>
    <div role="status">{notice&&<div className="success-notice"><CheckCircle2 size={18} aria-hidden/>{notice}<button onClick={()=>setNotice('')}>Dismiss</button></div>}</div>
    {!editor&&<><ErrorMessage message={error}/>{error.includes('changed since')&&<Button variant="secondary" disabled={busy} onClick={()=>void reload()}>Load latest records</Button>}</>}
    {records.length>0&&<div className="agreements-tools ledger-tools"><Chips label="Filter investments" value={filter as 'Active'|'Archived'} onChange={setFilter} options={[{id:'Active',label:'Active'},{id:'Archived',label:'Archived'}]}/><label className="agreements-search"><Search size={18} aria-hidden/><span className="sr-only">Search investments</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a name or currency"/></label></div>}
    {!records.length?<section className="agreements-empty"><span className="agreements-empty-icon" aria-hidden><Sprout size={28}/></span><h2>Keep track of what you’ve put in</h2><p>A business, a co-op, gold or something else. Add a name, the amount and the date to start.</p><div className="agreements-empty-actions"><button type="button" className="button button-primary" onClick={()=>open({kind:'create'})}>Add an investment</button></div></section>
     :!visible.length?<section className="agreements-empty"><p>{search?'No investments match your search.':filter==='Archived'?'No archived investments.':'No active investments. Add one or restore an archived record.'}</p></section>
     :<section className="agreements-group ledger-group" aria-labelledby="ledger-mine"><h2 className="kit-overline agreements-group-title" id="ledger-mine">{filter==='Archived'?'Archived':'Just mine'} · {visible.length}</h2>
      <ul>{visible.map(record=>{const latest=[...record.contributions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))[0],count=record.contributions.length;
        return <li key={record.id}><article className="ledger-row" aria-label={record.name}><button type="button" className="agreement-row ledger-row-button" aria-haspopup="dialog" onClick={()=>setDetailFor(record.id)}>
          <span className="agreement-row-avatar"><span className="ledger-tile" aria-hidden><Sprout size={18}/></span></span>
          <span className="agreement-row-person"><span className="agreement-row-name">{record.name}</span></span>
          <span className="agreement-row-progress"><span className="agreement-row-meta">Last added {money(latest.amountMinor,record.currency)} · {formatDate(latest.date).replace(/ \d{4}$/,'')}</span></span>
          <span className="agreement-row-left"><span className="agreement-row-amount"><Amount text={money(investmentTotal(record),record.currency)} currency={record.currency}/></span><span className="agreement-row-caption">{count===1?'once':`${count} times`}</span></span>
        </button></article></li>;})}</ul>
     </section>}
    {records.length>0&&<div className="ledger-dock">
      {active.length>0&&<button type="button" className="brief-cta" onClick={()=>open({kind:'contribute',record:active[0]})}>Add money</button>}
      <button type="button" className="button sign-tertiary ledger-add" disabled={busy} onClick={()=>open({kind:'create'})}><Plus size={16} aria-hidden/>Add an investment</button>
    </div>}
    <p className="quiet-note debt-footnote">Totals include active records only. Each currency stays separate.</p>

    <Panel open={!!detail} onOpenChange={o=>{if(!o)setDetailFor(null);}} title={detail?.name??'Investment'} description={detail?`${detail.currency}${detail.archived?' · Archived':''} · ${money(investmentTotal(detail),detail.currency)} put in`:undefined}>
      {detail&&<div className="ledger-detail">
        {detail.note&&<p className="debt-note">{detail.note}</p>}
        <div className="ledger-contributions"><h3 className="kit-overline">Each time you added money</h3>{[...detail.contributions].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)).map(c=><div className="investment-contribution" key={c.id}><div><span>{formatDate(c.date)}</span><strong>{money(c.amountMinor,detail.currency)}</strong>{c.note&&<p>{c.note}</p>}{c.updatedAt&&<small>Edited {formatDate(c.updatedAt)}</small>}</div>{!detail.archived&&<Button variant="ghost" disabled={busy} aria-label={`Edit contribution of ${money(c.amountMinor,detail.currency)} on ${formatDate(c.date)} to ${detail.name}`} onClick={()=>{setDetailFor(null);open({kind:'edit-contribution',record:detail,contribution:c});}}><Pencil size={16} aria-hidden/>Edit</Button>}</div>)}</div>
        <div className="ledger-detail-actions">
          {!detail.archived&&<button type="button" className="button button-primary sign-primary" disabled={busy} onClick={()=>{setDetailFor(null);open({kind:'contribute',record:detail});}}>Record contribution</button>}
          <div className="ledger-detail-row"><button type="button" className="button sign-secondary" disabled={busy} aria-label={`Edit investment ${detail.name}`} onClick={()=>{setDetailFor(null);open({kind:'edit',record:detail});}}><Pencil size={16} aria-hidden/>Edit</button><button type="button" className="button sign-secondary" disabled={busy} aria-label={`${detail.archived?'Restore':'Archive'} investment ${detail.name}`} onClick={()=>{setDetailFor(null);void archive(detail);}}>{detail.archived?<ArchiveRestore size={16} aria-hidden/>:<Archive size={16} aria-hidden/>}{detail.archived?'Restore':'Archive'}</button></div>
        </div>
      </div>}
    </Panel>
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
  </div>;
}

'use client';
import {useRef,useState} from 'react';
import {Bell,CalendarPlus} from '@/components/icons';
import type {PersonalDebt} from '@/modules/debts/model';
import {reminderLabel} from '@/modules/debts/reminders';
import {api,apiBase} from './client-api';
import {ErrorMessage} from './ui';
import {Blank,Panel} from './kit';
import {DatePanel,Flow,W} from './record-blanks';
import {firstName} from './person-colour';

function tomorrow(){const date=new Date();date.setDate(date.getDate()+1);date.setHours(9,0,0,0);return localDateTime(date);}
function localDateTime(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;}
/** "Remind me about Maryam on Sat 15 Nov at 09:00." Private to the owner; nobody else is told. */
export function DebtReminderForm({debt,demo,emailAvailable,onSave,onClose}:{debt:PersonalDebt;demo:boolean;emailAvailable:boolean;onSave:(debt:PersonalDebt)=>void;onClose:()=>void}){
  const start=debt.reminder?localDateTime(new Date(debt.reminder.remindAt)):tomorrow();
  const [day,setDay]=useState(start.slice(0,10)),[time,setTime]=useState(start.slice(11,16)),[email,setEmail]=useState(debt.reminder?.email??false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[sheet,setSheet]=useState<'day'|'time'|null>(null);
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone,request=useRef<{text:string;key:string}|null>(null);
  const when=new Date(`${day}T${time}`),valid=!Number.isNaN(when.getTime());
  const dayText=valid?new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(when):'a day',timeText=valid?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(when):'a time';
  async function save(cancel=false){if(busy)return;setBusy(true);setError('');try{
    if(!cancel&&!valid)throw new Error('Choose a valid reminder date and time.');
    const body=cancel?{cancel:true}:{remindAt:when.toISOString(),timeZone:zone,email};
    const text=JSON.stringify(body);if(request.current?.text!==text)request.current={text,key:crypto.randomUUID()};
    const result=await api<{debt:PersonalDebt}>(`${apiBase(demo)}/debts/${debt.id}/reminder`,body,request.current!.key);onSave(result.debt);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Flow open onOpenChange={value=>{if(!value&&!busy)onClose();}} kicker={debt.reminder?'Change your reminder':'Reminder'} title={debt.reminder?'Change your reminder':'A little reminder, for you'} sub={`A moment to review what you owe ${firstName(debt.person)}. Only you get it.`} panels={<>
    <DatePanel open={sheet==='day'} onOpenChange={o=>setSheet(o?'day':null)} title="Which day?" label="Reminder date" value={day} onChange={setDay} future/>
    <Panel open={sheet==='time'} onOpenChange={o=>setSheet(o?'time':null)} title="What time?" description={`Your device time zone: ${zone}.`}>
      <form className="ask-form" onSubmit={e=>{e.preventDefault();setSheet(null);}}>
        <label className="create-field"><span className="create-field-label">Reminder time</span><input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
        <button type="submit" className="button button-primary sign-primary">Done</button>
      </form>
    </Panel>
  </>}>
    <p className="create-sentence"><W>Remind me about</W> <Blank state="filled" label={`About ${debt.person}`}>{firstName(debt.person)}</Blank> <W>on</W> <Blank state={sheet==='day'?'current':'filled'} label={`On ${dayText}. Change`} onClick={()=>setSheet('day')}>{dayText}</Blank> <W>at</W> <span className="create-nowrap"><Blank state={sheet==='time'?'current':'filled'} label={`At ${timeText}. Change`} onClick={()=>setSheet('time')}>{timeText}</Blank><W>.</W></span></p>
    <p className="record-explain"><Bell size={14} aria-hidden/> You’ll see it in My debts when you open treeti. After saving, add it to your calendar for an alert while treeti is closed.</p>
    {debt.reminder&&<p className="record-explain">If you added this reminder to a calendar, update that event there too.</p>}
    {emailAvailable&&<label className="checkbox-field"><input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)}/>Also email my verified address</label>}
    <ErrorMessage message={error}/>
    <div className="sign-actions"><button type="button" className="button button-primary sign-primary" disabled={busy||!valid} aria-busy={busy} onClick={()=>void save()}>Save reminder</button>{debt.reminder&&<button type="button" className="button sign-tertiary" disabled={busy} onClick={()=>void save(true)}>Remove reminder</button>}</div>
  </Flow>;
}
export function ReminderOnCard({debt,demo,now,onEdit}:{debt:PersonalDebt;demo:boolean;now:number;onEdit:()=>void}){
  if(!debt.reminder)return null;
  const due=Date.parse(debt.reminder.remindAt)<=now;
  return <div className={`debt-reminder${due?' is-due':''}`}><Bell size={20} aria-hidden/><div><strong>{due?'A moment to review':'Your next reminder'}</strong><span>{reminderLabel(debt.reminder)}</span>{debt.reminder.email&&<small>{debt.reminder.emailFailed?'Email could not be delivered. Add a calendar alert or reschedule.':debt.reminder.emailSentAt?'Email reminder sent':'Email reminder scheduled'}</small>}<div className="share-row"><button className="text-link" onClick={onEdit}>Change reminder</button><a className="text-link" href={`${apiBase(demo)}/debts/${debt.id}/reminder/calendar`} download="ahd-reminder.ics"><CalendarPlus size={16} aria-hidden/>Add to calendar</a></div></div></div>;
}

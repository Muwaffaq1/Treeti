'use client';
import {useRef,useState} from 'react';
import {Bell,CalendarPlus} from 'lucide-react';
import type {PersonalDebt} from '@/modules/debts/model';
import {reminderLabel} from '@/modules/debts/reminders';
import {api,apiBase} from './client-api';
import {Button,ErrorMessage,Field,Modal} from './ui';

function tomorrow(){const date=new Date();date.setDate(date.getDate()+1);date.setHours(9,0,0,0);return localDateTime(date);}
function localDateTime(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;}
export function DebtReminderForm({debt,demo,emailAvailable,onSave,onClose}:{debt:PersonalDebt;demo:boolean;emailAvailable:boolean;onSave:(debt:PersonalDebt)=>void;onClose:()=>void}){
  const [date,setDate]=useState(()=>debt.reminder?localDateTime(new Date(debt.reminder.remindAt)):tomorrow()),[email,setEmail]=useState(debt.reminder?.email??false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone,request=useRef<{text:string;key:string}|null>(null);
  async function save(cancel=false){if(busy)return;setBusy(true);setError('');try{
    const time=new Date(date);if(!cancel&&Number.isNaN(time.getTime()))throw new Error('Choose a valid reminder date and time.');
    const body=cancel?{cancel:true}:{remindAt:time.toISOString(),timeZone:zone,email};
    const text=JSON.stringify(body);if(request.current?.text!==text)request.current={text,key:crypto.randomUUID()};
    const result=await api<{debt:PersonalDebt}>(`${apiBase(demo)}/debts/${debt.id}/reminder`,body,request.current!.key);onSave(result.debt);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Modal open onOpenChange={value=>{if(!value&&!busy)onClose();}} title={debt.reminder?'Change your reminder':'A little reminder, for you'} description={`Set aside a moment to review what you owe ${debt.person}. Only you receive this reminder.`}>
    <form className="dialog-form" onSubmit={e=>{e.preventDefault();void save();}}>
      <Field label="Remind me on" hint={`Your device time zone: ${zone}.`}><input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} required/></Field>
      <div className="callout"><Bell size={20} aria-hidden/><p>You’ll see the reminder in My debts when you open treeti. After saving, add it to your calendar for an alert while treeti is closed.</p></div>
      {debt.reminder&&<p className="quiet-note">If you added this reminder to a calendar, update that event there too.</p>}
      {emailAvailable&&<label className="checkbox-field"><input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)}/>Also email my verified address</label>}
      <ErrorMessage message={error}/><div className="dialog-actions">{debt.reminder?<Button type="button" variant="ghost" disabled={busy} onClick={()=>void save(true)}>Remove reminder</Button>:<Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>}<Button busy={busy} type="submit"><Bell size={18} aria-hidden/>Save reminder</Button></div>
    </form>
  </Modal>;
}
export function ReminderOnCard({debt,demo,now,onEdit}:{debt:PersonalDebt;demo:boolean;now:number;onEdit:()=>void}){
  if(!debt.reminder)return null;
  const due=Date.parse(debt.reminder.remindAt)<=now;
  return <div className={`debt-reminder${due?' is-due':''}`}><Bell size={20} aria-hidden/><div><strong>{due?'A moment to review':'Your next reminder'}</strong><span>{reminderLabel(debt.reminder)}</span>{debt.reminder.email&&<small>{debt.reminder.emailFailed?'Email could not be delivered. Add a calendar alert or reschedule.':debt.reminder.emailSentAt?'Email reminder sent':'Email reminder scheduled'}</small>}<div className="share-row"><button className="text-link" onClick={onEdit}>Change reminder</button><a className="text-link" href={`${apiBase(demo)}/debts/${debt.id}/reminder/calendar`} download="ahd-reminder.ics"><CalendarPlus size={16} aria-hidden/>Add to calendar</a></div></div></div>;
}

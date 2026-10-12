import {z} from 'zod';
import {DomainError} from '@/lib/domain-error';
import {debtRemaining,type PersonalDebt} from './model';

export type DebtReminder={id:string;remindAt:string;timeZone:string;email:boolean;emailSentAt?:string|null;emailFailed?:boolean};
const zone=z.string().max(80).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}},'Choose a supported time zone.');
export const reminderInput=z.union([
  z.object({cancel:z.literal(true)}).strict(),
  z.object({remindAt:z.iso.datetime({offset:true}),timeZone:zone,email:z.boolean().default(false)}).strict(),
]);
export function makeReminder(debt:PersonalDebt,input:unknown,id:string,now:string):DebtReminder|null{
  const data=reminderInput.parse(input);
  if('cancel' in data)return null;
  if(debtRemaining(debt)==='0')throw new DomainError('DEBT_PAID','This debt is already paid back. A reminder is no longer needed.',422);
  const when=Date.parse(data.remindAt),current=Date.parse(now);
  if(when<=current)throw new DomainError('REMINDER_PAST','Choose a reminder time in the future.',422);
  if(when>current+5*366*86400000)throw new DomainError('REMINDER_TOO_FAR','Choose a reminder within the next five years.',422);
  return {id,remindAt:new Date(when).toISOString(),timeZone:data.timeZone,email:data.email,emailSentAt:null};
}
export function reminderLabel(reminder:DebtReminder){return new Intl.DateTimeFormat('en-GB',{timeZone:reminder.timeZone,day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(reminder.remindAt));}

function stamp(value:string){return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');}
export function reminderCalendar(reminder:DebtReminder,now=new Date().toISOString()){
  // Use generic calendar text so financial details do not appear on a lock screen.
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//treeti//Private reminders//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${reminder.id}@ahd`, `DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(reminder.remindAt)}`,`DTEND:${stamp(new Date(Date.parse(reminder.remindAt)+15*60000).toISOString())}`,'SUMMARY:Review your private treeti record','DESCRIPTION:Take a moment to review your repayment plans in treeti.','BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0S','DESCRIPTION:Review your private treeti record','END:VALARM','END:VEVENT','END:VCALENDAR',''].join('\r\n');
}

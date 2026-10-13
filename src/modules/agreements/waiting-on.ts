import type {Aggregate,Participant} from './types';
import {needsInvitationResponse} from './invitation-resend';

export type Waiting={person:Participant;ask:string};
/**
 * The people this party is waiting on, each with the one step they owe. Only people who already
 * opened the agreement are listed: someone who has not is reached with their invitation link.
 */
export function waitingOn(a:Aggregate,me:Participant):Waiting[]{
  if(me.role==='WITNESS'||['DRAFT','CANCELLED','DECLINED','SETTLED'].includes(a.status))return [];
  const found=new Map<string,Waiting>(),add=(person:Participant|undefined,ask:string)=>{if(person&&person.userId&&person.id!==me.id&&!found.has(person.id))found.set(person.id,{person,ask});};
  for(const person of a.participants)if(needsInvitationResponse(a,person))add(person,person.role==='WITNESS'?'read the terms and confirm as a witness':'review and approve the terms');
  const other=a.participants.find(p=>p.role!=='WITNESS'&&p.id!==me.id);
  if(a.repayments.some(r=>r.status==='PROPOSED'&&r.participantId===me.id))add(other,'confirm the repayment I recorded');
  if(me.role==='LENDER'&&a.adjustments.some(x=>!a.adjustmentConfirmations.some(c=>c.adjustmentId===x.id)))add(other,'review the forgiveness I offered');
  if(a.status==='SETTLEMENT_PENDING'&&a.settlements.some(s=>s.participantId===me.id)&&!a.settlements.some(s=>s.participantId===other?.id))add(other,'acknowledge that the agreement is settled');
  return [...found.values()];
}
/** A ready-to-send WhatsApp message asking that person to take their step. */
export function reminderMessage(waiting:Waiting,link:string){return `Hi ${waiting.person.name.split(' ')[0]}, please ${waiting.ask} on treeti: ${link}`;}

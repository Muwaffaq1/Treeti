import type {Aggregate,Participant} from './types';

export function needsInvitationResponse(a:Aggregate,recipient:Participant):boolean {
  if(a.finalizedAt)return false;
  if(recipient.role==='WITNESS')return a.status==='AWAITING_WITNESSES'&&recipient.versionIds.includes(a.currentVersionId)&&!a.attestations.some(w=>w.participantId===recipient.id&&w.versionId===a.currentVersionId)&&!a.events.some(e=>e.type==='WITNESS_DECLINED'&&e.actorId===recipient.id&&e.versionId===a.currentVersionId);
  const version=a.versions.find(v=>v.id===a.currentVersionId);
  return ['AWAITING_BORROWER','AWAITING_APPROVAL'].includes(a.status)&&!!version&&!a.approvals.some(p=>p.participantId===recipient.id&&p.versionId===version.id&&p.versionHash===version.hash&&p.action==='ACCEPTED');
}
export function canResendInvitation(a:Aggregate,sender:Participant,recipient:Participant):boolean {
  return sender.role!=='WITNESS'&&sender.id!==recipient.id&&needsInvitationResponse(a,recipient);
}

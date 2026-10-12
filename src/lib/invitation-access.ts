import {sha256} from './crypto';
import {DomainError,latest} from '@/modules/agreements/domain';
import {usesDigitalWitnesses} from '@/modules/agreements/witness-policy';
import type {Aggregate} from '@/modules/agreements/types';

export function activeInvitation(a:Aggregate|null,token:string,now=new Date().toISOString()) {
  const invitation=a?.invitations.find(i=>i.tokenHash===sha256(token));
  if(!a||!invitation||!['PENDING','CLAIMED'].includes(invitation.status)||invitation.expiresAt<=now||invitation.versionId!==a.currentVersionId||['CANCELLED','DECLINED'].includes(a.status))throw new DomainError('INVITATION_EXPIRED','This invitation is no longer active. Ask the inviter for a new link.',410);
  const participant=a.participants.find(p=>p.id===invitation.participantId);
  if(!participant)throw new DomainError('INVITATION_EXPIRED','This invitation is no longer active.',410);
  return {agreement:a,invitation,participant};
}

export function witnessInvitation(a:Aggregate|null,token:string,now=new Date().toISOString()) {
  const result=activeInvitation(a,token,now),{agreement,invitation,participant}=result;
  if(participant.role!=='WITNESS'||agreement.status!=='AWAITING_WITNESSES'||!usesDigitalWitnesses(latest(agreement))||agreement.attestations.some(w=>w.participantId===participant.id&&w.versionId===invitation.versionId))throw new DomainError('WITNESS_RESPONSE_UNAVAILABLE','This invitation does not need a new witness response.',409);
  return result;
}

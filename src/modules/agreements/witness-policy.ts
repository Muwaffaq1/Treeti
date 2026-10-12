import {money} from '@/lib/money';
import type {Attestation, Participant, Version} from './types';

export const digitalWitnessPolicy = 'DIGITAL_ACKNOWLEDGEMENT_V1';
export const legacyWitnessText = {
  FORMATION: 'I personally witnessed the parties form this agreement.',
  EXISTING_DEBT_ACKNOWLEDGEMENT: 'I personally witnessed the borrower acknowledge the existing debt described in this agreement.',
  REVIEW_ONLY: 'I reviewed this record. I am not attesting that I witnessed formation or acknowledgment of the debt.',
};
export function usesDigitalWitnesses(version:Version) {
  return ['ahd-terms-v2','ahd-terms-v3','treeti-terms-v4'].includes(String(version.payload.schema)) && version.payload.witnessPolicy === digitalWitnessPolicy;
}
export function digitalWitnessStatement(version:Version) {
  const lender = version.payload.lender as {name:string}, borrower = version.payload.borrower as {name:string};
  return `I have read the terms of version ${version.number}. I understand that ${lender.name} is lending ${money(version.terms.principalMinor,version.terms.currency)} (${version.terms.currency}) to ${borrower.name}, and I agree to act as a witness to this agreement. I am not guaranteeing repayment.`;
}
export function satisfiesWitnessPolicy(version:Version, response:Attestation) {
  if(response.versionId !== version.id || response.versionHash !== version.hash) return false;
  if(usesDigitalWitnesses(version)) return response.type === 'DIGITAL_ACKNOWLEDGEMENT' && response.presence === 'DOCUMENT_REVIEW' && response.textVersion === digitalWitnessPolicy && response.text === digitalWitnessStatement(version);
  // Unknown future policies must not inherit the legacy formation rules.
  if(version.payload.schema !== 'ahd-terms-v1' || version.payload.witnessPolicy) return false;
  return (response.type === 'FORMATION' && ['IN_PERSON','LIVE_REMOTE'].includes(response.presence) || response.type === 'EXISTING_DEBT_ACKNOWLEDGEMENT' && ['IN_PERSON','LIVE_REMOTE','LATER_ACKNOWLEDGEMENT'].includes(response.presence)) && response.textVersion === `${response.type}_V1` && response.text === legacyWitnessText[response.type as keyof typeof legacyWitnessText];
}
export function qualifyingWitnesses(version:Version, responses:Attestation[], participants:Participant[]) {
  const seen = new Set<string>();
  return responses.filter(response=>{
    const participant = participants.find(p=>p.id===response.participantId && p.role==='WITNESS' && p.versionIds.includes(version.id));
    if(!participant || !satisfiesWitnessPolicy(version,response) || seen.has(participant.id)) return false;
    seen.add(participant.id);
    return true;
  });
}

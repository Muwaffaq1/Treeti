import { randomUUID } from 'node:crypto';
import { digest, invitationToken, sha256 } from '@/lib/crypto';
import {canResendInvitation} from './invitation-resend';
import {calendarDate} from '@/lib/calendar';
import { money } from '@/lib/money';
import {repaymentWording} from './repayment-plan';
import { createSchema, commandSchema } from './schema';
import {digitalWitnessPolicy, digitalWitnessStatement, legacyWitnessText, qualifyingWitnesses, satisfiesWitnessPolicy, usesDigitalWitnesses} from './witness-policy';
import type { Aggregate, Actor, Command, Context, Event, Participant, Terms, Version, WitnessType, Presence } from './types';

import {DomainError} from '@/lib/domain-error';
export {DomainError} from '@/lib/domain-error';
function requireThat(test: unknown, code: string, message: string, status = 409): asserts test {
  if (!test) throw new DomainError(code, message, status);
}
export const latest = (a: Aggregate) => a.versions.find(v => v.id === a.currentVersionId)!;
export const member = (a: Aggregate, actor: Actor) => a.participants.find(p => p.userId === actor.userId);
export const affirmation = (role: string) => role === 'BORROWER' ? 'I acknowledge that I have reviewed this agreement and that these terms accurately represent the obligation I am agreeing to. I confirm this loan is interest-free: I will repay only the amount I borrowed, with no interest, fees, penalties or other extra charges.' : 'I have reviewed this agreement and agree to these terms. I confirm this loan is interest-free: I will ask for back only the amount I lent, with no interest, fees, penalties or other extra charges.';
export const witnessText = legacyWitnessText;
export const attestationLabels: Record<WitnessType, string> = { FORMATION: 'Agreement formation', EXISTING_DEBT_ACKNOWLEDGEMENT: 'Existing debt acknowledgment', REVIEW_ONLY: 'Record review only', DIGITAL_ACKNOWLEDGEMENT: 'Digital witness acknowledgment' };
export const statusLabels: Record<string, string> = { DRAFT: 'Draft', AWAITING_BORROWER: 'Awaiting borrower', CHANGES_REQUESTED: 'Changes requested', AWAITING_APPROVAL: 'Awaiting approval', AWAITING_WITNESSES: 'Awaiting witnesses', ACTIVE: 'Active', SETTLEMENT_PENDING: 'Ready for settlement', SETTLED: 'Settled', DECLINED: 'Declined', CANCELLED: 'Cancelled' };

export function makeVersion(a: Pick<Aggregate, 'id' | 'publicId' | 'participants' | 'versions'>, terms: Terms, reason: string, ctx: Context): Version {
  const lender = a.participants.find(p => p.role === 'LENDER')!, borrower = a.participants.find(p => p.role === 'BORROWER')!;
  const text = `${lender.name} proposes an interest-free loan to ${borrower.name} of ${money(terms.principalMinor,terms.currency)} (${terms.currency}). Contractual interest is ${money('0',terms.currency)} (0%). ${repaymentWording(terms)} Agreement date: ${terms.agreementDate}.${terms.purpose ? ` Purpose: ${terms.purpose}.` : ''}${terms.additionalTerms ? ` Additional agreed terms: ${terms.additionalTerms}` : ''} Requested witnesses: ${terms.requiredWitnesses}. Each witness reads these terms, confirms who is lending to whom, and agrees to act as a witness to this agreement. This digital acknowledgment does not claim physical presence or confirm that money changed hands. A witness does not guarantee repayment. Repayments occur outside treeti and affect the recorded balance only when confirmed by both parties.`;
  const number = a.versions.length + 1;
  const payload = { schema: terms.currency!=='NGN'?'treeti-terms-v4':terms.repaymentType==='INSTALLMENTS'?'ahd-terms-v3':'ahd-terms-v2', witnessPolicy: digitalWitnessPolicy, agreementId: a.id, publicId: a.publicId, version: number, terms, lender: { participantId: lender.id, name: lender.name, contact: lender.contact }, borrower: { participantId: borrower.id, name: borrower.name, contact: borrower.contact }, humanReadableText: text };
  return { id: randomUUID(), number, terms, text, payload, hash: digest(payload), previousId: a.versions.at(-1)?.id ?? null, reason, createdBy: ctx.actor.userId, createdAt: ctx.now };
}
export function appendEvent(a: Aggregate, type: string, actorId: string, payload: Record<string, unknown>, now: string) {
  const data = { id: randomUUID(), sequence: a.events.length + 1, type, actorId, versionId: a.currentVersionId, payload, previousHash: a.events.at(-1)?.hash ?? null, createdAt: now };
  a.events.push({ ...data, hash: digest(data) });
  a.outbox.push({ id: randomUUID(), eventType: type, participantId: null, destination: null, payload: { agreementId: a.id, eventId: data.id }, createdAt: now });
}
export function verifyEvents(events: Event[]) {
  return events.every((e, i) => { const { hash, ...data } = e; return e.sequence === i + 1 && e.previousHash === (events[i - 1]?.hash ?? null) && digest(data) === hash; });
}
export function balance(a: Aggregate): string {
  const principal = BigInt(a.manifest?.version.terms.principalMinor ?? latest(a).terms.principalMinor);
  const paid = a.repayments.filter(r => r.status === 'CONFIRMED').reduce((sum, r) => sum + BigInt(r.amountMinor), 0n);
  const forgiven = a.adjustments.filter(r => a.adjustmentConfirmations.some(c => c.adjustmentId === r.id)).reduce((sum, r) => sum + BigInt(r.amountMinor), 0n);
  return (principal - paid - forgiven).toString();
}
export function createAgreement(input: unknown, ctx: Context, publicId: string): Aggregate {
  const data = createSchema.parse(input);
  requireThat(!ctx.actor.contacts.includes(data.borrowerContact), 'SAME_PARTY', 'Choose a borrower other than yourself.', 422);
  const a: Aggregate = { id: randomUUID(), publicId, createdBy: ctx.actor.userId, currentVersionId: '', status: 'DRAFT', balanceMinor: data.terms.principalMinor, createdAt: ctx.now, finalizedAt: null, settledAt: null, participants: [
    { id: randomUUID(), userId: ctx.actor.userId, role: 'LENDER', name: ctx.actor.name, contact: ctx.actor.contacts[0], versionIds: [] },
    { id: randomUUID(), userId: null, role: 'BORROWER', name: data.borrowerName, contact: data.borrowerContact, versionIds: [] },
  ], versions: [], approvals: [], attestations: [], events: [], invitations: [], repayments: [], repaymentConfirmations: [], adjustments: [], adjustmentConfirmations: [], settlements: [], manifest: null, outbox: [] };
  const v = makeVersion(a, data.terms, 'Initial proposal', ctx); a.versions.push(v); a.currentVersionId = v.id;
  appendEvent(a, 'AGREEMENT_CREATED', a.participants[0].id, {}, ctx.now); return a;
}
export function isApproved(a: Aggregate, role: string) {
  const v = latest(a); return a.approvals.some(p => p.role === role && p.versionId === v.id && p.versionHash === v.hash && p.action === 'ACCEPTED');
}
export function validWitnesses(a: Aggregate) {
  return qualifyingWitnesses(latest(a), a.attestations, a.participants);
}
// Reserved for separately reviewed elevated-risk actions; routine records use the verified session.
export const sensitiveActions = new Set<string>();
export function checkStepUp(ctx: Context, a: Aggregate, command: Command) {
  const s = ctx.stepUp;
  requireThat(s && s.agreementId === a.id && s.versionId === command.expectedVersionId && s.action === command.action && s.expiresAt > ctx.now && ctx.actor.contacts.includes(s.contact), 'SIGNATURE_VERIFICATION_REQUIRED', 'Verify this action with a fresh code, then confirm again.', 403);
}
function sessionEvidence(ctx: Context) {
  const contact = ctx.actor.contacts[0];
  requireThat(contact, 'VERIFICATION_REQUIRED', 'Sign in with a verified contact to continue.', 403);
  return { contact, level: ctx.actor.demo ? 'DEMO_SESSION' : contact.includes('@') ? 'VERIFIED_EMAIL_SESSION' : 'VERIFIED_PHONE_SESSION' };
}
function preserveAgreement(a: Aggregate, actorId: string, now: string) {
  const v = latest(a); a.status = 'ACTIVE'; a.finalizedAt = now;
  appendEvent(a, 'AGREEMENT_FINALIZED', actorId, { versionHash: v.hash }, now);
  const manifest = { schema: 'ahd-evidence-v1' as const, agreementId: a.id, publicId: a.publicId, version: v, participants: structuredClone(a.participants), approvals: a.approvals.filter(x => x.versionId === v.id && x.action === 'ACCEPTED'), attestations: a.attestations.filter(x => x.versionId === v.id), auditRoot: a.events.at(-1)!.hash, finalizedAt: now };
  a.manifest = { ...manifest, hash: digest(manifest) };
  a.outbox.push({ id: randomUUID(), eventType: 'DOCUMENT_GENERATION', participantId: null, destination: null, payload: { agreementId: a.id }, createdAt: now });
}
function acknowledgeSettlement(a: Aggregate, participantId: string, evidence: {affirmation: string; authenticationLevel: string; affirmedAt?: string}, now: string, repaymentId?: string) {
  if (a.settlements.some(s => s.participantId === participantId)) return;
  a.settlements.push({ id: randomUUID(), participantId, ...evidence, ...(repaymentId ? {repaymentId} : {}), createdAt: now });
  appendEvent(a, 'SETTLEMENT_ACKNOWLEDGED', participantId, repaymentId ? {repaymentId} : {}, now);
}
function closeWhenAcknowledged(a: Aggregate, actorId: string, now: string) {
  if (a.status !== 'SETTLEMENT_PENDING' || balance(a) !== '0' || !a.participants.filter(p => p.role !== 'WITNESS').every(p => a.settlements.some(s => s.participantId === p.id))) return;
  a.status = 'SETTLED'; a.settledAt = now;
  appendEvent(a, 'AGREEMENT_SETTLED', actorId, { byForgiveness: a.adjustmentConfirmations.length > 0 }, now);
  a.outbox.push({ id: randomUUID(), eventType: 'DOCUMENT_GENERATION', participantId: null, destination: null, payload: { agreementId: a.id, settlement: true }, createdAt: now });
}
function issueInvitation(a: Aggregate, p: Participant, ctx: Context) {
  const token = invitationToken();
  a.invitations.filter(i => i.participantId === p.id && i.status === 'PENDING').forEach(i => i.status = 'REVOKED');
  const i = { id: randomUUID(), participantId: p.id, versionId: a.currentVersionId, tokenHash: sha256(token), destination: p.contact, status: 'PENDING' as const, expiresAt: new Date(Date.parse(ctx.now) + 7 * 86400000).toISOString(), createdAt: ctx.now };
  a.invitations.push(i);
  a.outbox.push({ id: randomUUID(), eventType: 'INVITATION_DELIVERY', participantId: p.id, destination: p.contact, payload: { agreementId: a.id, invitationId: i.id }, createdAt: ctx.now });
  return { token, invitationId: i.id };
}
export function applyCommand(original: Aggregate, input: unknown, ctx: Context): { agreement: Aggregate; invitation?: { token: string; invitationId: string }; invitations?: { token: string; invitationId: string }[] } {
  const c = commandSchema.parse(input), a = structuredClone(original), p = member(a, ctx.actor);
  requireThat(p, 'PARTICIPANT_NOT_AUTHORIZED', 'You do not have access to this agreement.', 403);
  requireThat(c.expectedVersionId === a.currentVersionId, 'AGREEMENT_VERSION_STALE', 'This agreement has changed since you opened it. Reload it before continuing.');
  requireThat(!['SETTLED', 'DECLINED', 'CANCELLED'].includes(a.status), 'INVALID_STATE_TRANSITION', 'This agreement is closed. Its record remains available.');
  const evidence = sessionEvidence(ctx);
  if (sensitiveActions.has(c.action)) checkStepUp(ctx, a, c);
  const party = () => requireThat(p.role !== 'WITNESS', 'PARTICIPANT_NOT_AUTHORIZED', 'Only the lender or borrower can do this.', 403);
  const lender = () => requireThat(p.role === 'LENDER', 'PARTICIPANT_NOT_AUTHORIZED', 'Only the lender can do this.', 403);
  const prefinal = () => requireThat(!a.finalizedAt, 'INVALID_STATE_TRANSITION', 'Finalized terms cannot be edited. The original record is preserved.');
  const financial = () => { party(); requireThat(a.status === 'ACTIVE', 'INVALID_STATE_TRANSITION', 'This action needs an active agreement.'); };
  const note = () => { requireThat(c.reason?.trim(), 'REASON_REQUIRED', 'Add a short explanation before continuing.', 422); return c.reason!; };
  let invitation: { token: string; invitationId: string } | undefined;
  let invitations: { token: string; invitationId: string }[] | undefined;
  switch (c.action) {
    case 'agree-and-send': {
      lender(); prefinal();
      requireThat(a.status === 'DRAFT' || a.status === 'AWAITING_BORROWER' || a.status === 'AWAITING_APPROVAL', 'INVALID_STATE_TRANSITION', 'Update the proposed terms before sending them again.');
      requireThat(c.affirmed && c.signature, 'AFFIRMATION_REQUIRED', 'Read the terms and confirm that you agree before sending.', 422);
      requireThat(!isApproved(a, 'LENDER'), 'ALREADY_APPROVED', 'Your approval is already recorded.');
      const v = latest(a);
      a.approvals.push({ id: randomUUID(), participantId: p.id, versionId: v.id, versionHash: v.hash, role: p.role, action: 'ACCEPTED', affirmation: affirmation(p.role), affirmationVersion: 'LENDER_ACCEPT_V2', signature: c.signature, authenticationLevel: evidence.level, verifiedContact: evidence.contact, createdAt: ctx.now });
      appendEvent(a, 'LENDER_APPROVED', p.id, {versionHash: v.hash}, ctx.now);
      invitation = issueInvitation(a, a.participants.find(x => x.role === 'BORROWER')!, ctx);
      a.status = isApproved(a, 'BORROWER') ? 'AWAITING_WITNESSES' : 'AWAITING_BORROWER';
      appendEvent(a, 'BORROWER_INVITED', p.id, {}, ctx.now); break;
    }
    case 'send':
      lender(); prefinal(); requireThat(['DRAFT', 'AWAITING_BORROWER', 'AWAITING_APPROVAL'].includes(a.status), 'INVALID_STATE_TRANSITION', 'Update the proposed terms before sending them again.');
      invitation = issueInvitation(a, a.participants.find(x => x.role === 'BORROWER')!, ctx); a.status = 'AWAITING_BORROWER';
      appendEvent(a, 'BORROWER_INVITED', p.id, {}, ctx.now); break;
    case 'resend-invitation': {
      party(); prefinal();
      const recipient=a.participants.find(person=>person.id===c.targetId);
      requireThat(recipient&&canResendInvitation(a,p,recipient), 'INVALID_INVITATION_RECIPIENT', 'Only an invitation awaiting this person’s response can be resent.');
      const lastSent=Math.max(0,...a.invitations.filter(i=>i.participantId===recipient.id&&i.versionId===a.currentVersionId).map(i=>Date.parse(i.createdAt)));
      requireThat(Date.parse(ctx.now)-lastSent>=60000, 'INVITATION_RESEND_COOLDOWN', 'Please wait one minute before sending another invitation to this person.', 429);
      invitation=issueInvitation(a,recipient,ctx);
      appendEvent(a,'INVITATION_RESENT',p.id,{participantId:recipient.id},ctx.now);
      break;
    }
    case 'version': {
      lender(); prefinal(); requireThat(c.terms, 'TERMS_REQUIRED', 'Complete the agreement terms.', 422);
      const v = makeVersion(a, c.terms, note(), ctx); a.versions.push(v); a.currentVersionId = v.id; a.balanceMinor = v.terms.principalMinor;
      a.invitations.filter(i => i.status === 'PENDING').forEach(i => i.status = 'REVOKED');
      a.status = original.status === 'DRAFT' ? 'DRAFT' : 'AWAITING_BORROWER';
      appendEvent(a, 'VERSION_CREATED', p.id, { reason: c.reason, previousVersionId: v.previousId }, ctx.now); break;
    }
    case 'request-change': case 'decline': {
      prefinal(); requireThat(p.role === 'BORROWER' && ['AWAITING_BORROWER', 'AWAITING_APPROVAL'].includes(a.status), 'INVALID_STATE_TRANSITION', 'Only the borrower can respond to a proposed agreement.');
      const reason = note(), v = latest(a);
      a.approvals.push({ id: randomUUID(), participantId: p.id, versionId: v.id, versionHash: v.hash, role: p.role, action: c.action === 'decline' ? 'DECLINED' : 'REQUESTED_CHANGE', affirmation: reason, affirmationVersion: 'BORROWER_RESPONSE_V1', signature: '', authenticationLevel: 'AUTHENTICATED', verifiedContact: ctx.actor.contacts[0], createdAt: ctx.now });
      a.status = c.action === 'decline' ? 'DECLINED' : 'CHANGES_REQUESTED';
      appendEvent(a, c.action === 'decline' ? 'AGREEMENT_DECLINED' : 'BORROWER_REQUESTED_CHANGE', p.id, { reason }, ctx.now); break;
    }
    case 'approve': {
      party(); prefinal(); requireThat(['AWAITING_BORROWER', 'AWAITING_APPROVAL'].includes(a.status), 'INVALID_STATE_TRANSITION', 'Send the proposal and resolve requested changes before approving.');
      requireThat(c.affirmed && c.signature, 'AFFIRMATION_REQUIRED', 'Review the terms, select the acknowledgment and enter your full name.', 422);
      requireThat(!isApproved(a, p.role), 'ALREADY_APPROVED', 'Your approval is already recorded.');
      const contact = ctx.actor.contacts[0];
      requireThat(contact, 'VERIFICATION_REQUIRED', 'Sign in with a verified contact before approving.', 403);
      const v = latest(a); a.approvals.push({ id: randomUUID(), participantId: p.id, versionId: v.id, versionHash: v.hash, role: p.role, action: 'ACCEPTED', affirmation: affirmation(p.role), affirmationVersion: `${p.role}_ACCEPT_V2`, signature: c.signature, authenticationLevel: ctx.actor.demo ? 'DEMO_SESSION' : contact.includes('@') ? 'VERIFIED_EMAIL_SESSION' : 'VERIFIED_PHONE_SESSION', verifiedContact: contact, createdAt: ctx.now });
      a.status = isApproved(a, 'BORROWER') && isApproved(a, 'LENDER') ? 'AWAITING_WITNESSES' : 'AWAITING_APPROVAL';
      appendEvent(a, `${p.role}_APPROVED`, p.id, { versionHash: v.hash }, ctx.now); break;
    }
    case 'invite-witness': case 'invite-witnesses': {
      party(); prefinal(); requireThat(a.status === 'AWAITING_WITNESSES', 'INVALID_STATE_TRANSITION', 'Both parties must approve before inviting witnesses.');
      const entries = c.action === 'invite-witnesses' ? c.witnesses : (c.name && c.contact ? [{name:c.name,contact:c.contact}] : undefined);
      requireThat(entries?.length, 'CONTACT_REQUIRED', 'Enter each witness name and contact.', 422);
      const contacts = new Set<string>();
      invitations = entries!.map(entry => {
        requireThat(!contacts.has(entry.contact), 'DUPLICATE_PARTICIPANT', 'Each witness must have a different contact.', 422); contacts.add(entry.contact);
        const existing=a.participants.find(x=>x.contact===entry.contact);
        requireThat(!existing||(existing.role==='WITNESS'&&!existing.versionIds.includes(a.currentVersionId)), 'DUPLICATE_PARTICIPANT', 'Choose a different person as witness.', 422);
        const w: Participant = existing ?? { id: randomUUID(), userId: null, role: 'WITNESS', name: entry.name, contact: entry.contact, versionIds: [a.currentVersionId] };
        if(existing)w.versionIds.push(a.currentVersionId);else a.participants.push(w);
        const issued = issueInvitation(a, w, ctx); appendEvent(a, 'WITNESS_INVITED', p.id, { participantId: w.id }, ctx.now); return issued;
      });
      if(invitations.length===1) { invitation=invitations[0]; invitations=undefined; }
      break;
    }
    case 'attest': {
      requireThat(p.role === 'WITNESS' && p.versionIds.includes(a.currentVersionId), 'PARTICIPANT_NOT_AUTHORIZED', 'This witness invitation does not apply to the current version.', 403);
      requireThat(a.invitations.some(i=>i.participantId===p.id&&i.versionId===a.currentVersionId&&i.status==='CLAIMED'), 'INVITATION_EXPIRED', 'This witness invitation is no longer active.', 410);
      requireThat(c.educated && c.affirmed && c.signature, 'AFFIRMATION_REQUIRED', 'Read the terms, confirm that you agree to act as a witness and enter your name.', 422);
      requireThat(!a.attestations.some(w => w.participantId === p.id && w.versionId === a.currentVersionId), 'ALREADY_ATTESTED', 'Your attestation is already recorded.');
      requireThat(a.status === 'AWAITING_WITNESSES', 'INVALID_STATE_TRANSITION', 'This agreement is not awaiting a witness response.');
      const v = latest(a), digital = usesDigitalWitnesses(v);
      let type:WitnessType, presence:Presence, text:string, textVersion:string;
      if(digital){
        requireThat((!c.type || c.type==='DIGITAL_ACKNOWLEDGEMENT') && (!c.presence || c.presence==='DOCUMENT_REVIEW'), 'INVALID_WITNESS_CONTEXT', 'This version uses a digital witness acknowledgment, without a claim of physical presence.', 422);
        type='DIGITAL_ACKNOWLEDGEMENT'; presence='DOCUMENT_REVIEW'; text=digitalWitnessStatement(v); textVersion=digitalWitnessPolicy;
      }else{
        requireThat(v.payload.schema==='ahd-terms-v1' && !v.payload.witnessPolicy && c.type && c.type!=='DIGITAL_ACKNOWLEDGEMENT' && c.presence && c.presence!=='DOCUMENT_REVIEW', 'INVALID_WITNESS_CONTEXT', 'Ask the lender to propose an updated version before using the digital witness acknowledgment.', 422);
        requireThat(c.type !== 'FORMATION' || c.presence !== 'LATER_ACKNOWLEDGEMENT', 'INVALID_WITNESS_CONTEXT', 'A later acknowledgment cannot be recorded as witnessing agreement formation.', 422);
        type=c.type; presence=c.presence; text=legacyWitnessText[type]; textVersion=`${type}_V1`;
      }
      a.attestations.push({ id: randomUUID(), participantId: p.id, versionId: v.id, versionHash: v.hash, type, presence, text, textVersion, signature: c.signature, authenticationLevel: evidence.level, verifiedContact: evidence.contact, createdAt: ctx.now });
      appendEvent(a, 'WITNESS_ATTESTED', p.id, { type, presence, versionHash: v.hash, textVersion }, ctx.now); break;
    }
    case 'decline-witness':
      requireThat(p.role === 'WITNESS' && a.status === 'AWAITING_WITNESSES', 'INVALID_STATE_TRANSITION', 'This invitation is not awaiting a witness response.');
      requireThat(!a.attestations.some(w=>w.participantId===p.id&&w.versionId===a.currentVersionId)&&a.invitations.some(i=>i.participantId===p.id&&i.versionId===a.currentVersionId&&i.status==='CLAIMED'), 'INVALID_STATE_TRANSITION', 'This witness response is already recorded.');
      a.invitations.filter(i => i.participantId === p.id && i.versionId === a.currentVersionId).forEach(i => i.status = 'DECLINED');
      appendEvent(a, 'WITNESS_DECLINED', p.id, { reason: c.reason || 'Unable to truthfully attest' }, ctx.now); break;
    case 'finalize': {
      party(); if (a.finalizedAt && a.status === 'ACTIVE') break; prefinal(); const v = latest(a);
      requireThat(a.status === 'AWAITING_WITNESSES' && isApproved(a, 'LENDER') && isApproved(a, 'BORROWER'), 'BORROWER_NOT_APPROVED', 'Both parties must approve this exact version before finalization.');
      requireThat(validWitnesses(a).length >= v.terms.requiredWitnesses, 'WITNESS_REQUIREMENTS_INCOMPLETE', usesDigitalWitnesses(v)?'The requested witness acknowledgments are not complete.':'The requested direct witness attestations are not complete. Record review alone does not count.');
      preserveAgreement(a, p.id, ctx.now); break;
    }
    case 'repayment': {
      financial(); requireThat(c.amountMinor && c.date && c.method, 'PAYMENT_REQUIRED', 'Enter the amount, payment date and method.', 422);
      requireThat(c.date <= calendarDate(ctx.now), 'PAYMENT_DATE_FUTURE', 'Record a payment date of today or earlier.', 422);
      requireThat(BigInt(c.amountMinor) <= BigInt(balance(a)), 'REPAYMENT_EXCEEDS_BALANCE', 'This amount exceeds the remaining confirmed balance.', 422);
      requireThat(!c.reference || !a.repayments.some(r => r.reference === c.reference), 'DUPLICATE_PAYMENT_REFERENCE', 'This reference is already recorded. Review the existing payment.', 422);
      requireThat(!c.closeAgreement || c.amountMinor === balance(a), 'BALANCE_NOT_ZERO', 'Closure consent is only available for the full remaining balance.', 422);
      const settlementIntent = c.closeAgreement ? {affirmation: 'If the other party confirms this final payment and the balance reaches zero, I agree to close this recorded agreement.', authenticationLevel: evidence.level, affirmedAt: ctx.now} : undefined;
      const id = randomUUID(); a.repayments.push({ id, participantId: p.id, amountMinor: c.amountMinor, date: c.date, method: c.method, reference: c.reference || '', note: c.note || '', proofId: c.proofId || null, status: 'PROPOSED', ...(settlementIntent ? {settlementIntent} : {}), createdAt: ctx.now });
      appendEvent(a, 'REPAYMENT_PROPOSED', p.id, { repaymentId: id }, ctx.now); break;
    }
    case 'confirm-repayment': case 'dispute-repayment': {
      financial(); const r = a.repayments.find(r => r.id === c.targetId);
      requireThat(r && r.status === 'PROPOSED', 'INVALID_STATE_TRANSITION', 'This payment has already received a response or does not exist.');
      requireThat(r.participantId !== p.id, 'COUNTERPARTY_REQUIRED', 'The other party must respond to this payment.', 403);
      const action = c.action === 'confirm-repayment' ? 'CONFIRMED' : 'DISPUTED';
      if (action === 'CONFIRMED') requireThat(BigInt(r.amountMinor) <= BigInt(balance(a)), 'REPAYMENT_EXCEEDS_BALANCE', 'The balance changed. This payment exceeds the remaining amount.');
      else requireThat(c.note?.trim(), 'REASON_REQUIRED', 'Explain what needs to be checked about this payment.', 422);
      requireThat(!c.closeAgreement || action === 'CONFIRMED' && r.amountMinor === balance(a), 'BALANCE_NOT_ZERO', 'Only confirmation of the full remaining payment can include closure consent.', 422);
      r.status = action; a.repaymentConfirmations.push({ id: randomUUID(), repaymentId: r.id, participantId: p.id, action, note: c.note || '', createdAt: ctx.now });
      a.balanceMinor = balance(a); if (a.balanceMinor === '0') a.status = 'SETTLEMENT_PENDING';
      appendEvent(a, `REPAYMENT_${action}`, p.id, { repaymentId: r.id, note: c.note || '' }, ctx.now);
      if (action === 'CONFIRMED' && a.balanceMinor === '0') {
        if (r.settlementIntent) acknowledgeSettlement(a, r.participantId, r.settlementIntent, ctx.now, r.id);
        if (c.closeAgreement) acknowledgeSettlement(a, p.id, {affirmation: 'I confirm this final repayment and acknowledge that no balance remains under this recorded agreement.', authenticationLevel: evidence.level}, ctx.now, r.id);
        closeWhenAcknowledged(a, p.id, ctx.now);
      }
      break;
    }
    case 'forgiveness': {
      financial(); lender(); requireThat(c.amountMinor && BigInt(c.amountMinor) <= BigInt(balance(a)), 'REPAYMENT_EXCEEDS_BALANCE', 'Enter an amount up to the remaining balance.', 422);
      const id = randomUUID(); a.adjustments.push({ id, amountMinor: c.amountMinor, participantId: p.id, reason: note(), createdAt: ctx.now }); appendEvent(a, 'FORGIVENESS_PROPOSED', p.id, { adjustmentId: id }, ctx.now); break;
    }
    case 'confirm-forgiveness': {
      financial(); requireThat(p.role === 'BORROWER', 'COUNTERPARTY_REQUIRED', 'The borrower acknowledges forgiveness.', 403);
      const adj = a.adjustments.find(x => x.id === c.targetId);
      requireThat(adj && !a.adjustmentConfirmations.some(x => x.adjustmentId === adj.id), 'INVALID_STATE_TRANSITION', 'This forgiveness offer is already acknowledged or unavailable.');
      requireThat(BigInt(adj.amountMinor) <= BigInt(balance(a)), 'REPAYMENT_EXCEEDS_BALANCE', 'The balance has changed. Ask the lender to propose the current amount.');
      a.adjustmentConfirmations.push({ id: randomUUID(), adjustmentId: adj.id, participantId: p.id, createdAt: ctx.now }); a.balanceMinor = balance(a); if (a.balanceMinor === '0') a.status = 'SETTLEMENT_PENDING';
      appendEvent(a, 'FORGIVENESS_CONFIRMED', p.id, { adjustmentId: adj.id }, ctx.now); break;
    }
    case 'settle':
      party(); requireThat(a.status === 'SETTLEMENT_PENDING' && balance(a) === '0', 'BALANCE_NOT_ZERO', 'Settlement needs a zero confirmed balance.');
      requireThat(c.affirmed, 'AFFIRMATION_REQUIRED', 'Acknowledge that no recorded balance remains.', 422);
      requireThat(!a.settlements.some(s => s.participantId === p.id), 'ALREADY_ACKNOWLEDGED', 'Your settlement acknowledgment is already recorded.');
      acknowledgeSettlement(a, p.id, {affirmation: 'I acknowledge that no balance remains under this recorded agreement.', authenticationLevel: evidence.level}, ctx.now);
      closeWhenAcknowledged(a, p.id, ctx.now);
      break;
    case 'cancel':
      lender(); prefinal(); a.status = 'CANCELLED'; a.invitations.filter(i => i.status === 'PENDING').forEach(i => i.status = 'REVOKED'); appendEvent(a, 'AGREEMENT_CANCELLED', p.id, {}, ctx.now); break;
  }
  if (['approve', 'agree-and-send', 'attest'].includes(c.action) && !a.finalizedAt && a.status === 'AWAITING_WITNESSES' && isApproved(a, 'LENDER') && isApproved(a, 'BORROWER') && validWitnesses(a).length >= latest(a).terms.requiredWitnesses) preserveAgreement(a, p.id, ctx.now);
  return { agreement: a, invitation, invitations };
}
export function claimInvitation(original: Aggregate, token: string, ctx: Context): Aggregate {
  return claimInvitationById(original, original.invitations.find(i => i.tokenHash === sha256(token))?.id ?? '', ctx);
}
// An authenticated inbox claim needs the verified destination, just like a token claim.
export function claimInvitationById(original: Aggregate, invitationId: string, ctx: Context): Aggregate {
  const a = structuredClone(original), i = a.invitations.find(i => i.id === invitationId);
  requireThat(i && i.expiresAt > ctx.now && ['PENDING', 'CLAIMED'].includes(i.status) && i.versionId === a.currentVersionId && !['CANCELLED', 'DECLINED'].includes(a.status), 'INVITATION_EXPIRED', 'This invitation is no longer active. Ask the inviter for a new link.', 410);
  requireThat(ctx.actor.contacts.some(c => c.trim().toLowerCase() === i.destination.trim().toLowerCase()), 'INVITATION_IDENTITY_MISMATCH', 'Verify the email address or phone number this invitation was sent to.', 403);
  const p = a.participants.find(p => p.id === i.participantId)!;
  requireThat(!p.userId || p.userId === ctx.actor.userId, 'INVITATION_ALREADY_CLAIMED', 'This invitation is already linked to a different identity.', 403);
  requireThat(!a.participants.some(x => x.userId === ctx.actor.userId && x.id !== p.id), 'SAME_PARTY', 'One person cannot take two roles in the same agreement.', 403);
  if (i.status === 'CLAIMED') return a;
  p.userId = ctx.actor.userId; i.status = 'CLAIMED'; if (!p.versionIds.includes(i.versionId)) p.versionIds.push(i.versionId);
  appendEvent(a, 'INVITATION_CLAIMED', p.id, {}, ctx.now); return a;
}
export function projectAgreement(a: Aggregate, actor: Actor): Aggregate {
  const p = member(a, actor); requireThat(p, 'PARTICIPANT_NOT_AUTHORIZED', 'You do not have access to this agreement.', 403);
  const copy = structuredClone(a); copy.outbox = []; const invitationStatuses = copy.invitations; copy.invitations = [];
  copy.participants.forEach(x => { if (x.id !== p.id) x.contact = ''; });
  if (p.role === 'WITNESS') {
    copy.versions = copy.versions.filter(v => p.versionIds.includes(v.id));
    requireThat(copy.versions.length, 'PARTICIPANT_NOT_AUTHORIZED', 'No agreement version is available to this witness.', 403);
    copy.currentVersionId = copy.versions.at(-1)!.id;
    copy.repayments = []; copy.repaymentConfirmations = []; copy.adjustments = []; copy.adjustmentConfirmations = []; copy.settlements = [];
    copy.balanceMinor = copy.versions.at(-1)!.terms.principalMinor;
    copy.status = copy.manifest && p.versionIds.includes(copy.manifest.version.id) ? 'ACTIVE' : 'AWAITING_WITNESSES'; copy.settledAt = null;
    copy.approvals = copy.approvals.filter(x=>p.versionIds.includes(x.versionId));
    copy.approvals.forEach(x=>{x.verifiedContact='';});
    copy.witnessStatuses = copy.participants.filter(x => x.role === 'WITNESS' && x.versionIds.includes(copy.currentVersionId)).map(w => {
      const attestation = copy.attestations.find(x => x.participantId === w.id && satisfiesWitnessPolicy(latest(copy), x));
      const invitation = invitationStatuses.find(x => x.participantId === w.id && x.versionId === copy.currentVersionId);
      return { participantId: w.id, versionId: copy.currentVersionId, status: attestation ? 'ATTESTED' as const : invitation?.status === 'CLAIMED' ? 'CLAIMED' as const : 'INVITED' as const, createdAt: attestation?.createdAt ?? invitation?.createdAt ?? copy.createdAt };
    });
    copy.attestations = copy.attestations.filter(w => w.participantId === p.id);
    copy.events = copy.events.filter(e => p.versionIds.includes(e.versionId) && !/REPAYMENT|FORGIVENESS|SETTLEMENT|SETTLED/.test(e.type));
    if (copy.manifest && !p.versionIds.includes(copy.manifest.version.id)) copy.manifest = null;
  }
  // Canonical terms include parties' verified contacts; do not leak those through payloads to witnesses.
  const privatePayload = (v:Version) => usesDigitalWitnesses(v) ? {schema:v.payload.schema, witnessPolicy:v.payload.witnessPolicy, lender:{name:(v.payload.lender as {name:string}).name}, borrower:{name:(v.payload.borrower as {name:string}).name}} : {};
  if (p.role === 'WITNESS') copy.versions.forEach(v => { v.payload = privatePayload(v); });
  if (copy.manifest) { copy.manifest.participants.forEach(x => { x.contact = ''; }); copy.manifest.approvals.forEach(x => { x.verifiedContact = ''; }); copy.manifest.attestations.forEach(x => { if (x.participantId !== p.id) x.verifiedContact = ''; }); copy.manifest.version = {...copy.manifest.version,payload:privatePayload(copy.manifest.version)}; }
  return copy;
}

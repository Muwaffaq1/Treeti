import type { Aggregate,Role } from '@/modules/agreements/types';
import {qualifyingWitnesses} from '@/modules/agreements/witness-policy';
export const currentVersion=(a:Aggregate)=>a.versions.find(v=>v.id===a.currentVersionId)!;
export const participantFor=(a:Aggregate,userId:string)=>a.participants.find(p=>p.userId===userId)!;
export const statusLabels:Record<string,string>={DRAFT:'Draft',AWAITING_BORROWER:'Awaiting borrower',CHANGES_REQUESTED:'Changes requested',AWAITING_APPROVAL:'Awaiting approval',AWAITING_WITNESSES:'Awaiting witnesses',ACTIVE:'Active',SETTLEMENT_PENDING:'Ready for settlement',SETTLED:'Settled',DECLINED:'Declined',CANCELLED:'Cancelled'};
export const hasApproval=(a:Aggregate,role:Role)=>a.approvals.some(p=>p.role===role&&p.versionId===a.currentVersionId&&p.action==='ACCEPTED');
export const witnesses=(a:Aggregate)=>qualifyingWitnesses(currentVersion(a),a.attestations,a.participants);
export const formatDate=(date:string)=>new Intl.DateTimeFormat('en-NG',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Lagos'}).format(new Date(date.length===10?`${date}T12:00:00Z`:date));
export const formatTime=(date:string)=>new Intl.DateTimeFormat('en-NG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Africa/Lagos'}).format(new Date(date));
// Phrases that confirm a loan is interest-free, removed before looking for interest-like wording.
const interestFreePhrases=/\b(?:interest[- ]free|(?:no|without|zero|0%?) (?:interest|fees?|penalt(?:y|ies)|extra charges?|charges?))\b/gi;
const interestWords=/\b(?:interest|riba|usury|profits?|percent|per ?cent|fees?|penalt(?:y|ies)|late charges?|surcharges?|commissions?|mark-?ups?|extra charges?|extra amounts?|on top)\b|\d+(?:[.,]\d+)?\s*%/gi;
/** Interest-like wording in free text, so people can be reminded that agreements must stay interest-free. */
export function interestWording(...texts:(string|undefined)[]){const found=new Set<string>();for(const text of texts)for(const match of (text??'').replace(interestFreePhrases,' ').matchAll(interestWords))found.add(match[0].toLowerCase().replace(/\s+/g,' '));return [...found];}
export const affirmation=(role:Role)=>role==='BORROWER'?'I acknowledge that I have reviewed this agreement and that these terms accurately represent the obligation I am agreeing to. I confirm this loan is interest-free: I will repay only the amount I borrowed, with no interest, fees, penalties or other extra charges.':'I have reviewed this agreement and agree to these terms. I confirm this loan is interest-free: I will ask for back only the amount I lent, with no interest, fees, penalties or other extra charges.';
export const eventText:Record<string,string>={AGREEMENT_CREATED:'Agreement drafted',BORROWER_INVITED:'Borrower invited to review',INVITATION_RESENT:'Invitation resent',INVITATION_CLAIMED:'Invitation opened',VERSION_CREATED:'New agreement version created',BORROWER_REQUESTED_CHANGE:'Borrower requested changes',AGREEMENT_DECLINED:'Agreement declined',LENDER_APPROVED:'Lender approved the terms',BORROWER_APPROVED:'Borrower approved the terms',WITNESS_INVITED:'Witness invited',WITNESS_ATTESTED:'Witness response recorded',WITNESS_DECLINED:'Witness declined',AGREEMENT_FINALIZED:'Agreement finalized',REPAYMENT_PROPOSED:'Repayment awaiting confirmation',REPAYMENT_CONFIRMED:'Repayment confirmed',REPAYMENT_DISPUTED:'Repayment needs clarification',FORGIVENESS_PROPOSED:'Forgiveness offered',FORGIVENESS_CONFIRMED:'Forgiveness acknowledged',SETTLEMENT_ACKNOWLEDGED:'Settlement acknowledged',AGREEMENT_SETTLED:'Agreement settled',AGREEMENT_CANCELLED:'Proposal cancelled'};
export function needsAttention(a:Aggregate,userId:string){const p=participantFor(a,userId);if(!p)return false;if(a.status==='CHANGES_REQUESTED')return p.role==='LENDER';if(['AWAITING_BORROWER','AWAITING_APPROVAL'].includes(a.status))return p.role!=='WITNESS'&&!hasApproval(a,p.role);if(a.status==='AWAITING_WITNESSES')return p.role==='WITNESS'?!a.attestations.some(w=>w.participantId===p.id&&w.versionId===a.currentVersionId):true;if(a.status==='SETTLEMENT_PENDING')return p.role!=='WITNESS'&&!a.settlements.some(s=>s.participantId===p.id);return p.role!=='WITNESS'&&(a.repayments.some(r=>r.status==='PROPOSED'&&r.participantId!==p.id)||(p.role==='BORROWER'&&a.adjustments.some(x=>!a.adjustmentConfirmations.some(c=>c.adjustmentId===x.id))));}
export function nextTask(a:Aggregate,userId:string){const p=participantFor(a,userId);if(a.status==='CHANGES_REQUESTED')return 'Review requested changes';if(['AWAITING_BORROWER','AWAITING_APPROVAL'].includes(a.status))return 'Review and approve the terms';if(a.status==='AWAITING_WITNESSES')return p.role==='WITNESS'?'Review your witness invitation':'Complete the witness arrangement';if(a.status==='SETTLEMENT_PENDING')return 'Acknowledge settlement';return 'Review a repayment record';}

// Receivables and obligations stay separate, including when their currencies match.
export function agreementBalances(agreements:Aggregate[],userId:string){
  const owedToYou={totals:new Map<string,bigint>(),count:0},youOwe={totals:new Map<string,bigint>(),count:0};
  for(const a of agreements){
    if(!['ACTIVE','SETTLEMENT_PENDING'].includes(a.status))continue;
    const role=participantFor(a,userId)?.role;
    const bucket=role==='LENDER'?owedToYou:role==='BORROWER'?youOwe:null;
    if(!bucket)continue;
    const currency=currentVersion(a).terms.currency;
    bucket.totals.set(currency,(bucket.totals.get(currency)??0n)+BigInt(a.balanceMinor));bucket.count++;
  }
  for(const bucket of [owedToYou,youOwe])bucket.totals=new Map([...bucket.totals].sort(([a],[b])=>a.localeCompare(b)));
  return {owedToYou,youOwe};
}
export function activityFormatters(timeZone:string){return {
  dateKey:new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit',timeZone}),
  day:new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone}),
  clock:new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone}),
  full:new Intl.DateTimeFormat('en-GB',{dateStyle:'full',timeStyle:'long',timeZone})
};}

import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {digest,invitationToken,sha256} from '@/lib/crypto';
import {calendarDate} from '@/lib/calendar';
import {calendarDateSchema} from '@/lib/installment-schema';
import {currencies,type Currency} from '@/lib/currencies';
import {money} from '@/lib/money';
import {DomainError} from '@/lib/domain-error';
import {contactSchema,minorSchema} from '@/modules/agreements/schema';
import type {Actor} from '@/modules/agreements/types';

/**
 * An investment agreement: two to five partners put money into one venture and each signs the same version.
 * Profit is split by the percentages they agree; any loss is always shared by how much money each put in,
 * and no partner can be promised a fixed return (owner, Nov 2026). The wording needs scholar review before launch.
 */
import {lossShares,partnerAffirmation,partnerLimit,percent,witnessAffirmation,witnessLimit} from './shared';
export {lossShares,partnerAffirmation,partnerLimit,percent,witnessAffirmation,witnessLimit};
export type Status='AWAITING_SIGNATURES'|'CHANGES_REQUESTED'|'AWAITING_WITNESSES'|'ACTIVE'|'DECLINED'|'CANCELLED';
export type Partner={id:string;userId:string|null;name:string;contact:string;tokenHash:string|null;joinedAt:string|null;creator:boolean};
export type Witness={id:string;userId:string|null;name:string;contact:string;tokenHash:string|null;joinedAt:string|null};
export type Terms={venture:string;currency:Currency;startDate:string;reviewDate:string|null;manager:string|null;exit:string;note:string};
/** Money and profit share for one partner, fixed per version. */
export type Stake={partnerId:string;capitalMinor:string;profitShare:number};
export type Version={id:string;number:number;terms:Terms;stakes:Stake[];text:string;hash:string;reason:string;createdBy:string;createdAt:string};
export type Signature={id:string;partnerId:string;versionId:string;versionHash:string;signature:string;affirmation:string;level:string;contact:string;createdAt:string};
export type Attestation={id:string;witnessId:string;versionId:string;versionHash:string;signature:string;text:string;level:string;contact:string;createdAt:string};
export type ChangeRequest={id:string;partnerId:string;versionId:string;note:string;createdAt:string};
export type Event={id:string;sequence:number;type:string;actorId:string;versionId:string;payload:Record<string,unknown>;previousHash:string|null;hash:string;createdAt:string};
export type InvestmentAgreement={
  id:string;publicId:string;createdBy:string;createdAt:string;createKey:string;status:Status;currentVersionId:string;
  partners:Partner[];witnesses:Witness[];versions:Version[];signatures:Signature[];attestations:Attestation[];changeRequests:ChangeRequest[];events:Event[];
  finalizedAt:string|null;finalHash:string|null;closedBy:string|null;closedNote:string;revision:number;
};
export type EventType='CREATED'|'SIGNED'|'JOINED'|'CHANGE_REQUESTED'|'REVISED'|'DECLINED'|'CANCELLED'|'WITNESSED'|'FINALIZED'|'LINK_RENEWED';
export type Change={agreement:InvestmentAgreement;event:EventType;links?:{personId:string;name:string;role:'PARTNER'|'WITNESS';token:string}[]};


const name=z.string().trim().min(2,'Enter their full name.').max(120,'Use 120 characters or fewer.');
const share=z.number().int('Use whole percentages.').min(1,'Each profit share must be at least 1%.').max(99,'Each profit share must be 99% or less.');
const termsInput=z.object({
  venture:z.string().trim().min(2,'Say what you’re investing in.').max(120,'Use 120 characters or fewer.'),
  currency:z.enum(currencies),startDate:calendarDateSchema,reviewDate:calendarDateSchema.nullable().default(null),
  manager:z.string().trim().max(120).nullable().default(null),exit:z.string().trim().max(1000).default(''),note:z.string().trim().max(2000).default(''),
}).strict();
const stakeInput=z.object({capitalMinor:minorSchema,profitShare:share}).strict();
const signatureInput={signature:z.string().trim().min(2,'Sign with your name.').max(120),affirmed:z.literal(true,{message:'Confirm the promise before you sign.'})};
export const createInput=z.object({
  terms:termsInput,me:stakeInput,
  partners:z.array(stakeInput.extend({name,contact:contactSchema})).min(1,'Add at least one partner.').max(partnerLimit-1,`Up to ${partnerLimit} people can be in one agreement, including you.`),
  witnesses:z.array(z.object({name,contact:contactSchema}).strict()).max(witnessLimit,`Add up to ${witnessLimit} witnesses.`).default([]),
  ...signatureInput,
}).strict();
/** A new version keeps the same people; only the terms and each person's money and profit share change. */
export const reviseInput=z.object({expectedVersionId:z.uuid(),terms:termsInput,stakes:z.array(stakeInput.extend({partnerId:z.uuid()})).min(2).max(partnerLimit),reason:z.string().trim().max(500).default(''),...signatureInput}).strict();
export const signInput=z.object({expectedVersionId:z.uuid(),...signatureInput}).strict();
export const noteInput=z.object({expectedVersionId:z.uuid(),note:z.string().trim().max(1000).default('')}).strict();
export const versionInput=z.object({expectedVersionId:z.uuid()}).strict();
export const renewInput=z.object({personId:z.uuid()}).strict();

const fail=(code:string,message:string,status=409):never=>{throw new DomainError(code,message,status);};
export const latest=(a:InvestmentAgreement)=>a.versions.find(v=>v.id===a.currentVersionId)!;
export const partnerOf=(a:InvestmentAgreement,actor:Actor)=>a.partners.find(p=>p.userId===actor.userId);
export const witnessOf=(a:InvestmentAgreement,actor:Actor)=>a.witnesses.find(w=>w.userId===actor.userId);
export const isMember=(a:InvestmentAgreement,actor:Actor)=>!!(partnerOf(a,actor)||witnessOf(a,actor));
export const hasSigned=(a:InvestmentAgreement,partnerId:string,v=latest(a))=>a.signatures.some(s=>s.partnerId===partnerId&&s.versionId===v.id&&s.versionHash===v.hash);
export const hasWitnessed=(a:InvestmentAgreement,witnessId:string,v=latest(a))=>a.attestations.some(s=>s.witnessId===witnessId&&s.versionId===v.id&&s.versionHash===v.hash);

export const totalCapital=(stakes:Stake[])=>stakes.reduce((sum,s)=>sum+BigInt(s.capitalMinor),0n).toString();
const list=(items:string[])=>items.length<2?items.join(''):`${items.slice(0,-1).join(', ')} and ${items.at(-1)}`;
const long=(d:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'}).format(new Date(`${d}T12:00:00Z`));

/** The agreed wording everyone signs. Plain, neutral terms; reviewed by a scholar before launch. */
export function agreementText(partners:Pick<Partner,'id'|'name'>[],terms:Terms,stakes:Stake[]){
  const nameOf=(id:string)=>partners.find(p=>p.id===id)!.name,loss=lossShares(stakes);
  const parts=[
    `${list(partners.map(p=>p.name))} agree to invest together in ${terms.venture}, starting on ${long(terms.startDate)}.`,
    `${list(stakes.map(s=>`${nameOf(s.partnerId)} puts in ${money(s.capitalMinor,terms.currency)}`))}, a total of ${money(totalCapital(stakes),terms.currency)}.`,
    `Any profit is shared as agreed: ${list(stakes.map(s=>`${nameOf(s.partnerId)} ${s.profitShare}%`))}.`,
    `Any loss is shared by how much money each partner put in: ${list(stakes.map(s=>`${nameOf(s.partnerId)} ${percent(loss.get(s.partnerId)!)}`))}.`,
    'No partner is promised a fixed return or a guaranteed amount.',
    terms.manager?`${terms.manager} looks after the investment day to day and keeps the others informed.`:'The partners look after the investment together.',
  ];
  if(terms.reviewDate)parts.push(`The partners will review the investment on ${long(terms.reviewDate)}.`);
  if(terms.exit)parts.push(`If a partner wants to leave: ${terms.exit.replace(/\.$/,'')}.`);
  if(terms.note)parts.push(`Also agreed: ${terms.note.replace(/\.$/,'')}.`);
  parts.push('treeti keeps this record. It does not hold, move or invest any money.');
  return parts.join(' ');
}

function checkTerms(terms:Terms,stakes:Stake[],partners:Pick<Partner,'id'|'name'>[]){
  const total=stakes.reduce((sum,s)=>sum+s.profitShare,0);
  if(total!==100)fail('SHARES_TOTAL',`Profit shares must add up to 100%. They add up to ${total}% now.`,422);
  if(terms.reviewDate&&terms.reviewDate<=terms.startDate)fail('REVIEW_DATE','Choose a review date after the start date.',422);
  if(terms.manager&&!partners.some(p=>p.name===terms.manager))fail('MANAGER','Choose one of the partners to look after it, or say you’ll do it together.',422);
}
function makeVersion(a:Pick<InvestmentAgreement,'id'|'publicId'|'partners'|'versions'>,terms:Terms,stakes:Stake[],reason:string,actor:Actor,now:string):Version{
  const number=a.versions.length+1,text=agreementText(a.partners,terms,stakes);
  const payload={schema:'treeti-investment-v1',agreementId:a.id,publicId:a.publicId,version:number,terms,stakes,partners:a.partners.map(p=>({id:p.id,name:p.name})),text};
  return {id:randomUUID(),number,terms,stakes,text,hash:digest(payload),reason,createdBy:actor.userId,createdAt:now};
}
function append(a:InvestmentAgreement,type:EventType,actorId:string,payload:Record<string,unknown>,now:string){
  const data={id:randomUUID(),sequence:a.events.length+1,type,actorId,versionId:a.currentVersionId,payload,previousHash:a.events.at(-1)?.hash??null,createdAt:now};
  a.events.push({...data,hash:digest(data)});
}
export function verifyEvents(events:Event[]){return events.every((e,i)=>{const {hash,...data}=e;return e.sequence===i+1&&e.previousHash===(events[i-1]?.hash??null)&&digest(data)===hash;});}
function evidence(actor:Actor){
  const contact=actor.contacts[0]??fail('VERIFICATION_REQUIRED','Sign in with a verified contact to continue.',403);
  return {contact,level:actor.demo?'DEMO_SESSION':contact.includes('@')?'VERIFIED_EMAIL_SESSION':'VERIFIED_PHONE_SESSION'};
}
const next=(a:InvestmentAgreement):InvestmentAgreement=>({...structuredClone(a),revision:a.revision+1});
const open=(a:InvestmentAgreement)=>['AWAITING_SIGNATURES','CHANGES_REQUESTED','AWAITING_WITNESSES'].includes(a.status)||fail('AGREEMENT_CLOSED','This agreement can no longer change.',409);
const sameVersion=(a:InvestmentAgreement,id:string)=>a.currentVersionId===id||fail('VERSION_CHANGED','This agreement changed since you opened it. Reload to read the latest version.',409);
const asCreator=(a:InvestmentAgreement,actor:Actor)=>{const p=partnerOf(a,actor);if(!p?.creator)fail('NOT_ALLOWED','Only the person who wrote this agreement can do that.',403);return p!;};

export function createAgreement(input:unknown,actor:Actor,publicId:string,createKey:string,now:string):Change{
  const data=createInput.parse(input),mine=actor.contacts.map(c=>c.toLowerCase());
  const contacts=[...data.partners,...data.witnesses].map(p=>p.contact.toLowerCase());
  if(contacts.some(c=>mine.includes(c)))fail('SAME_PARTY','Add the other people’s contacts, not your own.',422);
  if(new Set(contacts).size!==contacts.length)fail('DUPLICATE_CONTACT','Each person needs their own email or phone number.',422);
  if(data.signature.toLowerCase()!==actor.name.trim().toLowerCase())fail('SIGNATURE_MISMATCH','Sign with your name as it appears on your account.',422);
  const links:NonNullable<Change['links']>=[];
  const invite=(name:string,role:'PARTNER'|'WITNESS')=>{const token=invitationToken(),personId=randomUUID();links.push({personId,name,role,token});return {personId,tokenHash:sha256(token)};};
  const creator:Partner={id:randomUUID(),userId:actor.userId,name:actor.name,contact:actor.contacts[0]??'',tokenHash:null,joinedAt:now,creator:true};
  const others:Partner[]=data.partners.map(p=>{const {personId,tokenHash}=invite(p.name,'PARTNER');return {id:personId,userId:null,name:p.name,contact:p.contact,tokenHash,joinedAt:null,creator:false};});
  const witnesses:Witness[]=data.witnesses.map(w=>{const {personId,tokenHash}=invite(w.name,'WITNESS');return {id:personId,userId:null,name:w.name,contact:w.contact,tokenHash,joinedAt:null};});
  const partners=[creator,...others],stakes:Stake[]=[{partnerId:creator.id,...data.me},...others.map((p,i)=>({partnerId:p.id,capitalMinor:data.partners[i].capitalMinor,profitShare:data.partners[i].profitShare}))];
  if(new Set(partners.map(p=>p.name.toLowerCase())).size!==partners.length)fail('DUPLICATE_NAME','Each partner needs a different name so the agreement is clear.',422);
  const terms={...data.terms,reviewDate:data.terms.reviewDate??null,manager:data.terms.manager||null};
  checkTerms(terms,stakes,partners);
  const a:InvestmentAgreement={id:randomUUID(),publicId,createdBy:actor.userId,createdAt:now,createKey,status:'AWAITING_SIGNATURES',currentVersionId:'',partners,witnesses,versions:[],signatures:[],attestations:[],changeRequests:[],events:[],finalizedAt:null,finalHash:null,closedBy:null,closedNote:'',revision:0};
  const v=makeVersion(a,terms,stakes,'First version',actor,now);a.versions.push(v);a.currentVersionId=v.id;
  append(a,'CREATED',creator.id,{versionHash:v.hash},now);
  addSignature(a,creator,data.signature,actor,now);
  return {agreement:a,event:'CREATED',links};
}
function addSignature(a:InvestmentAgreement,p:Partner,signature:string,actor:Actor,now:string){
  const v=latest(a),{contact,level}=evidence(actor);
  a.signatures.push({id:randomUUID(),partnerId:p.id,versionId:v.id,versionHash:v.hash,signature,affirmation:partnerAffirmation,level,contact,createdAt:now});
  append(a,'SIGNED',p.id,{versionHash:v.hash},now);
}
/** Everyone has signed: wait for any named witness who hasn't witnessed yet, otherwise it's final. */
function afterSignatures(a:InvestmentAgreement,now:string){
  if(!a.partners.every(p=>hasSigned(a,p.id)))return;
  if(a.witnesses.some(w=>!hasWitnessed(a,w.id))){a.status='AWAITING_WITNESSES';return;}
  finalize(a,a.partners.find(p=>p.creator)!.id,now);
}
function finalize(a:InvestmentAgreement,actorId:string,now:string){
  const v=latest(a);a.status='ACTIVE';a.finalizedAt=now;
  append(a,'FINALIZED',actorId,{versionHash:v.hash},now);
  a.finalHash=digest({version:v,signatures:a.signatures.filter(s=>s.versionId===v.id),attestations:a.attestations.filter(s=>s.versionId===v.id),auditRoot:a.events.at(-1)!.hash});
}

/** Opening an invitation link while signed in with the invited email or phone joins that person to the agreement. */
export function joinAgreement(a:InvestmentAgreement|null,token:string,actor:Actor,now:string):Change{
  const hash=sha256(token),person=a?[...a.partners,...a.witnesses].find(p=>p.tokenHash===hash):undefined;
  if(!a||!person)return fail('INVITATION_EXPIRED','This invitation link is no longer active. Ask for a new link.',404);
  if(person.userId===actor.userId)return {agreement:a,event:'JOINED'};
  if(person.userId)fail('INVITATION_USED','Someone else has already opened this invitation.',409);
  if(!actor.contacts.some(c=>c.toLowerCase()===person.contact.toLowerCase()))fail('WRONG_ACCOUNT','Sign in with the email or phone number this invitation was sent to.',403);
  if(isMember(a,actor))fail('ALREADY_IN','You’re already in this agreement.',409);
  if(['DECLINED','CANCELLED'].includes(a.status))fail('AGREEMENT_CLOSED','This agreement was closed before you opened it.',409);
  const b=next(a),target=[...b.partners,...b.witnesses].find(p=>p.id===person.id)!;
  target.userId=actor.userId;target.joinedAt=now;
  append(b,'JOINED',person.id,{},now);
  return {agreement:b,event:'JOINED'};
}
export function signAgreement(a:InvestmentAgreement,actor:Actor,input:unknown,now:string):Change{
  const data=signInput.parse(input),p=partnerOf(a,actor)??fail('NOT_FOUND','This agreement is unavailable.',404);
  if(a.status!=='AWAITING_SIGNATURES')fail('NOT_SIGNING',a.status==='CHANGES_REQUESTED'?'A change was asked for. Wait for the new version before signing.':'This agreement isn’t waiting for signatures.',409);
  sameVersion(a,data.expectedVersionId);
  if(hasSigned(a,p.id))fail('ALREADY_SIGNED','You’ve already signed this version.',409);
  if(data.signature.toLowerCase()!==actor.name.trim().toLowerCase())fail('SIGNATURE_MISMATCH','Sign with your name as it appears on your account.',422);
  const b=next(a);addSignature(b,partnerOf(b,actor)!,data.signature,actor,now);afterSignatures(b,now);
  return {agreement:b,event:b.status==='ACTIVE'?'FINALIZED':'SIGNED'};
}
export function requestChange(a:InvestmentAgreement,actor:Actor,input:unknown,now:string):Change{
  const data=noteInput.parse(input),p=partnerOf(a,actor)??fail('NOT_FOUND','This agreement is unavailable.',404);
  if(p.creator)fail('NOT_ALLOWED','You wrote this agreement. Change the terms instead.',403);
  if(a.status!=='AWAITING_SIGNATURES')fail('NOT_SIGNING','You can ask for a change while the agreement is waiting for signatures.',409);
  sameVersion(a,data.expectedVersionId);
  if(!data.note)fail('NOTE_REQUIRED','Say what you’d like changed.',422);
  const b=next(a);b.status='CHANGES_REQUESTED';
  b.changeRequests.push({id:randomUUID(),partnerId:p.id,versionId:a.currentVersionId,note:data.note,createdAt:now});
  append(b,'CHANGE_REQUESTED',p.id,{},now);
  return {agreement:b,event:'CHANGE_REQUESTED'};
}
export function reviseAgreement(a:InvestmentAgreement,actor:Actor,input:unknown,now:string):Change{
  const data=reviseInput.parse(input);open(a);const creator=asCreator(a,actor);
  if(a.status==='AWAITING_WITNESSES')fail('ALL_SIGNED','Everyone has already signed. Finish it, or cancel and write a new one.',409);
  sameVersion(a,data.expectedVersionId);
  if(data.signature.toLowerCase()!==actor.name.trim().toLowerCase())fail('SIGNATURE_MISMATCH','Sign with your name as it appears on your account.',422);
  const ids=new Set(data.stakes.map(s=>s.partnerId));
  if(ids.size!==a.partners.length||a.partners.some(p=>!ids.has(p.id)))fail('PARTNERS_FIXED','The same people stay in the agreement. To change who’s in it, cancel and write a new one.',422);
  const stakes=a.partners.map(p=>{const s=data.stakes.find(x=>x.partnerId===p.id)!;return {partnerId:p.id,capitalMinor:s.capitalMinor,profitShare:s.profitShare};});
  const terms={...data.terms,reviewDate:data.terms.reviewDate??null,manager:data.terms.manager||null};
  checkTerms(terms,stakes,a.partners);
  const b=next(a),v=makeVersion(b,terms,stakes,data.reason||'Terms changed',actor,now);
  if(v.hash===latest(a).hash)fail('NO_CHANGE','Nothing changed. Edit the terms first.',422);
  b.versions.push(v);b.currentVersionId=v.id;b.status='AWAITING_SIGNATURES';
  append(b,'REVISED',creator.id,{versionHash:v.hash},now);
  addSignature(b,partnerOf(b,actor)!,data.signature,actor,now);
  return {agreement:b,event:'REVISED'};
}
export function declineAgreement(a:InvestmentAgreement,actor:Actor,input:unknown,now:string):Change{
  const data=noteInput.parse(input),p=partnerOf(a,actor)??fail('NOT_FOUND','This agreement is unavailable.',404);
  if(p.creator)fail('NOT_ALLOWED','You wrote this agreement. Cancel it instead.',403);
  open(a);sameVersion(a,data.expectedVersionId);
  const b=next(a);b.status='DECLINED';b.closedBy=p.id;b.closedNote=data.note;append(b,'DECLINED',p.id,{},now);
  return {agreement:b,event:'DECLINED'};
}
export function cancelAgreement(a:InvestmentAgreement,actor:Actor,input:unknown,now:string):Change{
  const data=noteInput.parse(input);open(a);const creator=asCreator(a,actor);sameVersion(a,data.expectedVersionId);
  const b=next(a);b.status='CANCELLED';b.closedBy=creator.id;b.closedNote=data.note;append(b,'CANCELLED',creator.id,{},now);
  return {agreement:b,event:'CANCELLED'};
}
export function witnessAgreement(a:InvestmentAgreement,actor:Actor,input:unknown,now:string):Change{
  const data=signInput.parse(input),w=witnessOf(a,actor)??fail('NOT_FOUND','This agreement is unavailable.',404);
  if(a.status!=='AWAITING_WITNESSES')fail('NOT_WITNESSING','You can witness it once every partner has signed.',409);
  sameVersion(a,data.expectedVersionId);
  if(hasWitnessed(a,w.id))fail('ALREADY_WITNESSED','You’ve already witnessed this agreement.',409);
  if(data.signature.toLowerCase()!==actor.name.trim().toLowerCase())fail('SIGNATURE_MISMATCH','Sign with your name as it appears on your account.',422);
  const b=next(a),v=latest(b),{contact,level}=evidence(actor);
  b.attestations.push({id:randomUUID(),witnessId:w.id,versionId:v.id,versionHash:v.hash,signature:data.signature,text:witnessAffirmation,level,contact,createdAt:now});
  append(b,'WITNESSED',w.id,{versionHash:v.hash},now);
  if(b.witnesses.every(x=>hasWitnessed(b,x.id)))finalize(b,w.id,now);
  return {agreement:b,event:b.status==='ACTIVE'?'FINALIZED':'WITNESSED'};
}
/** The writer can finish once everyone has signed, without waiting for witnesses who haven't responded. */
export function finishWithoutWitnesses(a:InvestmentAgreement,actor:Actor,input:unknown,now:string):Change{
  const data=versionInput.parse(input),creator=asCreator(a,actor);
  if(a.status!=='AWAITING_WITNESSES')fail('NOT_READY','Every partner needs to sign first.',409);
  sameVersion(a,data.expectedVersionId);
  const b=next(a);finalize(b,creator.id,now);
  return {agreement:b,event:'FINALIZED'};
}
/** A fresh private link for someone who hasn't opened theirs yet; the old link stops working. */
export function renewLink(a:InvestmentAgreement,actor:Actor,input:unknown,now:string):Change{
  const data=renewInput.parse(input);open(a);const creator=asCreator(a,actor);
  const person=[...a.partners,...a.witnesses].find(p=>p.id===data.personId);
  if(!person||(person as Partner).creator)fail('NOT_FOUND','This person isn’t in the agreement.',404);
  if(person!.userId)fail('ALREADY_JOINED',`${person!.name} has already opened the agreement.`,409);
  const token=invitationToken(),b=next(a),target=[...b.partners,...b.witnesses].find(p=>p.id===data.personId)!;
  target.tokenHash=sha256(token);append(b,'LINK_RENEWED',creator.id,{personId:person!.id},now);
  return {agreement:b,event:'LINK_RENEWED',links:[{personId:person!.id,name:person!.name,role:a.partners.some(p=>p.id===person!.id)?'PARTNER':'WITNESS',token}]};
}
export const actions={sign:signAgreement,change:requestChange,revise:reviseAgreement,decline:declineAgreement,cancel:cancelAgreement,witness:witnessAgreement,finish:finishWithoutWitnesses,renew:renewLink} as const;
export type ActionName=keyof typeof actions;

/** What one person sees: no invitation hashes, and other people's contacts masked. */
export type View=Omit<InvestmentAgreement,'partners'|'witnesses'|'createKey'>&{
  partners:(Omit<Partner,'tokenHash'|'contact'>&{contact:string;joined:boolean})[];
  witnesses:(Omit<Witness,'tokenHash'|'contact'>&{contact:string;joined:boolean})[];
  me:{personId:string;role:'PARTNER'|'WITNESS';creator:boolean};
};
const mask=(c:string)=>c.includes('@')?c.replace(/^(.).*?(@.*)$/,'$1•••$2'):c.replace(/^(\+\d{3}).*(\d{2})$/,'$1•••$2');
export function viewFor(a:InvestmentAgreement,actor:Actor):View{
  const p=partnerOf(a,actor),w=witnessOf(a,actor);
  if(!p&&!w)fail('NOT_FOUND','This agreement is unavailable.',404);
  const strip=<T extends Partner|Witness>({tokenHash:_t,contact,...rest}:T)=>{void _t;return {...rest,contact:rest.userId===actor.userId||p?.creator?contact:mask(contact),joined:!!rest.userId};};
  const {createKey:_k,...rest}=a;void _k;
  return {...rest,partners:a.partners.map(strip),witnesses:a.witnesses.map(strip),me:{personId:(p??w)!.id,role:p?'PARTNER':'WITNESS',creator:!!p?.creator}};
}
/** The shared investment each partner gets once it's final: their money in, and everyone else's profit share. */
export function investmentFor(a:InvestmentAgreement,partner:Partner,id:string,contributionId:string,now:string){
  const v=latest(a),stake=v.stakes.find(s=>s.partnerId===partner.id)!,date=v.terms.startDate<=calendarDate(now)?v.terms.startDate:calendarDate(now);
  return {id,ownerId:partner.userId!,name:v.terms.venture,currency:v.terms.currency,note:`From the signed investment agreement ${a.publicId}.`,
    partners:v.stakes.filter(s=>s.partnerId!==partner.id).map(s=>({name:a.partners.find(p=>p.id===s.partnerId)!.name,share:s.profitShare})),myShare:stake.profitShare,
    agreementId:a.id,agreementPublicId:a.publicId,createdAt:now,updatedAt:now,revision:0,archived:false,
    contributions:[{id:contributionId,amountMinor:stake.capitalMinor,date,note:'Put in under the agreement',createdAt:now}]};
}
/** Whether this person has something to do: sign, witness, update after a change request, or finish. */
export function yourTurn(a:InvestmentAgreement,actor:Actor):'sign'|'witness'|'revise'|null{
  const p=partnerOf(a,actor),w=witnessOf(a,actor);
  if(p&&a.status==='AWAITING_SIGNATURES'&&!hasSigned(a,p.id))return 'sign';
  if(p?.creator&&a.status==='CHANGES_REQUESTED')return 'revise';
  if(w&&a.status==='AWAITING_WITNESSES'&&!hasWitnessed(a,w.id))return 'witness';
  return null;
}
export const newPublicId=()=>`INV-${randomUUID().replace(/-/g,'').slice(0,8).toUpperCase()}`;

import {z} from 'zod';
import {DomainError} from '@/lib/domain-error';
import {invitationToken,sha256} from '@/lib/crypto';
import type {Actor} from '@/modules/agreements/types';

/** A person the owner trusts to see their debts if the owner can no longer manage them. See ADR 022. */
export type TrustedContact={
  id:string;ownerId:string;ownerName:string;ownerEmail:string;
  name:string;email:string;tokenHash:string;contactUserId:string|null;
  status:'INVITED'|'ACCEPTED'|'REMOVED';
  createdAt:string;acceptedAt:string|null;removedAt:string|null;
  /** When the contact last asked to see the records, and when that request opens access unless refused. */
  requestedAt:string|null;opensAt:string|null;
  /** Set when the owner shares straight away; cleared when the owner stops sharing. */
  sharedAt:string|null;
  /** When the owner last refused a request or stopped sharing. */
  closedAt:string|null;
  revision:number;
};
export type Access='NONE'|'WAITING'|'OPEN';
export type TrustedEventType='INVITED'|'LINK_RENEWED'|'ACCEPTED'|'REQUESTED'|'REFUSED'|'SHARED'|'STOPPED'|'REMOVED'|'LEFT';
export type TrustedChange={contact:TrustedContact;event:TrustedEventType;token?:string};

import {trustedContactLimit,waitingDays} from './limits';
export {trustedContactLimit,waitingDays};
const day=86400000;

export const inviteInput=z.object({
  name:z.string().trim().min(2,'Enter their full name.').max(120,'Use 120 characters or fewer.'),
  email:z.email('Enter their email address, such as name@example.com.').trim().max(254).transform(v=>v.toLowerCase()),
}).strict();

export function access(contact:TrustedContact,now:string):Access{
  if(contact.status!=='ACCEPTED')return 'NONE';
  if(contact.sharedAt||(contact.opensAt&&contact.opensAt<=now))return 'OPEN';
  return contact.opensAt?'WAITING':'NONE';
}
const fail=(code:string,message:string,status=409):never=>{throw new DomainError(code,message,status);};
function asOwner(contact:TrustedContact,actor:Actor){if(contact.ownerId!==actor.userId)fail('NOT_FOUND','This trusted contact is unavailable.',404);}
function asContact(contact:TrustedContact,actor:Actor){if(contact.status!=='ACCEPTED'||contact.contactUserId!==actor.userId)fail('NOT_FOUND','This trusted contact is unavailable.',404);}
const next=(contact:TrustedContact,changes:Partial<TrustedContact>)=>({...contact,...changes,revision:contact.revision+1});

export function inviteContact(input:unknown,owner:Actor,existing:TrustedContact[],id:string,now:string):TrustedChange{
  const data=inviteInput.parse(input),active=existing.filter(c=>c.ownerId===owner.userId&&c.status!=='REMOVED');
  const ownerEmail=owner.contacts.find(c=>c.includes('@'));
  if(!ownerEmail)fail('EMAIL_REQUIRED','Add a verified email address to your account before adding a trusted contact.',422);
  if(owner.contacts.some(c=>c.toLowerCase()===data.email))fail('SELF_CONTACT','Enter someone else’s email address. You can’t be your own trusted contact.',422);
  if(active.some(c=>c.email===data.email))fail('ALREADY_TRUSTED','This person is already one of your trusted contacts.',409);
  if(active.length>=trustedContactLimit)fail('LIMIT_REACHED',`You can have up to ${trustedContactLimit} trusted contacts. Remove one to add someone else.`,409);
  const token=invitationToken();
  return {event:'INVITED',token,contact:{id,ownerId:owner.userId,ownerName:owner.name,ownerEmail:ownerEmail!,name:data.name,email:data.email,tokenHash:sha256(token),contactUserId:null,status:'INVITED',createdAt:now,acceptedAt:null,removedAt:null,requestedAt:null,opensAt:null,sharedAt:null,closedAt:null,revision:0}};
}
/** Replaces the invitation link; the earlier link stops working. */
export function renewLink(contact:TrustedContact,owner:Actor):TrustedChange{
  asOwner(contact,owner);
  if(contact.status!=='INVITED')fail('NOT_INVITED','This person has already accepted, so they don’t need a new link.',409);
  const token=invitationToken();
  return {event:'LINK_RENEWED',token,contact:next(contact,{tokenHash:sha256(token)})};
}
export function acceptInvitation(contact:TrustedContact|null,token:string,actor:Actor,now:string):TrustedChange{
  if(!contact||contact.tokenHash!==sha256(token)||contact.status!=='INVITED')return fail('INVITATION_EXPIRED','This invitation is no longer active. Ask the person who invited you for a new link.',410);
  if(contact.ownerId===actor.userId)fail('SELF_CONTACT','This is your own invitation. Share the link with the person you added.',403);
  if(!actor.contacts.some(c=>c.toLowerCase()===contact.email))fail('INVITATION_IDENTITY_MISMATCH','Sign in with the email address this invitation was sent to.',403);
  return {event:'ACCEPTED',contact:next(contact,{status:'ACCEPTED',contactUserId:actor.userId,acceptedAt:now})};
}
export function requestAccess(contact:TrustedContact,actor:Actor,now:string):TrustedChange{
  asContact(contact,actor);
  const state=access(contact,now);
  if(state==='OPEN')fail('ALREADY_OPEN','You can already see these records.',409);
  if(state==='WAITING')fail('ALREADY_REQUESTED','You’ve already asked. Access opens on the date shown unless it’s refused.',409);
  return {event:'REQUESTED',contact:next(contact,{requestedAt:now,opensAt:new Date(Date.parse(now)+waitingDays*day).toISOString(),closedAt:null})};
}
/** Refuses a waiting request, or stops sharing records that are already open. */
export function closeAccess(contact:TrustedContact,owner:Actor,now:string):TrustedChange{
  asOwner(contact,owner);
  const state=access(contact,now);
  if(state==='NONE')fail('NOTHING_TO_CLOSE','This person can’t see your records and hasn’t asked to.',409);
  return {event:state==='WAITING'?'REFUSED':'STOPPED',contact:next(contact,{opensAt:null,sharedAt:null,closedAt:now})};
}
export function shareNow(contact:TrustedContact,owner:Actor,now:string):TrustedChange{
  asOwner(contact,owner);
  if(contact.status!=='ACCEPTED')fail('NOT_ACCEPTED','You can share once they’ve accepted your invitation.',409);
  if(access(contact,now)==='OPEN')fail('ALREADY_OPEN','This person can already see your records.',409);
  return {event:'SHARED',contact:next(contact,{sharedAt:now,opensAt:null})};
}
export function removeContact(contact:TrustedContact,actor:Actor,now:string):TrustedChange{
  const owner=contact.ownerId===actor.userId;
  if(!owner)asContact(contact,actor);
  if(contact.status==='REMOVED')fail('NOT_FOUND','This trusted contact is unavailable.',404);
  return {event:owner?'REMOVED':'LEFT',contact:next(contact,{status:'REMOVED',removedAt:now,opensAt:null,sharedAt:null})};
}

/** What the owner sees about each person they added. Never includes the invitation token. */
export type OwnerView={id:string;name:string;email:string;status:TrustedContact['status'];access:Access;requestedAt:string|null;opensAt:string|null;createdAt:string};
/** What a trusted contact sees about each person who added them. Never includes the owner's email. */
export type ContactView={id:string;ownerName:string;access:Access;opensAt:string|null;closedAt:string|null};
export const ownerView=(c:TrustedContact,now:string):OwnerView=>({id:c.id,name:c.name,email:c.email,status:c.status,access:access(c,now),requestedAt:c.requestedAt,opensAt:access(c,now)==='WAITING'?c.opensAt:null,createdAt:c.createdAt});
export const contactView=(c:TrustedContact,now:string):ContactView=>({id:c.id,ownerName:c.ownerName,access:access(c,now),opensAt:access(c,now)==='WAITING'?c.opensAt:null,closedAt:c.closedAt});

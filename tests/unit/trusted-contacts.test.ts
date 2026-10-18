import {describe,it,expect} from 'vitest';
import type {Actor} from '@/modules/agreements/types';
import {access,acceptInvitation,closeAccess,contactView,inviteContact,ownerView,removeContact,renewLink,requestAccess,shareNow} from '@/modules/trusted/model';
import {sharedRecords} from '@/modules/trusted/summary';
import {createDebt} from '@/modules/debts/model';
import {people,now,active} from '../helpers';

const owner:Actor={...people[0],contacts:['owner@example.test']};
const maryam:Actor={...people[2],name:'Maryam Bello',contacts:['maryam@example.test']};
const later=(days:number)=>new Date(Date.parse(now)+days*86400000).toISOString();
function accepted(){const invited=inviteContact({name:'Maryam Bello',email:'Maryam@Example.test'},owner,[],'c-1',now);return {token:invited.token!,contact:acceptInvitation(invited.contact,invited.token!,maryam,now).contact};}

describe('trusted contacts',()=>{
 it('invites by email and keeps only a hash of the link',()=>{
  const {contact,token,event}=inviteContact({name:'Maryam Bello',email:'Maryam@Example.test'},owner,[],'c-1',now);
  expect(event).toBe('INVITED');expect(contact.email).toBe('maryam@example.test');expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(JSON.stringify(contact)).not.toContain(token!);expect(contact.status).toBe('INVITED');expect(access(contact,now)).toBe('NONE');
 });
 it('limits each owner to two people and refuses duplicates and the owner themselves',()=>{
  const one=inviteContact({name:'Maryam Bello',email:'maryam@example.test'},owner,[],'1',now).contact,two=inviteContact({name:'Yusuf Ali',email:'yusuf@example.test'},owner,[one],'2',now).contact;
  expect(()=>inviteContact({name:'Aisha Bello',email:'aisha@example.test'},owner,[one,two],'3',now)).toThrow('up to 2');
  expect(()=>inviteContact({name:'Maryam Again',email:'MARYAM@example.test'},owner,[one],'3',now)).toThrow('already one of your');
  expect(()=>inviteContact({name:'Me Myself',email:'owner@example.test'},owner,[],'3',now)).toThrow('your own trusted contact');
  const removed={...two,status:'REMOVED' as const};
  expect(inviteContact({name:'Aisha Bello',email:'aisha@example.test'},owner,[one,removed],'3',now).contact.status).toBe('INVITED');
 });
 it('only the invited email can accept, and a renewed link replaces the old one',()=>{
  const invited=inviteContact({name:'Maryam Bello',email:'maryam@example.test'},owner,[],'c-1',now);
  expect(()=>acceptInvitation(invited.contact,invited.token!,{...people[3],contacts:['someone@example.test']},now)).toThrow('Sign in with the email address');
  expect(()=>acceptInvitation(invited.contact,invited.token!,owner,now)).toThrow('your own invitation');
  const renewed=renewLink(invited.contact,owner);
  expect(()=>acceptInvitation(renewed.contact,invited.token!,maryam,now)).toThrow('no longer active');
  const done=acceptInvitation(renewed.contact,renewed.token!,maryam,now).contact;
  expect(done.status).toBe('ACCEPTED');expect(done.contactUserId).toBe(maryam.userId);
  expect(()=>acceptInvitation(done,renewed.token!,maryam,now)).toThrow('no longer active');
 });
 it('opens access fourteen days after a request unless the owner refuses',()=>{
  const {contact}=accepted(),asked=requestAccess(contact,maryam,now);
  expect(asked.event).toBe('REQUESTED');expect(access(asked.contact,later(13.9))).toBe('WAITING');expect(access(asked.contact,later(14))).toBe('OPEN');
  expect(()=>requestAccess(asked.contact,maryam,later(1))).toThrow('already asked');
  expect(()=>requestAccess(asked.contact,owner,later(1))).toThrow('unavailable');
  const refused=closeAccess(asked.contact,owner,later(3));
  expect(refused.event).toBe('REFUSED');expect(access(refused.contact,later(20))).toBe('NONE');
  expect(access(requestAccess(refused.contact,maryam,later(4)).contact,later(18))).toBe('OPEN');
 });
 it('lets the owner share straight away and stop sharing at any time',()=>{
  const {contact}=accepted(),shared=shareNow(contact,owner,now);
  expect(access(shared.contact,now)).toBe('OPEN');
  const stopped=closeAccess(shared.contact,owner,later(1));
  expect(stopped.event).toBe('STOPPED');expect(access(stopped.contact,later(2))).toBe('NONE');
  expect(()=>closeAccess(stopped.contact,owner,later(2))).toThrow('hasn’t asked');
  expect(()=>shareNow(contact,maryam,now)).toThrow('unavailable');
 });
 it('removal by either side ends access',()=>{
  const {contact}=accepted(),open=shareNow(contact,owner,now).contact;
  const left=removeContact(open,maryam,later(1));expect(left.event).toBe('LEFT');expect(access(left.contact,later(1))).toBe('NONE');
  const removed=removeContact(open,owner,later(1));expect(removed.event).toBe('REMOVED');expect(()=>requestAccess(removed.contact,maryam,later(2))).toThrow('unavailable');
 });
 it('never shows the link to the owner or the owner’s email to the contact',()=>{
  const {contact}=accepted(),waiting=requestAccess(contact,maryam,now).contact;
  expect(ownerView(waiting,now)).toMatchObject({name:'Maryam Bello',access:'WAITING',opensAt:later(14)});
  expect(JSON.stringify(ownerView(waiting,now))).not.toContain(waiting.tokenHash);
  expect(JSON.stringify(contactView(waiting,now))).not.toContain('owner@example.test');
 });
});

describe('records a trusted contact sees',()=>{
 it('lists agreed loans both ways and private debts, without contact details or notes',()=>{
  const agreement=active(1),debt=createDebt({person:'Bilal Musa',currency:'NGN',amountMinor:'500000',date:'2026-10-01',note:'Private context',witnesses:['Yusuf Ali']},people[0].userId,'d-1',now);
  const lender=sharedRecords(people[0].userId,'Lender',[agreement],[debt]),borrower=sharedRecords(people[1].userId,'Borrower',[agreement],[]);
  expect(lender.agreements).toEqual([expect.objectContaining({ownerRole:'LENDER',otherName:'Borrower',publicId:agreement.publicId,remainingMinor:agreement.balanceMinor})]);
  expect(borrower.agreements[0]).toMatchObject({ownerRole:'BORROWER',otherName:'Lender'});
  expect(lender.debts).toEqual([expect.objectContaining({person:'Bilal Musa',remainingMinor:'500000',witnesses:['Yusuf Ali']})]);
  const text=JSON.stringify(lender);for(const p of agreement.participants)expect(text).not.toContain(p.contact);expect(text).not.toContain('Private context');
  expect(sharedRecords(people[2].userId,'Witness',[agreement],[]).agreements).toEqual([]);
 });
});

describe('the access request email',()=>{
 it('names the contact and the opening date, links to refuse, and has no amounts',async()=>{
  const {accessRequestEmail}=await import('@/modules/trusted/alerts');
  const {contact}=accepted(),change=requestAccess(contact,maryam,now),email=accessRequestEmail(change,'https://usetreeti.xyz');
  expect(email.subject).toBe('Maryam Bello asked to see your debts on treeti');
  expect(email.text).toContain('from 22 October 2026');expect(email.text).toContain('https://usetreeti.xyz/trusted-contacts');expect(email.text).not.toMatch(/NGN|₦|\d+,\d{3}/);
 });
});

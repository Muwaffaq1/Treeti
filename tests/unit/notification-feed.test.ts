import {describe,it,expect} from 'vitest';
import {notices} from '@/modules/notifications/feed';
import {projectAgreement} from '@/modules/agreements/domain';
import {pendingBorrowerInvitations} from '@/modules/agreements/pending-invitations';
import {act,active,approved,draft,people} from '../helpers';

describe('in-app notifications',()=>{
 it('tells each person what the others did, never their own actions',()=>{
  const a=approved(),lender=notices([projectAgreement(a,people[0])],[],people[0]),borrower=notices([projectAgreement(a,people[1])],[],people[1]);
  expect(lender.map(n=>n.type)).toContain('BORROWER_APPROVED');expect(lender.every(n=>n.by===people[1].name)).toBe(true);
  expect(borrower.map(n=>n.type)).not.toContain('BORROWER_APPROVED');expect(borrower.every(n=>n.by!==people[1].name)).toBe(true);
  for(const list of [lender,borrower])expect(list.some(n=>['AGREEMENT_CREATED','INVITATION_CLAIMED','INVITATION_RESENT','WITNESS_INVITED'].includes(n.type))).toBe(false);
 });
 it('orders newest first, respects the limit and ignores people outside the agreement',()=>{
  const a=active(),list=notices([projectAgreement(a,people[0])],[],people[0]);
  expect([...list].sort((x,y)=>y.createdAt.localeCompare(x.createdAt))).toEqual(list);
  expect(notices([projectAgreement(a,people[0])],[],people[0],1)).toHaveLength(1);
  expect(notices([a],[],people[4])).toEqual([]);
 });
 it('shows a waiting invitation to an invited borrower who has not opened it, without agreement details',()=>{
  const sent=act(draft(),people[0],'send').agreement,pending=pendingBorrowerInvitations(sent,people[1],sent.events.at(-1)!.createdAt),list=notices([],pending,people[1]);
  expect(list).toHaveLength(1);expect(list[0]).toMatchObject({type:'INVITED_TO_REVIEW',by:people[0].name,agreementId:null,publicId:sent.publicId});
 });
});

import {reminderMessage,waitingOn} from '@/modules/agreements/waiting-on';
import {witnessed} from '../helpers';
describe('who a party is waiting on',()=>{
 it('names the borrower who has opened but not approved, and nobody once they approve',()=>{
  const sent=act(draft(),people[0],'agree-and-send',{signature:people[0].name,affirmed:true}).agreement;
  expect(waitingOn(sent,sent.participants[0])).toEqual([]);
  const opened={...sent,participants:sent.participants.map((p,i)=>i===1?{...p,userId:people[1].userId}:p)};
  const waiting=waitingOn(opened,opened.participants[0]);expect(waiting).toHaveLength(1);expect(waiting[0].person.id).toBe(opened.participants[1].id);
  expect(reminderMessage(waiting[0],'https://usetreeti.xyz/agreements/x')).toBe('Hi Borrower, please review and approve the terms on treeti: https://usetreeti.xyz/agreements/x');
  const a=approved(0);expect(waitingOn(a,a.participants[0])).toEqual([]);
 });
 it('names the other party for an unconfirmed repayment, and never asks a witness or the person themselves',()=>{
  const a=active(),borrower=a.participants[1],lender=a.participants[0];
  const paid=act(a,people[1],'repayment',{amountMinor:'1000',date:'2026-10-08',method:'Bank transfer',reference:'',note:''}).agreement;
  expect(waitingOn(paid,borrower).map(w=>[w.person.id,w.ask])).toEqual([[lender.id,'confirm the repayment I recorded']]);
  expect(waitingOn(paid,lender)).toEqual([]);
  const pendingWitness=witnessed(),w=pendingWitness.participants.find(p=>p.role==='WITNESS')!;
  expect(waitingOn(pendingWitness,w)).toEqual([]);
 });
});

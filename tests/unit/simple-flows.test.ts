import {describe,expect,it} from 'vitest';
import {applyCommand,claimInvitation,verifyEvents} from '@/modules/agreements/domain';
import {verifyIntegrity} from '@/modules/documents/service';
import {act,active,approved,draft,now,people} from '../helpers';
import type {Actor,Aggregate} from '@/modules/agreements/types';
const command=(a:Aggregate,actor:Actor,action:string,extra:Record<string,unknown>={},time=now)=>applyCommand(a,{action,expectedVersionId:a.currentVersionId,...extra},{actor,now:time}).agreement;
const payment=(a:Aggregate,closeAgreement=false,amountMinor=a.balanceMinor)=>command(a,people[1],'repayment',{amountMinor,date:'2026-10-08',method:'Cash',closeAgreement});

describe('simple verified-session flows',()=>{
 it('records lender consent and invitation together, but never silently approves a plain send',()=>{
  const a=draft(0),before=structuredClone(a);
  expect(()=>command(a,people[0],'agree-and-send',{affirmed:false,signature:'Lender'})).toThrow('confirm');expect(a).toEqual(before);
  expect(()=>command(a,people[4],'agree-and-send',{affirmed:true,signature:'Other'})).toThrow('access');
  const result=applyCommand(a,{action:'agree-and-send',expectedVersionId:a.currentVersionId,affirmed:true,signature:'Lender'},{actor:people[0],now});
  expect(result.invitation).toBeDefined();expect(result.agreement.approvals).toHaveLength(1);expect(result.agreement.approvals[0].authenticationLevel).toBe('VERIFIED_EMAIL_SESSION');expect(result.agreement.status).toBe('AWAITING_BORROWER');
  expect(act(a,people[0],'send').agreement.approvals).toHaveLength(0);
  const claimed=claimInvitation(result.agreement,result.invitation!.token,{actor:people[1],now});expect(claimed.finalizedAt).toBeNull();
  const agreed=command(claimed,people[1],'approve',{affirmed:true,signature:'Borrower'});expect(agreed.status).toBe('ACTIVE');expect(verifyIntegrity(agreed)).toBe(true);
 });
 it('keeps witness access scoped after a long read and finalizes exactly once without another code',()=>{
  const r=act(approved(),people[0],'invite-witness',{name:people[2].name,contact:people[2].contacts[0]});
  const claimed=claimInvitation(r.agreement,r.invitation!.token,{actor:people[2],now});
  const signed=command(claimed,people[2],'attest',{educated:true,affirmed:true,signature:people[2].name},'2026-10-08T12:45:00.000Z');
  expect(signed.status).toBe('ACTIVE');expect(signed.attestations[0].authenticationLevel).toBe('VERIFIED_EMAIL_SESSION');expect(signed.events.filter(e=>e.type==='AGREEMENT_FINALIZED')).toHaveLength(1);expect(verifyIntegrity(signed)).toBe(true);
  expect(command(signed,people[0],'finalize')).toEqual(signed);
  expect(()=>command(claimed,{...people[2],contacts:[]},'attest',{educated:true,affirmed:true,signature:people[2].name})).toThrow('verified contact');
  const stale=structuredClone(claimed);stale.participants.find(p=>p.userId===people[2].userId)!.versionIds=[];expect(()=>command(stale,people[2],'attest',{educated:true,affirmed:true,signature:people[2].name})).toThrow('current version');
 });
 it('closes only after a confirmed final payment and two explicit closure consents',()=>{
  const a=payment(active(0),true);expect(a.settlements).toHaveLength(0);expect(a.balanceMinor).toBe('30000000');
  const b=command(a,people[0],'confirm-repayment',{targetId:a.repayments[0].id,closeAgreement:true},'2026-10-08T13:00:00.000Z');
  expect(b.status).toBe('SETTLED');expect(b.settlements).toHaveLength(2);expect(b.settlements[0]).toMatchObject({affirmedAt:now,createdAt:'2026-10-08T13:00:00.000Z',repaymentId:a.repayments[0].id,authenticationLevel:'VERIFIED_EMAIL_SESSION'});expect(verifyEvents(b.events)).toBe(true);expect(b.manifest).toEqual(a.manifest);
 });
 it.each([false,true])('never infers the missing party’s closure consent (proposal opted in: %s)',optedIn=>{
  const a=payment(active(0),optedIn);const b=command(a,people[0],'confirm-repayment',{targetId:a.repayments[0].id,closeAgreement:!optedIn});expect(b.status).toBe('SETTLEMENT_PENDING');expect(b.settlements).toHaveLength(1);
  const missing=optedIn?people[0]:people[1];expect(command(b,missing,'settle',{affirmed:true}).status).toBe('SETTLED');
 });
 it('keeps legacy payments without any closure consent ready for both acknowledgments',()=>{
  const a=payment(active(0));delete a.repayments[0].settlementIntent;const b=command(a,people[0],'confirm-repayment',{targetId:a.repayments[0].id});expect(b.status).toBe('SETTLEMENT_PENDING');expect(b.settlements).toHaveLength(0);
 });
 it('cannot close a partial or disputed payment, or confirm one’s own payment',()=>{
  expect(()=>payment(active(0),true,'100')).toThrow('full remaining');
  const full=payment(active(0),true);expect(()=>command(full,people[1],'confirm-repayment',{targetId:full.repayments[0].id,closeAgreement:true})).toThrow('other party');
  const disputed=command(full,people[0],'dispute-repayment',{targetId:full.repayments[0].id,note:'Please check the payment'});expect(disputed.status).toBe('ACTIVE');expect(disputed.settlements).toHaveLength(0);
  const partial=payment(active(0),false,'100');expect(()=>command(partial,people[0],'confirm-repayment',{targetId:partial.repayments[0].id,closeAgreement:true})).toThrow('full remaining');
 });
});

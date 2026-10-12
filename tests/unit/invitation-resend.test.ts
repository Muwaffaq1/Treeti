import {describe,it,expect} from 'vitest';
import {applyCommand,claimInvitation,projectAgreement,verifyEvents} from '@/modules/agreements/domain';
import {canResendInvitation,needsInvitationResponse} from '@/modules/agreements/invitation-resend';
import {act,active,approved,draft,people,now} from '../helpers';
import type {Aggregate} from '@/modules/agreements/types';
const later=new Date(Date.parse(now)+61000).toISOString();
const resend=(a:Aggregate,recipientId:string,actor=people[0],time=later)=>applyCommand(a,{action:'resend-invitation',expectedVersionId:a.currentVersionId,targetId:recipientId},{actor,now:time});
describe('resending the current invitation',()=>{
 it('renews an expired borrower link without changing terms, status or approvals',()=>{
  const sent=act(draft(),people[0],'agree-and-send',{signature:people[0].name,affirmed:true}),a=sent.agreement,borrower=a.participants[1];
  const result=resend(a,borrower.id,people[0],new Date(Date.parse(now)+8*86400000).toISOString());
  expect(result.invitation!.token).not.toBe(sent.invitation!.token);expect(result.agreement.invitations[0].status).toBe('REVOKED');
  expect(result.agreement.versions).toEqual(a.versions);expect(result.agreement.approvals).toEqual(a.approvals);expect(result.agreement.status).toBe(a.status);
  expect(result.agreement.outbox.filter(o=>o.eventType==='INVITATION_DELIVERY')).toHaveLength(2);expect(verifyEvents(result.agreement.events)).toBe(true);
  expect(()=>claimInvitation(result.agreement,sent.invitation!.token,{actor:people[1],now:later})).toThrow('no longer active');
  expect(claimInvitation(result.agreement,result.invitation!.token,{actor:people[1],now:result.agreement.events.at(-1)!.createdAt}).participants[1].userId).toBe(people[1].userId);
 });
 it('enforces a per-recipient cooldown including already-claimed links',()=>{
  const sent=act(draft(),people[0],'send'),a=claimInvitation(sent.agreement,sent.invitation!.token,{actor:people[1],now});
  expect(()=>resend(a,a.participants[1].id,people[0],now)).toThrow('wait one minute');
  const result=resend(a,a.participants[1].id);expect(result.agreement.invitations[0].status).toBe('CLAIMED');
  expect(()=>resend(result.agreement,a.participants[1].id)).toThrow('wait one minute');
 });
 it('lets a verified borrower remind the lender without signing on their behalf',()=>{
  const sent=act(draft(),people[0],'send'),a=claimInvitation(sent.agreement,sent.invitation!.token,{actor:people[1],now}),result=resend(a,a.participants[0].id,people[1]);
  expect(result.agreement.approvals).toHaveLength(0);expect(result.agreement.status).toBe(a.status);expect(result.agreement.invitations.at(-1)!.destination).toBe(people[0].contacts[0]);
 });
 it('allows only pending witnesses and preserves a completed witness response',()=>{
  const invited=act(approved(2),people[0],'invite-witnesses',{witnesses:people.slice(2,4).map(p=>({name:p.name,contact:p.contacts[0]}))});
  let a=claimInvitation(invited.agreement,invited.invitations![0].token,{actor:people[2],now});
  a=act(a,people[2],'attest',{educated:true,affirmed:true,signature:people[2].name}).agreement;
  const done=a.participants.find(p=>p.userId===people[2].userId)!,pending=a.participants.find(p=>p.contact===people[3].contacts[0])!;
  expect(()=>resend(a,done.id)).toThrow('awaiting');const result=resend(a,pending.id,people[1]);
  expect(result.agreement.attestations).toEqual(a.attestations);expect(result.agreement.approvals).toEqual(a.approvals);
  expect(canResendInvitation(projectAgreement(a,people[0]),a.participants[0],pending)).toBe(true);
  expect(()=>resend(a,pending.id,people[2])).toThrow('Only the lender');
 });
 it('does not resend declined, completed, draft or closed proposals, or let people invite themselves',()=>{
  const sent=act(draft(),people[0],'send').agreement;
  for(const status of ['DRAFT','CHANGES_REQUESTED','CANCELLED','DECLINED'] as const)expect(()=>resend({...sent,status},sent.participants[1].id)).toThrow();
  expect(()=>resend(sent,sent.participants[0].id)).toThrow('awaiting');expect(()=>resend(sent,sent.participants[1].id,people[4])).toThrow('access');
  const a=active();expect(needsInvitationResponse(a,a.participants[1])).toBe(false);expect(()=>resend(a,a.participants[1].id)).toThrow('Finalized');
  const invited=act(approved(),people[0],'invite-witness',{name:people[2].name,contact:people[2].contacts[0]});
  let b=claimInvitation(invited.agreement,invited.invitation!.token,{actor:people[2],now});b=act(b,people[2],'decline-witness').agreement;
  expect(()=>resend(b,b.participants.find(p=>p.userId===people[2].userId)!.id)).toThrow('awaiting');
 });
 it('rejects stale-version resends and stops queued mail once a response is recorded',()=>{
  const sent=act(draft(),people[0],'send').agreement;
  expect(()=>applyCommand(sent,{action:'resend-invitation',targetId:sent.participants[1].id,expectedVersionId:crypto.randomUUID()},{actor:people[0],now:later})).toThrow('changed');
  const a=approved();expect(needsInvitationResponse(a,a.participants[1])).toBe(false);
 });
});

import {describe,expect,it} from 'vitest';
import {sameContact} from '@/lib/contact';
import {codeInvitation} from '@/lib/invitation-access';
import {claimInvitation,createAgreement} from '@/modules/agreements/domain';
import {act,draft,input,now,people,terms} from '../helpers';

describe('invitation contacts',()=>{
  it('treats addresses that reach the same inbox as the same person',()=>{
    expect(sameContact('Ab.Dul+treeti@gmail.com','abdul@googlemail.com ')).toBe(true);
    expect(sameContact('abdul@gmail.com','abdu1@gmail.com')).toBe(false);
    // Outside Gmail, dots and plus tags can be different people.
    expect(sameContact('a.b@example.com','ab@example.com')).toBe(false);
    expect(sameContact('ab+x@example.com','ab@example.com')).toBe(false);
  });
  it('lets a borrower open their invitation with a code sent to the invited address',()=>{
    const r=act(draft(),people[0],'send'),token=r.invitation!.token;
    const found=codeInvitation(r.agreement,token,now);
    expect(found.action).toBe('review');expect(found.participant.role).toBe('BORROWER');
  });
  it('accepts the Gmail address the borrower actually signs in with',()=>{
    const a=createAgreement({...input,borrowerContact:'ab.dul@gmail.com',terms:{...terms,requiredWitnesses:0}},{actor:people[0],now},'TREETI-GMAIL');
    const r=act(a,people[0],'send'),borrower={...people[1],contacts:['abdul@gmail.com']};
    const claimed=claimInvitation(r.agreement,r.invitation!.token,{actor:borrower,now});
    expect(claimed.participants.find(p=>p.role==='BORROWER')!.userId).toBe(borrower.userId);
    expect(()=>claimInvitation(r.agreement,r.invitation!.token,{actor:{...people[1],contacts:['someone@gmail.com']},now})).toThrow(/Verify the email address/);
  });
});

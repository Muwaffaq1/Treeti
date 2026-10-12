import {describe,it,expect} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {groupMoneyInput,moneyEdit,parseMoney} from '@/lib/money';
import {recurringPlan,installmentProgress} from '@/modules/agreements/repayment-plan';
import {termsSchema} from '@/modules/agreements/schema';
import {createAgreement,claimInvitation} from '@/modules/agreements/domain';
import {verifyIntegrity} from '@/modules/documents/service';
import {renderAgreement} from '@/modules/documents/pdf';
import type {Terms} from '@/modules/agreements/types';
import {terms,people,input,now,act,approved} from '../helpers';

const planTerms=():Terms=>({...terms,principalMinor:'100001',dueDate:'2027-03-31',requiredWitnesses:2,repaymentType:'INSTALLMENTS',installments:recurringPlan('100001','2027-01-31',3,'MONTHLY')});
describe('formatted amounts and immutable repayment schedules',()=>{
  it('keeps decimals, trailing zeros, intermediate input and invalid pasted text intact',()=>{
    for(const [raw,expected] of [['1234567.00','1,234,567.00'],['1000.','1,000.'],['1000.123','1,000.123'],['.','.'],['-1234','-1234'],['1e4','1e4'],['','']]){
      expect(groupMoneyInput(raw)).toBe(expected);
    }
    expect(parseMoney(groupMoneyInput('1234567.01'))).toBe('123456701');
    expect(moneyEdit('129,345',2)).toEqual({value:'129,345',caret:2});
    expect(moneyEdit('1234',2)).toEqual({value:'1,234',caret:3});
  });
  it('splits exact minor units and anchors monthly dates through short months and leap years',()=>{
    const plan=recurringPlan('100001','2027-01-31',3,'MONTHLY');
    expect(plan.payments).toEqual([{dueDate:'2027-01-31',amountMinor:'33333'},{dueDate:'2027-02-28',amountMinor:'33333'},{dueDate:'2027-03-31',amountMinor:'33335'}]);
    expect(recurringPlan('3','2028-01-31',3,'MONTHLY').payments[1].dueDate).toBe('2028-02-29');
    expect(recurringPlan('2','2026-12-28',2,'WEEKLY').payments[1].dueDate).toBe('2027-01-04');
    expect(()=>recurringPlan('1','2027-01-01',2,'MONTHLY')).toThrow('one minor currency unit');
    expect(()=>recurringPlan('100','2027-02-30',2,'MONTHLY')).toThrow('valid');
    expect(()=>recurringPlan('100','2027-01-01',61,'MONTHLY')).toThrow('60');
  });
  it('rejects inconsistent or malformed schedules on the server without throwing conversion errors',()=>{
    expect(termsSchema.safeParse(planTerms()).success).toBe(true);
    const altered=(edit:(t:Terms)=>void)=>{const t=planTerms();edit(t);expect(termsSchema.safeParse(t).success).toBe(false);};
    altered(t=>{delete t.installments;});
    altered(t=>{t.repaymentType='SINGLE';});
    altered(t=>{t.installments!.payments[0].amountMinor='33334';});
    altered(t=>{t.installments!.payments[0].amountMinor='0';});
    altered(t=>{t.installments!.payments[1].dueDate='2027-03-01';});
    altered(t=>{t.dueDate='2027-04-01';});
    altered(t=>{t.agreementDate='2027-02-01';});
    altered(t=>{t.principalMinor='invalid';});
    altered(t=>{t.installments!.payments[0].amountMinor='invalid';});
    altered(t=>{t.installments!.frequency='CUSTOM';t.installments!.payments[1].dueDate='2027-01-31';});
    const custom=planTerms();custom.installments!.frequency='CUSTOM';custom.installments!.payments[1].dueDate='2027-03-01';
    expect(termsSchema.safeParse(custom).success).toBe(true);
    expect(termsSchema.parse(terms)).toEqual(terms);
  });
  it('binds schedule changes to new hashes and requires fresh approvals',()=>{
    const draft=createAgreement({...input,terms:planTerms()},{actor:people[0],now},'TREETI-2026-PLAN1');
    const a=approved(2,draft),before=structuredClone(a.versions[0]);
    const changed=planTerms();changed.installments!.frequency='CUSTOM';changed.installments!.payments[1].dueDate='2027-03-01';
    const b=act(a,people[0],'version',{terms:changed,reason:'Different payment date'}).agreement;
    expect(b.versions[0]).toEqual(before);expect(b.versions[1].hash).not.toBe(before.hash);
    expect(b.versions[1].text).toContain('2027-03-01');expect(b.versions[1].payload.schema).toBe('ahd-terms-v3');
    expect(()=>act(b,people[0],'finalize')).toThrow('Both parties');
  });
  it('finalizes a scheduled version with two digital witnesses, preserves PDF and ignores unconfirmed payments',async()=>{
    let a=approved(2,createAgreement({...input,terms:planTerms()},{actor:people[0],now},'TREETI-2026-PLAN2'));
    const invite=act(a,people[0],'invite-witnesses',{witnesses:[2,3].map(i=>({name:people[i].name,contact:people[i].contacts[0]}))});a=invite.agreement;
    for(const [i,link] of invite.invitations!.entries()){const actor=people[i+2];a=claimInvitation(a,link.token,{actor,now});a=act(a,actor,'attest',{educated:true,affirmed:true,signature:actor.name}).agreement;}
    a=act(a,people[0],'finalize').agreement;expect(verifyIntegrity(a)).toBe(true);
    const bytes=await renderAgreement(a,'pdf',null,true);await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/treeti-installment-agreement.pdf',bytes);
    const payments=a.manifest!.version.terms.installments!.payments;
    a=act(a,people[1],'repayment',{amountMinor:'40000',date:'2026-10-08',method:'Cash'}).agreement;
    expect(installmentProgress(a,payments).map(p=>p.remainingMinor)).toEqual(['33333','33333','33335']);
    a=act(a,people[0],'confirm-repayment',{targetId:a.repayments[0].id}).agreement;
    expect(installmentProgress(a,payments).map(p=>p.remainingMinor)).toEqual(['0','26666','33335']);
    expect(a.balanceMinor).toBe('60001');expect(await renderAgreement(a,'pdf',null,true)).toEqual(bytes);
    a=act(a,people[1],'repayment',{amountMinor:'60001',date:'2026-10-08',method:'Cash'}).agreement;
    a=act(a,people[0],'confirm-repayment',{targetId:a.repayments[1].id}).agreement;
    expect(a.status).toBe('SETTLEMENT_PENDING');
    for(const actor of people.slice(0,2))a=act(a,actor,'settle',{affirmed:true}).agreement;
    expect(a.status).toBe('SETTLED');expect(verifyIntegrity(a)).toBe(true);
  },30000);
});

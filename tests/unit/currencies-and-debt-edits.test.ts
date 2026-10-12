import {describe,it,expect} from 'vitest';
import {mkdir,writeFile} from 'node:fs/promises';
import {renderAgreement} from '@/modules/documents/pdf';
import {currencies} from '@/lib/currencies';
import {money} from '@/lib/money';
import {termsSchema} from '@/modules/agreements/schema';
import {createAgreement} from '@/modules/agreements/domain';
import {digitalWitnessStatement,usesDigitalWitnesses} from '@/modules/agreements/witness-policy';
import {recurringPlan,allocateInstallments} from '@/modules/agreements/repayment-plan';
import {createDebt,editDebt,recordDebtPayment,debtRemaining} from '@/modules/debts/model';
import {input,terms,people,now,act,approved} from '../helpers';
const debtInput={person:'A private lender',currency:'USD',amountMinor:'100001',date:'2026-09-01',note:'Original record'};
describe('agreement currencies',()=>{
 it('accepts the ten currencies and preserves their units in wording and version evidence',()=>{
  for(const currency of currencies){const a=createAgreement({...input,terms:{...terms,currency}},{actor:people[0],now},'TREETI-TEST');expect(termsSchema.parse(a.versions[0].terms).currency).toBe(currency);expect(a.versions[0].text).toContain(money(terms.principalMinor,currency));expect(a.versions[0].text).toContain(`interest is ${money('0',currency)}`);expect(usesDigitalWitnesses(a.versions[0])).toBe(true);expect(digitalWitnessStatement(a.versions[0])).toContain(money(terms.principalMinor,currency));expect(a.versions[0].payload.schema).toBe(currency==='NGN'?'ahd-terms-v2':'treeti-terms-v4');}
  expect(termsSchema.safeParse({...terms,currency:'JPY'}).success).toBe(false);expect(money('100001','USD')).toBe('USD 1,000.01');expect(money('100001','CAD')).toBe('CAD 1,000.01');
 });
 it('keeps exact non-NGN installments and frozen approvals when repayment starts',async()=>{
  const installments=recurringPlan('100001','2027-01-31',3,'MONTHLY');let a=createAgreement({...input,terms:{...terms,currency:'EUR',principalMinor:'100001',requiredWitnesses:0,repaymentType:'INSTALLMENTS',dueDate:'2027-03-31',installments}},{actor:people[0],now},'TREETI-EUR');a=approved(0,a);const manifest=structuredClone(a.manifest);a=act(a,people[1],'repayment',{amountMinor:'1',date:'2026-10-08',method:'Cash'}).agreement;a=act(a,people[0],'confirm-repayment',{targetId:a.repayments[0].id}).agreement;expect(a.balanceMinor).toBe('100000');expect(a.manifest).toEqual(manifest);expect(a.versions[0].text).toContain('EUR 333.35');const pdf=await renderAgreement(a,'pdf',null,true);expect(pdf.subarray(0,4).toString()).toBe('%PDF');await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/treeti-qa-eur.pdf',pdf);await writeFile('output/pdf/treeti-qa-eur-receipt.pdf',await renderAgreement(a,'receipt',a.repayments[0].id,true));
 });
 it('a currency change creates a new unapproved version rather than mutating the earlier one',()=>{
  const a=createAgreement(input,{actor:people[0],now},'TREETI-DRAFT'),original=structuredClone(a.versions[0]);const next=act(a,people[0],'version',{terms:{...terms,currency:'GBP'},reason:'Correct currency'}).agreement;expect(next.versions[0]).toEqual(original);expect(next.versions[1].terms.currency).toBe('GBP');expect(next.versions[1].hash).not.toBe(original.hash);expect(next.approvals).toHaveLength(0);
 });
});
describe('editable private debts and repayment plans',()=>{
 it('supports an optional due date and exact weekly, monthly or custom plans',()=>{
  for(const frequency of ['WEEKLY','MONTHLY','CUSTOM'] as const){const installments=recurringPlan('100001','2027-01-31',3,frequency==='CUSTOM'?'MONTHLY':frequency);installments.frequency=frequency;const d=createDebt({...debtInput,installments},'owner','debt',now),paid=recordDebtPayment(d,{amountMinor:'33334',date:'2026-10-08'},'owner','payment',now);expect(allocateInstallments(paid.installments!.payments,'33334').map(p=>p.remainingMinor)).toEqual(['0','33332','33335']);expect(debtRemaining(paid)).toBe('66667');}
  expect(createDebt({...debtInput,dueDate:'2027-01-01'},'owner','debt',now).dueDate).toBe('2027-01-01');
  expect(()=>createDebt({...debtInput,dueDate:'2027-01-01',installments:recurringPlan('100001','2027-01-01',2,'MONTHLY')},'owner','debt',now)).toThrow();
  expect(()=>createDebt({...debtInput,installments:recurringPlan('100000','2027-01-01',2,'MONTHLY')},'owner','debt',now)).toThrow('full original amount');
 });
 it('corrects an unpaid record, preserves identity and rejects stale/foreign edits',()=>{
  const original=createDebt({...debtInput,dueDate:'2027-01-01'},'owner','debt',now);const updated=editDebt(original,{...debtInput,person:'Correct name',currency:'GBP',amountMinor:'200000',expectedRevision:0},'owner',now);expect(updated.id).toBe(original.id);expect(updated.createdAt).toBe(original.createdAt);expect(updated.dueDate).toBeUndefined();expect(updated.currency).toBe('GBP');expect(updated.revision).toBe(1);expect(original.person).toBe('A private lender');
  expect(()=>editDebt(updated,{...debtInput,expectedRevision:0},'owner',now)).toThrow('changed since');expect(()=>editDebt(updated,{...debtInput,expectedRevision:1},'someone-else',now)).toThrow('unavailable');
 });
 it('preserves payments and prevents edits that reinterpret or invalidate them',()=>{
  const original=createDebt(debtInput,'owner','debt',now),paid=recordDebtPayment(original,{amountMinor:'40000',date:'2026-10-01',note:'Preserve this'},'owner','payment',now),edited=editDebt(paid,{...debtInput,amountMinor:'90000',expectedRevision:0,installments:recurringPlan('90000','2027-01-01',3,'MONTHLY')},'owner',now);expect(edited.payments).toEqual(paid.payments);expect(debtRemaining(edited)).toBe('50000');expect(edited.installments?.payments).toHaveLength(3);
  expect(()=>editDebt(paid,{...debtInput,currency:'GBP',expectedRevision:0},'owner',now)).toThrow('currency cannot change');expect(()=>editDebt(paid,{...debtInput,amountMinor:'39999',expectedRevision:0},'owner',now)).toThrow('cannot be less');expect(()=>editDebt(paid,{...debtInput,date:'2026-10-02',expectedRevision:0},'owner',now)).toThrow('earliest');expect(()=>editDebt(paid,{...debtInput,date:'2026-11-01',expectedRevision:0},'owner',now)).toThrow('today');
 });
});

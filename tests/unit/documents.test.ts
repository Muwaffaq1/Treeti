import {describe,it,expect} from 'vitest';
import {writeFile,mkdir,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {DemoRepository} from '@/modules/agreements/demo';
import {createAgreement} from '@/modules/agreements/domain';
import {recurringPlan} from '@/modules/agreements/repayment-plan';
import {digest} from '@/lib/crypto';
import {verifyIntegrity} from '@/modules/documents/service';
import {renderAgreement,receiptBalance} from '@/modules/documents/pdf';
import {active,act,people,witnessed,terms,now,approved} from '../helpers';
describe('frozen evidence and documents',()=>{
 it('renders the redesigned agreement with witnesses and the maximum installment schedule',async()=>{
  const demo=new DemoRepository(randomUUID());
  try{const a=(await demo.all())[0],frozen=structuredClone(a.manifest);const bytes=await renderAgreement(a,'pdf',null,true);expect(a.manifest).toEqual(frozen);await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/treeti-agreement-preview.pdf',bytes);}finally{await unlink(demo.path);}
  const installments=recurringPlan('99999999999999','2027-01-31',60,'MONTHLY');
  const initial=createAgreement({borrowerName:people[1].name,borrowerContact:people[1].contacts[0],terms:{...terms,currency:'GBP',principalMinor:'99999999999999',repaymentType:'INSTALLMENTS',installments,dueDate:installments.payments.at(-1)!.dueDate,requiredWitnesses:0,purpose:'A contribution to a family business. '.repeat(5),additionalTerms:'Both parties will discuss any changes to these repayment arrangements together. '.repeat(20)}},{actor:people[0],now},'TREETI-PDF-STRESS');
  const a=approved(0,initial),bytes=await renderAgreement(a,'pdf',null,true);expect(a.manifest).toBeTruthy();expect(bytes.subarray(0,4).toString()).toBe('%PDF');await mkdir('output/qa/pdf',{recursive:true});await writeFile('output/qa/pdf/long-installments.pdf',bytes);
 },30000);
 it('checks manifest, audit chain, exact party roles, original version and requested witnesses',()=>{
  const a=active();expect(verifyIntegrity(a)).toBe(true);
  const altered=structuredClone(a);altered.versions[0].text='Changed terms';expect(verifyIntegrity(altered)).toBe(false);
  const duplicated=structuredClone(a);duplicated.manifest!.approvals[1]=duplicated.manifest!.approvals[0];const {hash,...m}=duplicated.manifest!;expect(hash).toBeTruthy();duplicated.manifest!.hash=digest(m);expect(verifyIntegrity(duplicated)).toBe(false);
  const omitted=structuredClone(a);omitted.manifest!.attestations=[];const {hash:omittedHash,...n}=omitted.manifest!;expect(omittedHash).toBeTruthy();omitted.manifest!.hash=digest(n);expect(verifyIntegrity(omitted)).toBe(false);
 });
 it('rejects a digital presence or statement substitution even if the manifest hash is recomputed',()=>{
  for(const change of [{presence:'IN_PERSON'},{type:'REVIEW_ONLY'},{text:'I personally witnessed the funds being handed over.'}]){
   const a=active();Object.assign(a.manifest!.attestations[0],change);const {hash,...manifest}=a.manifest!;expect(hash).toBeTruthy();a.manifest!.hash=digest(manifest);expect(verifyIntegrity(a)).toBe(false);
  }
 });
 it('keeps legacy finalized statements and PDF bytes unchanged after later financial activity',async()=>{
  const a=act(witnessed('FORMATION'),people[0],'finalize').agreement,frozen=structuredClone(a.manifest),before=await renderAgreement(a,'pdf',null,true);
  expect(verifyIntegrity(a)).toBe(true);expect(a.manifest!.attestations[0].text).toContain('personally witnessed');
  const b=act(a,people[1],'repayment',{amountMinor:'100',date:'2026-10-08',method:'Cash'}).agreement;
  expect(b.manifest).toEqual(frozen);expect(await renderAgreement(b,'pdf',null,true)).toEqual(before);
 },30000);
 it('generates a reproducible PDF from finalized state, unaffected by later payments',async()=>{
  const a=active();const before=await renderAgreement(a,'pdf',null,true);
  let b=act(a,people[1],'repayment',{amountMinor:'10000000',date:'2026-10-08',method:'Cash'}).agreement;b=act(b,people[0],'confirm-repayment',{targetId:b.repayments[0].id}).agreement;
  expect(await renderAgreement(b,'pdf',null,true)).toEqual(before);expect(before.subarray(0,4).toString()).toBe('%PDF');
  await mkdir('output/pdf',{recursive:true});await writeFile('output/pdf/ahd-demonstration-agreement.pdf',before);
  expect(receiptBalance(b,b.repayments[0].id)).toBe('20000000');
  const receipt=await renderAgreement(b,'receipt',b.repayments[0].id,true);await writeFile('output/pdf/ahd-demonstration-receipt.pdf',receipt);
  b=act(b,people[0],'forgiveness',{amountMinor:'20000000',reason:'With care'}).agreement;b=act(b,people[1],'confirm-forgiveness',{targetId:b.adjustments[0].id}).agreement;
  expect(receiptBalance(b,b.repayments[0].id)).toBe('20000000');
  b=act(b,people[0],'settle',{affirmed:true}).agreement;b=act(b,people[1],'settle',{affirmed:true}).agreement;
  await writeFile('output/pdf/ahd-demonstration-settlement.pdf',await renderAgreement(b,'settlement',null,true));
 },30000);
});

import {describe,it,expect} from 'vitest';
import {createDebt,editDebt} from '@/modules/debts/model';
import {interestWording,affirmation as clientAffirmation} from '@/components/agreement-utils';
import {affirmation,createAgreement} from '@/modules/agreements/domain';
import {input,people,now,act} from '../helpers';

const debt={person:'Maryam Bello',currency:'NGN',amountMinor:'500000',date:'2026-10-01',note:''};

describe('private debt witnesses',()=>{
 it('saves up to four witness names and keeps older records without witnesses valid',()=>{
  const saved=createDebt({...debt,witnesses:['Yusuf Ali','  Aisha Bello  ']},'owner','debt-1',now);
  expect(saved.witnesses).toEqual(['Yusuf Ali','Aisha Bello']);
  expect(createDebt(debt,'owner','debt-2',now).witnesses).toBeUndefined();
  expect(()=>createDebt({...debt,witnesses:['A','B','C','D','E'].map(n=>`${n} Witness`)},'owner','debt-3',now)).toThrow();
  expect(()=>createDebt({...debt,witnesses:['Y']},'owner','debt-4',now)).toThrow();
 });
 it('lets the owner change witnesses when editing',()=>{
  const saved=createDebt({...debt,witnesses:['Yusuf Ali']},'owner','debt-1',now);
  const edited=editDebt(saved,{...debt,witnesses:[],expectedRevision:0},'owner',now);
  expect(edited.witnesses).toEqual([]);expect(edited.revision).toBe(1);
 });
});

describe('interest-free safeguards',()=>{
 it('flags interest-like wording but not interest-free statements',()=>{
  expect(interestWording('Borrower pays 10% interest monthly')).toEqual(['10%','interest']);
  expect(interestWording('A late payment penalty applies','','2.5 % profit share')).toEqual(['penalty','2.5 %','profit']);
  expect(interestWording('Interest-free. No fees, without interest, 0% interest.',undefined)).toEqual([]);
  expect(interestWording('Early repayment is welcome. I am interested in helping.')).toEqual([]);
 });
 it('records the no-interest declaration with each party approval',()=>{
  let a=createAgreement({...input,terms:{...input.terms,requiredWitnesses:0}},{actor:people[0],now},'TREETI-RIBA');
  a=act(a,people[0],'agree-and-send',{affirmed:true,signature:people[0].name}).agreement;
  const lender=a.approvals.at(-1)!;
  expect(lender.affirmation).toContain('interest-free');expect(lender.affirmationVersion).toBe('LENDER_ACCEPT_V2');
  expect(affirmation('BORROWER')).toContain('I will repay only the amount I borrowed');
  expect(clientAffirmation('LENDER')).toBe(affirmation('LENDER'));expect(clientAffirmation('BORROWER')).toBe(affirmation('BORROWER'));
 });
});

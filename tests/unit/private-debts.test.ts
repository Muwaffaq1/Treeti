import {describe,it,expect} from 'vitest';
import {createDebt,recordDebtPayment,debtRemaining,debtTotals,debtMoney} from '@/modules/debts/model';
const now='2026-10-08T12:00:00Z',input={person:'Maryam Bello',currency:'NGN',amountMinor:'100000',date:'2026-09-01',note:'Earlier loan'};
describe('private debt bookkeeping',()=>{
 it('keeps exact principal, repayment history and separate currency totals',()=>{
  const debt=createDebt(input,'owner','debt',now),paid=recordDebtPayment(debt,{amountMinor:'25025',date:'2026-10-01'},'owner','payment',now),dollars=createDebt({...input,currency:'USD',amountMinor:'30000'},'owner','usd',now);
  expect(debtRemaining(paid)).toBe('74975');expect(debt.payments).toHaveLength(0);expect(debtTotals([paid,dollars])).toEqual([{currency:'NGN',amountMinor:'74975'},{currency:'USD',amountMinor:'30000'}]);
  expect(debtMoney('99999999999999','USD')).toBe('USD 999,999,999,999.99');
  expect(debtRemaining(recordDebtPayment(paid,{amountMinor:'74975',date:'2026-10-08'},'owner','final',now))).toBe('0');
 });
 it('rejects excess payments, invalid dates and unsupported currencies',()=>{
  const debt=createDebt(input,'owner','debt',now);
  expect(()=>recordDebtPayment(debt,{amountMinor:'100001',date:'2026-10-01'},'owner','payment',now)).toThrow('more than');
  expect(()=>recordDebtPayment(debt,{amountMinor:'1',date:'2026-11-01'},'owner','payment',now)).toThrow('today or earlier');
  expect(()=>recordDebtPayment(debt,{amountMinor:'1',date:'2026-08-01'},'owner','payment',now)).toThrow('on or after');
  expect(()=>createDebt({...input,date:'2026-02-30'},'owner','debt',now)).toThrow();
  expect(()=>createDebt({...input,currency:'JPY'},'owner','debt',now)).toThrow();
  expect(()=>recordDebtPayment(debt,{amountMinor:'1',date:'2026-10-01'},'other','payment',now)).toThrow('unavailable');
 });
});

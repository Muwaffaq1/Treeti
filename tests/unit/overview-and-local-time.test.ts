import {it,expect} from 'vitest';
import {agreementBalances,activityFormatters} from '@/components/agreement-utils';
import {createAgreement} from '@/modules/agreements/domain';
import {input,people,now} from '../helpers';
it('separates money owed to me and money I owe, without mixing currencies or witnesses',()=>{
 const make=(currency:string,balance:string,role:'LENDER'|'BORROWER'|'WITNESS',status='ACTIVE')=>{
  const a=createAgreement({...input,terms:{...input.terms,currency}},{actor:people[0],now},'TREETI-TEST');
  a.status=status as typeof a.status;a.balanceMinor=balance;a.participants[0].role=role;return a;
 };
 const result=agreementBalances([make('NGN','2000000','LENDER'),make('GBP','130001','LENDER'),make('NGN','500000','BORROWER'),make('GBP','1','BORROWER','SETTLEMENT_PENDING'),make('NGN','9000000','WITNESS'),make('USD','9000000','LENDER','CANCELLED'),make('GBP','9000000','LENDER','DRAFT'),make('GBP','0','LENDER','SETTLED')],people[0].userId);
 expect([...result.owedToYou.totals]).toEqual([['GBP',130001n],['NGN',2000000n]]);expect(result.owedToYou.count).toBe(2);
 expect([...result.youOwe.totals]).toEqual([['GBP',1n],['NGN',500000n]]);expect(result.youOwe.count).toBe(2);
 expect(agreementBalances([],people[0].userId).owedToYou.totals.size).toBe(0);
});
it('groups midnight events by the viewer day and observes daylight saving time',()=>{
 const ny=activityFormatters('America/New_York'),tokyo=activityFormatters('Asia/Tokyo');
 const instant=new Date('2026-10-12T00:30:00Z');
 expect(ny.dateKey.format(instant)).toBe('2026-10-11');expect(ny.clock.format(instant)).toBe('20:30');
 expect(tokyo.dateKey.format(instant)).toBe('2026-10-12');expect(tokyo.clock.format(instant)).toBe('09:30');
 expect(ny.clock.format(new Date('2026-01-12T00:30:00Z'))).toBe('19:30');
});

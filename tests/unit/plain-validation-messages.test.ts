import {describe,it,expect} from 'vitest';
import type {ZodType} from 'zod';
import {termsSchema} from '@/modules/agreements/schema';
import {debtInput,paymentInput} from '@/modules/debts/model';
import {investmentInput} from '@/modules/investments/model';
import {calendarDateSchema,installmentPlanSchema} from '@/lib/installment-schema';
import {terms} from '../helpers';

const messages=(schema:ZodType,value:unknown)=>{const result=schema.safeParse(value);return result.success?[]:result.error.issues.map(i=>i.message);};
const raw=/Invalid|pattern|must match|expected/i;

describe('validation messages people can read',()=>{
 it('asks for a date instead of showing the date pattern',()=>{
  for(const value of ['','31/12/2026','2026-02-30']){const found=messages(calendarDateSchema,value);expect(found.length).toBeGreaterThan(0);for(const m of found)expect(m).not.toMatch(raw);}
  expect(messages(calendarDateSchema,'')[0]).toBe('Choose a date.');
  expect(messages(termsSchema,{...terms,dueDate:''})[0]).toBe('Choose a date.');
  expect(messages(installmentPlanSchema,{frequency:'CUSTOM',payments:[{dueDate:'',amountMinor:'100'},{dueDate:'2027-01-01',amountMinor:'100'}]})[0]).toBe('Choose a date.');
 });
 it('asks for an amount greater than zero instead of showing the amount pattern',()=>{
  const debt={person:'Maryam Bello',currency:'NGN',amountMinor:'0',date:'2026-10-01',note:''};
  expect(messages(debtInput,debt)[0]).toBe('Enter an amount greater than zero.');
  expect(messages(paymentInput,{amountMinor:'',date:'',note:''})).toEqual(['Enter an amount greater than zero.','Choose a date.']);
  expect(messages(termsSchema,{...terms,principalMinor:'-5'})[0]).toBe('Enter an amount greater than zero.');
  for(const m of messages(investmentInput,{name:'Shop',currency:'NGN',amountMinor:'',date:''}))expect(m).not.toMatch(raw);
 });
});

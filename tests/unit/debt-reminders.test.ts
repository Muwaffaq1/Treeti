import {describe,it,expect} from 'vitest';
import {createDebt,recordDebtPayment} from '@/modules/debts/model';
import {makeReminder,reminderCalendar,reminderLabel} from '@/modules/debts/reminders';
const now='2026-10-08T12:00:00.000Z';
const debt=createDebt({person:'Maryam Bello',currency:'NGN',amountMinor:'10000',date:'2026-10-01'},'owner','debt',now);
describe('private debt reminder rules',()=>{
 it('preserves an absolute time, time zone and privacy in calendar export',()=>{
  const reminder=makeReminder(debt,{remindAt:'2026-10-09T09:00:00+01:00',timeZone:'Africa/Lagos',email:false},'reminder',now)!;
  expect(reminder.remindAt).toBe('2026-10-09T08:00:00.000Z');expect(reminderLabel(reminder)).toContain('09:00');
  const calendar=reminderCalendar(reminder,now);expect(calendar).toContain('DTSTART:20261009T080000Z');expect(calendar).toContain('BEGIN:VALARM');expect(calendar).not.toContain('Maryam');expect(calendar).not.toContain('NGN');
 });
 it('rejects past reminders, invalid zones and paid debts and removes a reminder on full repayment',()=>{
  const input={remindAt:'2026-10-09T08:00:00Z',timeZone:'Africa/Lagos',email:false};
  expect(()=>makeReminder(debt,{...input,remindAt:now},'r',now)).toThrow('future');expect(()=>makeReminder(debt,{...input,timeZone:'Invalid/Zone'},'r',now)).toThrow();
  const withReminder={...debt,reminder:makeReminder(debt,input,'r',now)};
  const paid=recordDebtPayment(withReminder,{amountMinor:'10000',date:'2026-10-08'},'owner','payment',now);expect(paid.reminder).toBeNull();expect(()=>makeReminder(paid,input,'r2',now)).toThrow('already paid');expect(makeReminder(debt,{cancel:true},'r',now)).toBeNull();
 });
});

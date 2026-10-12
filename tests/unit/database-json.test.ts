import {describe, expect, it} from 'vitest';
import {parseDatabaseJSON, serializeDatabaseJSON} from '@/lib/database-json';
import {debtRemaining, type PersonalDebt} from '@/modules/debts/model';

const debt: PersonalDebt = {
  id: 'synthetic-debt', ownerId: 'synthetic-owner', person: 'Sample person',
  currency: 'NGN', amountMinor: '500000', date: '2026-10-01', note: 'Quotes " and Unicode ₦ stay intact.',
  createdAt: '2026-10-01T00:00:00.000Z', payments: [{id: 'synthetic-payment', amountMinor: '125000', date: '2026-10-02', note: '', createdAt: '2026-10-02T00:00:00.000Z'}],
};

describe('PostgreSQL JSON transport', () => {
  it('writes pre-serialized repository snapshots as objects, preserving money strings', () => {
    expect(JSON.parse(serializeDatabaseJSON(JSON.stringify(debt)))).toEqual(debt);
    expect(parseDatabaseJSON(serializeDatabaseJSON(debt))).toEqual(debt);
  });
  it('loads earlier double-encoded debts and payments with the exact remaining balance', () => {
    const loaded = parseDatabaseJSON(JSON.stringify(JSON.stringify(debt))) as PersonalDebt;
    expect(loaded).toEqual(debt);
    expect(debtRemaining(loaded)).toBe('375000');
  });
  it('recovers idempotency responses and evidence snapshots without changing their contents', () => {
    for (const value of [{debt}, {agreement: {versions: [{hash: 'original-hash', terms: {principalMinor: '99999999999999'}}]}}, [{id: 'sample-event'}]]) {
      expect(parseDatabaseJSON(JSON.stringify(value))).toEqual(value);
      expect(parseDatabaseJSON(JSON.stringify(JSON.stringify(value)))).toEqual(value);
    }
  });
  it('preserves JSON scalar values and strings that only resemble JSON', () => {
    for (const value of [null, true, 123, 'Sample text', '{unfinished', '[unfinished']) {
      expect(parseDatabaseJSON(JSON.stringify(value))).toEqual(value);
    }
  });
});

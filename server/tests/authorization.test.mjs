import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeeSpk, consultantForSpk, validateSpkChanges, validateSpkState } from '../.test-build/lib/spks.js';
import { date } from '../.test-build/lib/http.js';

const actor = (role, id) => ({ role, id });

test('SPK visibility stays within the assigned user and team', () => {
  const spk = { consultantId: 'sales-1', supervisorId: 'spv-1' };
  assert.equal(canSeeSpk(actor('master', 'master-1'), spk), true);
  assert.equal(canSeeSpk(actor('supervisor', 'spv-1'), spk), true);
  assert.equal(canSeeSpk(actor('supervisor', 'spv-2'), spk), false);
  assert.equal(canSeeSpk(actor('consultant', 'sales-1'), spk), true);
  assert.equal(canSeeSpk(actor('consultant', 'sales-2'), spk), false);
});

test('consultants cannot change protected SPK fields', () => {
  assert.throws(() => validateSpkChanges({ vin: '123' }, 'consultant'), /Cannot edit vin/);
  assert.throws(() => validateSpkChanges({ planDoDate: '2026-09-05' }, 'consultant'), /Cannot edit planDoDate/);
  assert.throws(() => validateSpkChanges({ delivered: true }, 'consultant'), /Cannot edit delivered/);
  assert.deepEqual(validateSpkChanges({ customerName: 'Ayu' }, 'consultant'), { customer_name: 'Ayu' });
});

test('invalid dates and conflicting SPK state are rejected', () => {
  assert.throws(() => date('2026-02-30', 'date'), /Invalid date/);
  assert.throws(() => validateSpkState({ promiseFrom: '2026-10-02', promiseTo: '2026-10-01', payment: 'cash', tenorMonths: null, tdp: null, delivered: false, status: 'open', deliveredDate: null }), /Promise end date/);
  assert.throws(() => validateSpkState({ promiseFrom: '2026-10-01', promiseTo: '2026-10-02', payment: 'credit', tenorMonths: null, tdp: null, delivered: false, status: 'open', deliveredDate: null }), /requires tenorMonths/);
});

test('new SPK numbers have the LOT prefix and five user-entered digits', () => {
  assert.deepEqual(validateSpkChanges({ number: 'LOT - 01234' }, 'consultant'), { spk_number: 'LOT - 01234' });
  assert.throws(() => validateSpkChanges({ number: 'LOT - 1234' }, 'consultant'), /5 digits/);
  assert.throws(() => validateSpkChanges({ number: 'LOT - ABCDE' }, 'consultant'), /5 digits/);
});

test('consultants without a supervisor can still create an SPK for the master queue', async () => {
  const db = { query: async () => ({ rows: [{ id: 'sales-1', supervisor_id: null }] }) };
  assert.deepEqual(await consultantForSpk(db, actor('consultant', 'sales-1'), undefined),
    { consultantId: 'sales-1', supervisorId: null });
});

test('a disabled supervisor still blocks their consultant', async () => {
  const db = { query: async () => ({ rows: [{ id: 'sales-1', supervisor_id: 'spv-1', supervisor_active: false, supervisor_deleted: null }] }) };
  await assert.rejects(consultantForSpk(db, actor('consultant', 'sales-1'), undefined), /Active consultant required/);
});

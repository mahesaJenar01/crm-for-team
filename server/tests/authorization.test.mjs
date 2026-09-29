import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeeSpk, validateSpkChanges, validateSpkState } from '../.test-build/lib/spks.js';
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
  assert.throws(() => validateSpkChanges({ delivered: true }, 'consultant'), /Cannot edit delivered/);
  assert.deepEqual(validateSpkChanges({ customerName: 'Ayu' }, 'consultant'), { customer_name: 'Ayu' });
});

test('invalid dates and conflicting SPK state are rejected', () => {
  assert.throws(() => date('2026-02-30', 'date'), /Invalid date/);
  assert.throws(() => validateSpkState({ promiseFrom: '2026-10-02', promiseTo: '2026-10-01', payment: 'cash', tenorMonths: null, tdp: null, delivered: false, status: 'open', deliveredDate: null }), /Promise end date/);
  assert.throws(() => validateSpkState({ promiseFrom: '2026-10-01', promiseTo: '2026-10-02', payment: 'credit', tenorMonths: null, tdp: null, delivered: false, status: 'open', deliveredDate: null }), /requires tenorMonths/);
});

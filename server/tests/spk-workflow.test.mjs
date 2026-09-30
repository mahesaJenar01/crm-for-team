import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareSpkUpdate, validateSpkChanges, validateSpkState } from '../.test-build/lib/spks.js';
import { listFilters } from '../.test-build/lib/list-filters.js';

const openSpk = (overrides = {}) => ({
  promiseFrom: '2026-09-01', promiseTo: '2026-09-30', payment: 'cash', tenorMonths: null, tdp: null,
  delivered: false, status: 'open', deliveredDate: null, fullyPaid: false, crmDone: false,
  incentiveDms: false, deliveryPlanned: false, planDoDate: null, vin: null, vinAllocated: null,
  ...overrides,
});
const stateAfter = (before, changes) => {
  const fields = { fully_paid: 'fullyPaid', crm_done: 'crmDone', incentive_dms: 'incentiveDms',
    delivery_planned: 'deliveryPlanned', plan_do_date: 'planDoDate', delivered_date: 'deliveredDate' };
  return { ...before, ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [fields[key] ?? key, value])) };
};

test('delivery requires all three prerequisites, and automatically plans DO', () => {
  for (const fullyPaid of [false, true]) for (const crmDone of [false, true]) for (const incentiveDms of [false, true]) {
    const before = openSpk({ fullyPaid, crmDone, incentiveDms });
    const changes = prepareSpkUpdate({ delivered: true }, before, '2026-09-30');
    const after = stateAfter(before, changes);
    if (fullyPaid && crmDone && incentiveDms) {
      assert.doesNotThrow(() => validateSpkState(after));
      assert.equal(after.status, 'closed');
      assert.equal(after.deliveryPlanned, true);
      assert.equal(after.planDoDate, '2026-09-30');
      assert.equal(after.deliveredDate, '2026-09-30');
    } else assert.throws(() => validateSpkState(after), /Lunas|DMS|CRM/);
  }
});

test('delivering preserves an existing Plan DO and its date', () => {
  const before = openSpk({ fullyPaid: true, crmDone: true, incentiveDms: true, deliveryPlanned: true, planDoDate: '2026-09-25' });
  const changes = prepareSpkUpdate({ delivered: true }, before, '2026-09-30');
  assert.equal('delivery_planned' in changes, false);
  assert.equal('plan_do_date' in changes, false);
  assert.equal(stateAfter(before, changes).planDoDate, '2026-09-25');
  assert.doesNotThrow(() => validateSpkState(stateAfter(before, changes)));
});

test('Plan DO requires payment and dependent flags cannot be removed after delivery', () => {
  assert.throws(() => validateSpkState(openSpk({ deliveryPlanned: true })), /Plan DO.*Lunas/);
  assert.doesNotThrow(() => validateSpkState(openSpk({ deliveryPlanned: true, fullyPaid: true })));
  const delivered = openSpk({ fullyPaid: true, crmDone: true, incentiveDms: true, deliveryPlanned: true, delivered: true, status: 'closed', deliveredDate: '2026-09-30' });
  for (const field of ['fullyPaid', 'crmDone', 'incentiveDms', 'deliveryPlanned']) {
    assert.throws(() => validateSpkState({ ...delivered, [field]: false }));
  }
  assert.doesNotThrow(() => validateSpkState({ ...delivered, delivered: false, deliveredDate: null, status: 'open' }));
  assert.throws(() => prepareSpkUpdate({ delivered: true, status: 'cancelled' }, openSpk()), /cannot be cancelled/);
});

test('Noka can be saved by supervisors in the form, with allocation dates maintained', () => {
  assert.deepEqual(validateSpkChanges({ vin: '  NOKA123  ' }, 'supervisor'), { vin: 'NOKA123' });
  assert.throws(() => validateSpkChanges({ vin: 'NOKA123' }, 'consultant'), /Cannot edit vin/);
  assert.deepEqual(prepareSpkUpdate({ vin: 'NOKA123' }, openSpk(), '2026-09-30'), { vin: 'NOKA123', vin_allocated: '2026-09-30' });
  const assigned = openSpk({ vin: 'NOKA123', vinAllocated: '2026-09-25' });
  assert.deepEqual(prepareSpkUpdate({ vin: 'NOKA123' }, assigned, '2026-09-30'), { vin: 'NOKA123' });
  assert.deepEqual(prepareSpkUpdate({ vin: null }, assigned), { vin: null, vin_allocated: null });
});

test('old delivered SPKs can be corrected incrementally without fabricating or removing prerequisites', () => {
  const legacy = openSpk({ delivered: true, status: 'closed', deliveredDate: '2026-09-20' });
  assert.doesNotThrow(() => validateSpkState({ ...legacy }, legacy));
  const crmCorrected = { ...legacy, crmDone: true };
  assert.doesNotThrow(() => validateSpkState(crmCorrected, legacy));
  assert.throws(() => validateSpkState(legacy, crmCorrected), /Dikirim/);
  assert.throws(() => validateSpkState({ ...legacy, deliveryPlanned: true }, legacy), /Plan DO.*Lunas/);
  const paid = { ...crmCorrected, fullyPaid: true };
  assert.doesNotThrow(() => validateSpkState(paid, crmCorrected));
  assert.doesNotThrow(() => validateSpkState({ ...paid, incentiveDms: true, deliveryPlanned: true }, paid));
  const oldPlan = openSpk({ deliveryPlanned: true });
  assert.doesNotThrow(() => validateSpkState({ ...oldPlan, crmDone: true }, oldPlan));
  assert.throws(() => validateSpkState({ ...oldPlan }, { ...oldPlan, fullyPaid: true }), /Lunas/);
});

test('SPK defaults to all statuses; filters preserve team scope and monthly pagination', () => {
  const actor = { role: 'supervisor', id: 'spv-1' };
  const all = listFilters(actor, new URLSearchParams('month=2026-09'), 'spk');
  assert.match(all.clause, /supervisor_id=\$1/);
  assert.match(all.clause, /spk_date >= \$2/);
  assert.deepEqual(all.values, ['spv-1', '2026-09-01']);
  for (const status of ['open', 'closed', 'cancelled']) {
    const filtered = listFilters(actor, new URLSearchParams(`month=2026-09&status=${status}`), 'spk');
    assert.match(filtered.clause, /status=\$3/);
    assert.deepEqual(filtered.values, ['spv-1', '2026-09-01', status]);
  }
  const outstanding = listFilters(actor, new URLSearchParams('month=2026-09&outstanding=true'), 'spk');
  assert.match(outstanding.clause, /status='open'/);
  assert.doesNotMatch(outstanding.clause, /spk_date/);
});

test('prospect archive includes successes and failures and uses Jakarta creation month', () => {
  const consultantId = '11111111-1111-4111-8111-111111111111';
  const actor = { role: 'supervisor', id: 'spv-1' };
  const running = listFilters(actor, new URLSearchParams(`month=2026-09&status=running&consultantId=${consultantId}`), 'prospect');
  assert.match(running.clause, /supervisor_id=\$1/);
  assert.match(running.clause, /created_at at time zone 'Asia\/Jakarta'/);
  assert.match(running.clause, /status='pending'/);
  assert.match(running.clause, /consultant_id=\$3/);
  assert.deepEqual(running.values, ['spv-1', '2026-09-01', consultantId]);
  const completed = listFilters(actor, new URLSearchParams('month=2026-09&status=completed'), 'prospect');
  assert.match(completed.clause, /status in \('berhasil','gagal'\)/);
  assert.doesNotMatch(completed.clause, /pending/);
  assert.equal(listFilters({ role: 'master' }, new URLSearchParams(), 'prospect').clause, '');
});

test('invalid filter values are rejected instead of broadening visibility', () => {
  const actor = { role: 'consultant', id: 'sales-1' };
  assert.throws(() => listFilters(actor, new URLSearchParams('month=2026-13'), 'prospect'), /month must be/);
  assert.throws(() => listFilters(actor, new URLSearchParams('status=invalid'), 'spk'), /Invalid status/);
  assert.throws(() => listFilters(actor, new URLSearchParams('status=berhasil'), 'prospect'), /Invalid status/);
  assert.throws(() => listFilters(actor, new URLSearchParams('consultantId=invalid'), 'prospect'), /Invalid consultantId/);
});

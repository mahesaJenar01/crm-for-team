import { pool, transaction } from '../lib/db.js';
import { audit, requireActor } from '../lib/auth.js';
import { consultantForSpk, jakartaToday, spkSelect, validateSpkChanges, validateSpkState } from '../lib/spks.js';
import { ApiError, body, handle, integer, json } from '../lib/http.js';
import { listFilters } from '../lib/list-filters.js';

export const GET = handle(async (request) => {
  const actor = await requireActor(request);
  const url = new URL(request.url);
  const page = integer(Number(url.searchParams.get('page') ?? '1'), 'page', 1, 100000);
  const { clause, values } = listFilters(actor, url.searchParams, 'spk');
  const count = await pool.query(`select count(*)::integer as total from spk${clause}`, values);
  values.push((page - 1) * 25);
  const rows = await pool.query(`${spkSelect}${clause} order by spk_date desc,id desc limit 25 offset $${values.length}`, values);
  return json({ spks: rows.rows, page, pageSize: 25, total: count.rows[0].total });
});

export const POST = handle(async (request) => {
  const actor = await requireActor(request);
  const payload = await body(request);
  const forbiddenOnCreate = ['status','vinAllocated','delivered','deliveredDate','fullyPaid','deliveryPlanned','planDoDate','refundCredit','incentiveDms','incentiveCsi'];
  if (forbiddenOnCreate.some((key) => key in payload)) throw new ApiError(400, 'New SPKs must start open without supervisor-only fields');
  const { consultantId, supervisorId } = await consultantForSpk(pool, actor, payload.consultantId);
  const required = ['number','date','customerName','clientType','phone','carType','color','quantity','payment','bonus','promiseFrom','promiseTo'];
  for (const key of required) if (payload[key] === undefined || payload[key] === null) throw new ApiError(400, `${key} is required`);
  const changes = validateSpkChanges(Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'consultantId')), actor.role);
  if (changes.vin) changes.vin_allocated = jakartaToday();
  const allowed = Object.keys(changes);
  const spk = await transaction(async (db) => {
    const keys = ['consultant_id', 'supervisor_id', ...allowed];
    const values = [consultantId, supervisorId, ...allowed.map((key) => changes[key])];
    const result = await db.query(`insert into spk (${keys.join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) returning id`, values);
    const id = result.rows[0].id as string;
    const created = await db.query(`${spkSelect} where id=$1`, [id]);
    validateSpkState(created.rows[0]);
    await audit(db, request, actor.id, 'spk', id, 'create', null, created.rows[0]);
    return created.rows[0];
  });
  return json({ spk }, 201);
});

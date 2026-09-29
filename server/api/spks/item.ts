import { pool, transaction } from '../../lib/db.js';
import { audit, requireActor } from '../../lib/auth.js';
import { canSeeSpk, spkSelect, validateSpkChanges, validateSpkState } from '../../lib/spks.js';
import { ApiError, body, handle, integer, json, uuid } from '../../lib/http.js';

function idFrom(request: Request) { return uuid(new URL(request.url).searchParams.get('id')); }

export const GET = handle(async (request) => {
  const actor = await requireActor(request);
  const id = idFrom(request);
  const result = await pool.query(`${spkSelect} where id=$1`, [id]);
  if (!result.rowCount || !canSeeSpk(actor, result.rows[0])) throw new ApiError(404, 'SPK not found');
  return json({ spk: result.rows[0] });
});

export const PATCH = handle(async (request) => {
  const actor = await requireActor(request);
  const id = idFrom(request);
  const payload = await body(request);
  const revision = integer(payload.revision, 'revision', 1);
  const input = payload.changes;
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'changes object required');
  const changes = validateSpkChanges(input as Record<string, unknown>, actor.role);
  if (changes.delivered === true) {
    if (changes.status === 'cancelled') throw new ApiError(400, 'Delivered SPK cannot be cancelled');
    changes.status = 'closed';
    if (!('delivered_date' in changes)) changes.delivered_date = new Date().toISOString().slice(0, 10);
  }
  const keys = Object.keys(changes);
  if (!keys.length) throw new ApiError(400, 'No changes provided');
  const spk = await transaction(async (db) => {
    const beforeResult = await db.query(`${spkSelect} where id=$1 for update`, [id]);
    if (!beforeResult.rowCount || !canSeeSpk(actor, beforeResult.rows[0])) throw new ApiError(404, 'SPK not found');
    const before = beforeResult.rows[0];
    if (before.revision !== revision) throw new ApiError(409, 'SPK changed since you opened it; reload before editing');
    const values = keys.map((key) => changes[key]);
    values.push(id);
    await db.query(`update spk set ${keys.map((key, i) => `${key}=$${i + 1}`).join(',')},revision=revision+1,updated_at=now() where id=$${values.length}`, values);
    const after = (await db.query(`${spkSelect} where id=$1`, [id])).rows[0];
    validateSpkState(after);
    await audit(db, request, actor.id, 'spk', id, 'update', before, after);
    return after;
  });
  return json({ spk });
});

export const DELETE = handle(async (request) => {
  const actor = await requireActor(request);
  if (actor.role === 'consultant') throw new ApiError(403, 'Supervisor or master required');
  const id = idFrom(request);
  const spk = await transaction(async (db) => {
    const result = await db.query(`${spkSelect} where id=$1 for update`, [id]);
    if (!result.rowCount || !canSeeSpk(actor, result.rows[0])) throw new ApiError(404, 'SPK not found');
    const documents = await db.query('select 1 from spk_document where spk_id=$1 limit 1', [id]);
    if (documents.rowCount) throw new ApiError(409, 'SPK with documents cannot be deleted; cancel it instead');
    await audit(db, request, actor.id, 'spk', id, 'delete', result.rows[0], null);
    await db.query('delete from spk where id=$1', [id]);
    return result.rows[0];
  });
  return json({ deleted: true, id: spk.id });
});

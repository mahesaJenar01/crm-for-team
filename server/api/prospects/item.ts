import { pool, transaction } from '../../lib/db.js';
import { audit, requireActor } from '../../lib/auth.js';
import { prospectSelect } from '../../lib/prospects.js';
import { ApiError, body, handle, json, oneOf, string, uuid } from '../../lib/http.js';
import type { Actor } from '../../lib/auth.js';
import type { Db } from '../../lib/db.js';

function idFrom(request: Request) { return uuid(new URL(request.url).searchParams.get('id')); }

async function visible(db: Db, actor: Actor, id: string, lock = false) {
  const query = `${prospectSelect} where id=$1${lock ? ' for update' : ''}`;
  const result = await db.query(query, [id]);
  if (!result.rowCount) throw new ApiError(404, 'Prospect not found');
  const prospect = result.rows[0];
  if (actor.role === 'consultant' && prospect.consultantId !== actor.id) throw new ApiError(404, 'Prospect not found');
  if (actor.role === 'supervisor') {
    const member = await db.query('select 1 from app_user where id=$1 and supervisor_id=$2', [prospect.consultantId, actor.id]);
    if (!member.rowCount) throw new ApiError(404, 'Prospect not found');
  }
  return prospect;
}

export const GET = handle(async (request) => {
  const actor = await requireActor(request);
  const id = idFrom(request);
  const prospect = await visible(pool, actor, id);
  const history = await pool.query('select id,want,stage,actor_id as "actorId",created_at as "createdAt" from prospect_history where prospect_id=$1 order by id', [id]);
  return json({ prospect, history: history.rows });
});

export const PATCH = handle(async (request) => {
  const actor = await requireActor(request);
  const id = idFrom(request);
  const payload = await body(request);
  const allowed = new Set(['want', 'stage', 'status']);
  const keys = Object.keys(payload);
  if (!keys.length || keys.some((key) => !allowed.has(key))) throw new ApiError(400, 'Only want, stage, and status may be changed');
  const changes: Record<string, unknown> = {};
  if ('want' in payload) changes.want = string(payload.want, 'want', 2000);
  if ('stage' in payload) changes.stage = string(payload.stage, 'stage', 200);
  if ('status' in payload) changes.status = oneOf(payload.status, 'status', ['pending', 'berhasil', 'gagal'] as const);
  const prospect = await transaction(async (db) => {
    const before = await visible(db, actor, id, true);
    const fields = Object.keys(changes);
    await db.query(`update prospect set ${fields.map((field, i) => `${field}=$${i + 1}`).join(',')},updated_at=now() where id=$${fields.length + 1}`,
      [...fields.map((field) => changes[field]), id]);
    const after = await visible(db, actor, id);
    if ('want' in changes || 'stage' in changes) await db.query('insert into prospect_history (prospect_id,want,stage,actor_id) values ($1,$2,$3,$4)', [id, after.want, after.stage, actor.id]);
    await audit(db, request, actor.id, 'prospect', id, 'update', before, after);
    return after;
  });
  return json({ prospect });
});

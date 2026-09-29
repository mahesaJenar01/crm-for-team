import { pool, transaction } from '../lib/db.js';
import { audit, requireActor } from '../lib/auth.js';
import { consultantForSpk } from '../lib/spks.js';
import { prospectSelect } from '../lib/prospects.js';
import { body, handle, integer, json, string } from '../lib/http.js';

export const GET = handle(async (request) => {
  const actor = await requireActor(request);
  const page = integer(Number(new URL(request.url).searchParams.get('page') ?? '1'), 'page', 1, 100000);
  const where = actor.role === 'master' ? '' : actor.role === 'supervisor' ? ' where consultant_id in (select id from app_user where supervisor_id=$1)' : ' where consultant_id=$1';
  const scope = actor.role === 'master' ? [] : [actor.id];
  const total = await pool.query(`select count(*)::integer as total from prospect${where}`, scope);
  const rows = await pool.query(`${prospectSelect}${where} order by updated_at desc,id desc limit 25 offset $${scope.length + 1}`, [...scope, (page - 1) * 25]);
  return json({ prospects: rows.rows, page, pageSize: 25, total: total.rows[0].total });
});

export const POST = handle(async (request) => {
  const actor = await requireActor(request);
  const payload = await body(request);
  const { consultantId } = await consultantForSpk(pool, actor, payload.consultantId);
  const name = string(payload.name, 'name', 200);
  const want = string(payload.want, 'want', 2000);
  const stage = string(payload.stage, 'stage', 200);
  const prospect = await transaction(async (db) => {
    const inserted = await db.query('insert into prospect (consultant_id,name,want,stage,created_by) values ($1,$2,$3,$4,$5) returning id', [consultantId, name, want, stage, actor.id]);
    const id = inserted.rows[0].id as string;
    await db.query('insert into prospect_history (prospect_id,want,stage,actor_id) values ($1,$2,$3,$4)', [id, want, stage, actor.id]);
    const after = (await db.query(`${prospectSelect} where id=$1`, [id])).rows[0];
    await audit(db, request, actor.id, 'prospect', id, 'create', null, after);
    return after;
  });
  return json({ prospect }, 201);
});

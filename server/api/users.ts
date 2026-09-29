import { pool, transaction } from '../lib/db.js';
import { audit, hashPassword, requireActor } from '../lib/auth.js';
import { ApiError, body, handle, json, oneOf, optionalString, string, uuid } from '../lib/http.js';

async function master(request: Request) {
  const actor = await requireActor(request);
  if (actor.role !== 'master') throw new ApiError(403, 'Master account required');
  return actor;
}

export const GET = handle(async (request) => {
  await master(request);
  const { rows } = await pool.query('select id,username,display_name as "displayName",role,supervisor_id as "supervisorId",active,must_change_password as "mustChangePassword",created_at as "createdAt" from app_user order by created_at,id');
  return json({ users: rows });
});

export const POST = handle(async (request) => {
  const actor = await master(request);
  const payload = await body(request);
  const username = string(payload.username, 'username', 80);
  const displayName = string(payload.displayName, 'displayName', 160);
  const role = oneOf(payload.role, 'role', ['supervisor', 'consultant'] as const);
  const supervisorId = role === 'consultant' ? uuid(payload.supervisorId, 'supervisorId') : null;
  const passwordHash = await hashPassword(string(payload.password, 'password', 200));
  const user = await transaction(async (db) => {
    const duplicate = await db.query('select 1 from app_user where lower(username)=lower($1)', [username]);
    if (duplicate.rowCount) throw new ApiError(409, 'Username already exists');
    if (supervisorId) {
      const supervisor = await db.query("select 1 from app_user where id=$1 and role='supervisor' and active=true", [supervisorId]);
      if (!supervisor.rowCount) throw new ApiError(400, 'Active supervisor required');
    }
    const result = await db.query(`insert into app_user (username,display_name,password_hash,role,supervisor_id)
      values ($1,$2,$3,$4,$5) returning id,username,display_name as "displayName",role,supervisor_id as "supervisorId",active,must_change_password as "mustChangePassword"`,
    [username, displayName, passwordHash, role, supervisorId]);
    await audit(db, request, actor.id, 'user', result.rows[0].id, 'create', null, { username, displayName, role, supervisorId });
    return result.rows[0];
  });
  return json({ user }, 201);
});

export const PATCH = handle(async (request) => {
  const actor = await master(request);
  const payload = await body(request);
  const userId = uuid(payload.id);
  const action = oneOf(payload.action, 'action', ['disable', 'enable', 'resetPassword'] as const);
  if (userId === actor.id && action === 'disable') throw new ApiError(400, 'Cannot disable your own account');
  const passwordHash = action === 'resetPassword' ? await hashPassword(string(payload.password, 'password', 200)) : null;
  await transaction(async (db) => {
    const before = await db.query('select id,username,role,active from app_user where id=$1 for update', [userId]);
    if (!before.rowCount) throw new ApiError(404, 'User not found');
    if (action === 'disable' && before.rows[0].role === 'supervisor') {
      const team = await db.query('select 1 from app_user where supervisor_id=$1 and active=true limit 1', [userId]);
      if (team.rowCount) throw new ApiError(409, 'Disable or reassign this supervisor’s consultants first');
    }
    if (action === 'resetPassword') await db.query('update app_user set password_hash=$1,must_change_password=true where id=$2', [passwordHash, userId]);
    else await db.query('update app_user set active=$1 where id=$2', [action === 'enable', userId]);
    if (action !== 'enable') await db.query('update refresh_session set revoked_at=now() where user_id=$1 and revoked_at is null', [userId]);
    await audit(db, request, actor.id, 'user', userId, action, before.rows[0], { active: action === 'enable' ? true : action === 'disable' ? false : before.rows[0].active });
  });
  return json({ ok: true });
});

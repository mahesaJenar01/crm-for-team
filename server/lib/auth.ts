import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { Db } from './db.js';
import { pool } from './db.js';
import { ApiError, ip, userAgent } from './http.js';

export type Role = 'master' | 'supervisor' | 'consultant';
export type Actor = { id: string; username: string; displayName: string; role: Role; supervisorId: string | null; mustChangePassword: boolean };

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
const key = new TextEncoder().encode(secret);

export function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
export function newRefreshToken(): string { return randomBytes(32).toString('base64url'); }
export function hashRateKey(username: string, sourceIp: string): string { return hashToken(`${username.toLowerCase()}|${sourceIp}`); }
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new ApiError(400, 'Password must have at least 12 characters and at most 72 UTF-8 bytes');
  return bcrypt.hash(password, 12);
}
export async function checkPassword(password: string, hash: string): Promise<boolean> { return bcrypt.compare(password, hash); }

export async function accessToken(actor: Actor): Promise<string> {
  return new SignJWT({ role: actor.role })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(actor.id).setIssuedAt().setExpirationTime('15m')
    .sign(key);
}

export async function requireActor(request: Request, allowPasswordChange = false): Promise<Actor> {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '');
  if (!match) throw new ApiError(401, 'Authentication required');
  let id: string;
  try {
    const { payload } = await jwtVerify(match[1], key, { algorithms: ['HS256'] });
    if (!payload.sub) throw new Error('Missing subject');
    id = payload.sub;
  } catch { throw new ApiError(401, 'Invalid or expired token'); }
  const { rows } = await pool.query("select id, username, display_name, role, supervisor_id, must_change_password from app_user u where id=$1 and active=true and deleted_at is null and (role <> 'consultant' or supervisor_id is null or exists (select 1 from app_user s where s.id=u.supervisor_id and s.active=true and s.deleted_at is null))", [id]);
  if (!rows.length) throw new ApiError(401, 'Account disabled or missing');
  const row = rows[0];
  const actor: Actor = { id: row.id, username: row.username, displayName: row.display_name, role: row.role, supervisorId: row.supervisor_id, mustChangePassword: row.must_change_password };
  if (actor.mustChangePassword && !allowPasswordChange) throw new ApiError(403, 'Password change required');
  return actor;
}

export async function saveRefresh(db: Db, actorId: string, token: string): Promise<void> {
  await db.query("insert into refresh_session (user_id, token_hash, expires_at) values ($1,$2,'infinity'::timestamptz)", [actorId, hashToken(token)]);
}

export async function audit(db: Db, request: Request, actorId: string | null, entityType: string, entityId: string | null, action: string, before: unknown = null, after: unknown = null): Promise<void> {
  await db.query('insert into audit_log (actor_id,entity_type,entity_id,action,before_data,after_data,source_ip,user_agent) values ($1,$2,$3,$4,$5,$6,$7,$8)',
    [actorId, entityType, entityId, action, before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after), ip(request), userAgent(request)]);
}

export function publicUser(actor: Actor) {
  return { id: actor.id, username: actor.username, displayName: actor.displayName, role: actor.role, supervisorId: actor.supervisorId, mustChangePassword: actor.mustChangePassword };
}

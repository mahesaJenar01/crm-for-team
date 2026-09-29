import { transaction } from '../../lib/db.js';
import { audit, hashPassword } from '../../lib/auth.js';
import { ApiError, body, handle, json, string } from '../../lib/http.js';

export const POST = handle(async (request) => {
  const bootstrapSecret = process.env.BOOTSTRAP_SECRET;
  if (!bootstrapSecret || bootstrapSecret.length < 32) throw new ApiError(503, 'Bootstrap is disabled');
  // Compare a digest, so the comparison does not reveal how much of the secret matches.
  const { timingSafeEqual, createHash } = await import('node:crypto');
  const supplied = request.headers.get('x-bootstrap-secret') ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (!timingSafeEqual(digest(supplied), digest(bootstrapSecret))) throw new ApiError(403, 'Forbidden');
  const payload = await body(request);
  const username = string(payload.username, 'username', 80);
  const displayName = string(payload.displayName, 'displayName', 160);
  const password = string(payload.password, 'password', 200);
  const passwordHash = await hashPassword(password);
  const actorId = await transaction(async (db) => {
    await db.query('select pg_advisory_xact_lock(472917)');
    const existing = await db.query("select 1 from app_user where role='master' limit 1");
    if (existing.rowCount) throw new ApiError(409, 'Master account already exists');
    const inserted = await db.query("insert into app_user (username,display_name,password_hash,role) values ($1,$2,$3,'master') returning id", [username, displayName, passwordHash]);
    const id = inserted.rows[0].id as string;
    await audit(db, request, id, 'user', id, 'bootstrap', null, { username, role: 'master' });
    return id;
  });
  return json({ id: actorId, username, mustChangePassword: true }, 201);
});

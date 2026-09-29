import { pool } from '../../lib/db.js';
import { hashToken } from '../../lib/auth.js';
import { body, handle, json, string } from '../../lib/http.js';

export const POST = handle(async (request) => {
  const payload = await body(request);
  const token = string(payload.refreshToken, 'refreshToken', 200);
  await pool.query('update refresh_session set revoked_at=now() where token_hash=$1 and revoked_at is null', [hashToken(token)]);
  return json({ ok: true });
});

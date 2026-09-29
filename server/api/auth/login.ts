import bcrypt from 'bcryptjs';
import { pool } from '../../lib/db.js';
import { accessToken, hashRateKey, newRefreshToken, publicUser, saveRefresh } from '../../lib/auth.js';
import { ApiError, body, handle, ip, json, string } from '../../lib/http.js';

export const POST = handle(async (request) => {
  const payload = await body(request);
  const username = string(payload.username, 'username', 80);
  const password = string(payload.password, 'password', 200);
  const rateKey = hashRateKey(username, ip(request));
  const rate = await pool.query('select attempts, blocked_until from login_attempt where key_hash=$1', [rateKey]);
  if (rate.rows[0]?.blocked_until && new Date(rate.rows[0].blocked_until) > new Date()) throw new ApiError(429, 'Too many login attempts; try again later');
  const result = await pool.query("select id,username,display_name,role,supervisor_id,must_change_password,password_hash from app_user u where lower(username)=lower($1) and active=true and (role <> 'consultant' or exists (select 1 from app_user s where s.id=u.supervisor_id and s.active=true))", [username]);
  const row = result.rows[0];
  const matches = row ? await bcrypt.compare(password, row.password_hash) : (await bcrypt.hash(password, 12), false);
  if (!matches) {
    await pool.query(`insert into login_attempt (key_hash,attempts,window_started_at,blocked_until) values ($1,1,now(),null)
      on conflict (key_hash) do update set
      attempts=case when login_attempt.window_started_at < now()-interval '15 minutes' then 1 else login_attempt.attempts+1 end,
      window_started_at=case when login_attempt.window_started_at < now()-interval '15 minutes' then now() else login_attempt.window_started_at end,
      blocked_until=case when login_attempt.window_started_at >= now()-interval '15 minutes' and login_attempt.attempts >= 4 then now()+interval '15 minutes' else null end`, [rateKey]);
    throw new ApiError(401, 'Invalid username or password');
  }
  await pool.query('delete from login_attempt where key_hash=$1', [rateKey]);
  const actor = { id: row.id, username: row.username, displayName: row.display_name, role: row.role, supervisorId: row.supervisor_id, mustChangePassword: row.must_change_password };
  const refreshToken = newRefreshToken();
  await saveRefresh(pool, actor.id, refreshToken);
  return json({ user: publicUser(actor), accessToken: await accessToken(actor), refreshToken, expiresInSeconds: 900 });
});

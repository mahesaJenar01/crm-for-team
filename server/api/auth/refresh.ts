import { transaction } from '../../lib/db.js';
import { accessToken, hashToken, newRefreshToken, publicUser, saveRefresh } from '../../lib/auth.js';
import { ApiError, body, handle, json, string } from '../../lib/http.js';

export const POST = handle(async (request) => {
  const payload = await body(request);
  const oldToken = string(payload.refreshToken, 'refreshToken', 200);
  const result = await transaction(async (db) => {
    const session = await db.query(`select s.id,u.id as user_id,u.username,u.display_name,u.role,u.supervisor_id,u.must_change_password
      from refresh_session s join app_user u on u.id=s.user_id
      where s.token_hash=$1 and s.revoked_at is null and u.active=true and u.deleted_at is null
      and (u.role <> 'consultant' or u.supervisor_id is null or exists (select 1 from app_user supervisor where supervisor.id=u.supervisor_id and supervisor.active=true and supervisor.deleted_at is null)) for update of s`, [hashToken(oldToken)]);
    if (!session.rowCount) throw new ApiError(401, 'Invalid or expired refresh token');
    const row = session.rows[0];
    await db.query('update refresh_session set revoked_at=now(),last_used_at=now() where id=$1', [row.id]);
    const nextToken = newRefreshToken();
    await saveRefresh(db, row.user_id, nextToken);
    const actor = { id: row.user_id, username: row.username, displayName: row.display_name, role: row.role, supervisorId: row.supervisor_id, mustChangePassword: row.must_change_password };
    return { user: publicUser(actor), accessToken: await accessToken(actor), refreshToken: nextToken, expiresInSeconds: 900 };
  });
  return json(result);
});

import { transaction } from '../../lib/db.js';
import { audit, checkPassword, hashPassword, requireActor } from '../../lib/auth.js';
import { ApiError, body, handle, json, string } from '../../lib/http.js';

export const POST = handle(async (request) => {
  const actor = await requireActor(request, true);
  const payload = await body(request);
  const currentPassword = string(payload.currentPassword, 'currentPassword', 200);
  const newPassword = string(payload.newPassword, 'newPassword', 200);
  const nextHash = await hashPassword(newPassword);
  await transaction(async (db) => {
    const current = await db.query('select password_hash from app_user where id=$1 for update', [actor.id]);
    if (!current.rowCount || !await checkPassword(currentPassword, current.rows[0].password_hash)) throw new ApiError(401, 'Current password is incorrect');
    if (await checkPassword(newPassword, current.rows[0].password_hash)) throw new ApiError(400, 'Choose a different password');
    await db.query('update app_user set password_hash=$1,must_change_password=false where id=$2', [nextHash, actor.id]);
    await db.query('update refresh_session set revoked_at=now() where user_id=$1 and revoked_at is null', [actor.id]);
    await audit(db, request, actor.id, 'user', actor.id, 'password_change');
  });
  return json({ ok: true, loginAgain: true });
});

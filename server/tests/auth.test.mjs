import test from 'node:test';
import assert from 'node:assert/strict';
import { jwtVerify } from 'jose';

process.env.DATABASE_URL = 'postgres://unused:unused@localhost:5432/unused';
process.env.JWT_SECRET = 'test-only-secret-that-is-longer-than-32-characters';
const { accessToken, checkPassword, hashPassword, hashToken, newRefreshToken } = await import('../.test-build/lib/auth.js');

test('passwords are hashed and overly long bcrypt inputs are rejected', async () => {
  const password = 'a strong private password';
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  assert.equal(await checkPassword(password, hash), true);
  assert.equal(await checkPassword('wrong password', hash), false);
  await assert.rejects(hashPassword('x'.repeat(73)), /at most 72/);
});

test('access and refresh tokens use different formats and hide refresh values', async () => {
  const actor = { id: 'f5058045-a6c2-4a63-9796-13701f91a8aa', role: 'consultant' };
  const token = await accessToken(actor);
  const verified = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
  assert.equal(verified.payload.sub, actor.id);
  const refresh = newRefreshToken();
  assert.equal(refresh.length > 30, true);
  assert.notEqual(hashToken(refresh), refresh);
});

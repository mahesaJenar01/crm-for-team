// Isolated real PostgreSQL engine and existing API handlers. Never connects to Neon.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

process.env.DATABASE_URL = 'postgres://test:unused@127.0.0.1:1/test';
process.env.JWT_SECRET = 'isolated-web-tests-only-secret-at-least-32-chars';
const database = new PGlite();
const schema = await readFile(new URL('../../server/schema.sql', import.meta.url), 'utf8');
// gen_random_uuid is built into PostgreSQL; no optional pgcrypto extension is needed here.
await database.exec(schema.replace('create extension if not exists pgcrypto;', ''));
await database.exec(
  await readFile(new URL('../../server/migrations/001_auth.sql', import.meta.url), 'utf8'),
);
await database.exec(
  await readFile(
    new URL('../../server/migrations/002_account_retention_spk.sql', import.meta.url),
    'utf8',
  ),
);
const { pool } = await import('../../server/.test-build/lib/db.js');
let tail = Promise.resolve();
async function acquire() {
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  const previous = tail;
  tail = next;
  await previous;
  return release;
}
async function query(sql, values) {
  const result = await database.query(sql, values);
  return { rows: result.rows, rowCount: result.rowCount };
}
pool.query = async (sql, values) => {
  const release = await acquire();
  try {
    return await query(sql, values);
  } finally {
    release();
  }
};
pool.connect = async () => {
  const release = await acquire();
  return { query, release };
};
const { hashPassword } = await import('../../server/.test-build/lib/auth.js');
const passwordHash = await hashPassword('test-password-123');
const ids = {
  master: '11111111-1111-4111-8111-111111111111',
  supervisor: '22222222-2222-4222-8222-222222222222',
  consultant: '33333333-3333-4333-8333-333333333333',
  outsideSupervisor: '44444444-4444-4444-8444-444444444444',
  outsideConsultant: '55555555-5555-4555-8555-555555555555',
};
async function reset() {
  const release = await acquire();
  try {
    await database.exec(
      'truncate audit_log,prospect_history,prospect,spk_document,spk,refresh_session,login_attempt,app_user restart identity cascade',
    );
    for (const [id, username, name, role, supervisor] of [
      [ids.master, 'master', 'Master Test', 'master', null],
      [ids.supervisor, 'supervisor', 'Supervisor Test', 'supervisor', null],
      [ids.consultant, 'consultant', 'Consultant Test', 'consultant', ids.supervisor],
      [ids.outsideSupervisor, 'outside-supervisor', 'Other Supervisor', 'supervisor', null],
      [
        ids.outsideConsultant,
        'outside-consultant',
        'Other Consultant',
        'consultant',
        ids.outsideSupervisor,
      ],
    ])
      await query(
        'insert into app_user(id,username,display_name,role,supervisor_id,password_hash,must_change_password) values($1,$2,$3,$4,$5,$6,false)',
        [id, username, name, role, supervisor, passwordHash],
      );
  } finally {
    release();
  }
}
await reset();
const routeNames = [
  'auth/login',
  'auth/refresh',
  'auth/logout',
  'auth/password',
  'users',
  'spks',
  'spks/item',
  'prospects',
  'prospects/item',
];
const routes = Object.fromEntries(
  await Promise.all(
    routeNames.map(async (name) => [name, await import(`../../server/.test-build/api/${name}.js`)]),
  ),
);
const server = createServer(async (req, res) => {
  try {
    if (req.url === '/__test/health') {
      res.end('ok');
      return;
    }
    if (req.url === '/__test/reset' && req.method === 'POST') {
      await reset();
      res.end('ok');
      return;
    }
    const chunks = [];
    for await (const part of req) chunks.push(part);
    const url = `http://127.0.0.1:8787${req.url}`;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const name = new URL(url).pathname.slice(5);
    const response = routes[name]?.[req.method]
      ? await routes[name][req.method](request)
      : Response.json({ error: 'Not found' }, { status: 404 });
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(await response.text());
  } catch (error) {
    console.error(error.message);
    res.writeHead(500);
    res.end('{"error":"Fixture error"}');
  }
});
server.listen(8787, '127.0.0.1', () => console.log('Isolated CRM API ready on 8787'));

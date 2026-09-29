# Vercel server and Android API

The API runs at `https://crm-for-team-server.vercel.app`. Vercel deploys the
`server` directory, and Neon holds the PostgreSQL database. The master account has
been created, its initial password changed, and `BOOTSTRAP_SECRET` removed from
Vercel. Keep `DATABASE_URL` and `JWT_SECRET` in Vercel environment variables only.

The Android app connects over HTTPS. It uses the API for login, password changes,
accounts, SPKs, and prospects. Access and refresh tokens remain in memory, so users
sign in again when the process restarts. The app has no offline editing. If a request
fails, the user sees an error and can retry. A conflicting SPK revision returns 409
and triggers a reload rather than silently overwriting another edit.

## API routes

- `GET /api/health`
- `POST /api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/password`
- `GET/POST/PATCH /api/users` (master manages accounts; supervisors can read only
  themselves and their assigned consultants)
- `GET/POST /api/spks`, `GET/PATCH/DELETE /api/spks/item?id=<uuid>`
- `GET/POST /api/prospects`, `GET/PATCH /api/prospects/item?id=<uuid>`

Protected routes require `Authorization: Bearer <accessToken>`. New accounts must
change their temporary password before using CRM data. Lists contain 25 rows per
page. SPK updates include the latest `revision` and a `changes` object.

## Remaining work before collecting identity documents

There is no document upload or download route. The Android form does not accept
KTP, KK, NPWP, or NIB files. Build private storage with authenticated, short lived
file access, type and size checks, and malware scanning before enabling documents.

For offline use, add an encrypted local cache and a carefully designed sync queue.
The current app requires an internet connection. Test the Android build on a device
with real role accounts before giving it to the team.

## Maintenance

The original SQL schema is in `server/schema.sql`; authentication migration is in
`server/migrations/001_auth.sql`. Do not rerun destructive setup on the live
database. Server tests run with `npm test` in `server`. Keep secrets out of Git,
screenshots, and chat. Rotate a compromised secret in Vercel and redeploy.

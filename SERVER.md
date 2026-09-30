# Vercel server and Android API

The API runs at `https://crm-for-team-server.vercel.app`. Vercel deploys the
`server` directory, and Neon holds the PostgreSQL database. The master account has
been created, its initial password changed, and `BOOTSTRAP_SECRET` removed from
Vercel. Keep `DATABASE_URL` and `JWT_SECRET` in Vercel environment variables only.

The Android app connects over HTTPS. It uses the API for login, password changes,
accounts, SPKs, and prospects. The refresh token is stored in app-private storage
without device backup, so users stay signed in until logout or account revocation.
The app has no offline editing. If a request
fails, the user sees an error and can retry. A conflicting SPK revision returns 409
and triggers a reload rather than silently overwriting another edit.

## API routes

- `GET /api/health`
- `POST /api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/password`
- `GET/POST/PATCH/DELETE /api/users` (master manages accounts; supervisors can read only
  themselves and their assigned consultants)
- `GET/POST /api/spks`, `GET/PATCH/DELETE /api/spks/item?id=<uuid>`
- `GET/POST /api/prospects`, `GET/PATCH /api/prospects/item?id=<uuid>`

Protected routes require `Authorization: Bearer <accessToken>`. New accounts must
change their temporary password before using CRM data. Lists contain 25 rows per
page. SPK updates include the latest `revision` and a `changes` object.

SPK lists accept `month=YYYY-MM` and `status=all|open|closed|cancelled` (default
`all`). The outstanding list continues to include all open SPKs across months.
Prospect lists accept `month=YYYY-MM`, `status=all|running|completed`, and an
optional `consultantId`; these filters also apply to the total and pagination and
never bypass role visibility. Prospect months use `created_at` in Asia/Jakarta;
completed includes both `berhasil` and `gagal`.

The server enforces paid status before Plan DO and paid/DMS/CRM before delivery.
Delivery automatically closes the SPK and checks Plan DO only if it was unchecked.
An existing Plan DO and date are preserved. Dependent flags cannot be unchecked
while delivery remains checked. Supervisors and the master may supply optional
`vin` on creation or editing; its allocation date is maintained by the server.
Old SPKs that predate these checklist rules remain editable and can be corrected
incrementally, without automatically inventing paid/CRM/DMS history. Updates may
not introduce a new dependency violation or remove a checked prerequisite.
These changes use existing database fields and require no new migration. Deploy
the server changes together with the updated Android app to enable the filters
and Noka on creation.

## Remaining work before collecting identity documents

There is no document upload or download route. The Android form does not accept
KTP, KK, NPWP, or NIB files. Build private storage with authenticated, short lived
file access, type and size checks, and malware scanning before enabling documents.

For offline use, add an encrypted local cache and a carefully designed sync queue.
The current app requires an internet connection. Test the Android build on a device
with real role accounts before giving it to the team.

## Maintenance

The original SQL schema is in `server/schema.sql`; run
`server/migrations/002_account_retention_spk.sql` on an existing database before
deploying the matching server and Android changes. Deleted accounts are retained as
inactive historical rows so SPK and prospect references remain intact. Do not rerun destructive setup on the live
database. Server tests run with `npm test` in `server`. Keep secrets out of Git,
screenshots, and chat. Rotate a compromised secret in Vercel and redeploy.

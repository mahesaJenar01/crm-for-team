# Vercel server implementation plan

The Android app currently provides a safe-to-explore offline simulation. Do not put
real KTP, KK, NPWP, NIB, customer, or password data into it until this server and its
access controls are deployed.

## Recommended architecture

- Deploy TypeScript functions from `server/api` on Vercel. Vercel currently builds
  TypeScript files under `/api` as Node.js Functions.
- Provision a managed Postgres provider such as Neon or Supabase through the Vercel
  Marketplace. Vercel Postgres itself is no longer offered for new projects.
- Store uploaded documents in private object storage (for example Vercel Blob with
  authenticated download endpoints), never as public links.
- Keep database URLs, token signing secrets, and the one-time master bootstrap secret
  in Vercel Environment Variables. Never put them in Android resources or Git.

Official references: [Node.js Vercel Functions](https://vercel.com/docs/functions/runtimes/node-js),
[Marketplace storage](https://vercel.com/docs/marketplace-storage), and
[Environment Variables](https://vercel.com/docs/environment-variables).

## Deployment sequence

1. Create a separate Vercel project and set its Root Directory to `server`.
2. Add a Postgres integration from Vercel Marketplace, choosing a region near the
   sales team and enabling pooled/serverless connections.
3. Run `server/schema.sql` once against that database.
4. Add `DATABASE_URL`, a long random `JWT_SECRET`, and a one-time
   `MASTER_INITIAL_PASSWORD` in Vercel Project Settings. Use the supplied master
   password only for the initial bootstrap, then require an immediate change and
   remove the bootstrap variable.
5. Deploy and test `GET /api/health`.
6. Implement the endpoint order below, with automated authorization tests, before
   switching the Android repository from simulation mode to HTTPS API calls.

## Required API order

1. `POST /api/auth/bootstrap` (one-time master only), `POST /api/auth/login`,
   `POST /api/auth/refresh`, `POST /api/auth/logout`.
2. `GET/POST /api/users` (master only), password reset, disable account.
3. `GET/POST /api/spks`, `GET/PATCH/DELETE /api/spks/:id` with server-side role and
   team scoping, optimistic revision numbers, and an audit row for every change.
4. Private, short-lived upload URLs and document metadata. Validate MIME type and
   size; scan uploads before supervisors can open them.
5. `GET/POST /api/prospects`, `PATCH /api/prospects/:id`, and append-only prospect
   history endpoints.
6. Dashboard query endpoints for promise ranges, VIN/payment/delivery follow-ups,
   current-month SPKs, and lifetime outstanding SPKs.

The server—not the phone—must enforce that only the master creates accounts, a
supervisor accesses only assigned consultants, consultants cannot change ownership,
VIN, allocation, delivered/closed/cancelled, or incentive fields, and every request
is scoped to the authenticated user. Hash passwords with Argon2id or bcrypt, use
short-lived access tokens plus rotating refresh tokens, rate-limit login, and record
actor, timestamp, before/after values, and device/IP metadata in `audit_log`.

## Android connection phase

Add one production API base URL through `BuildConfig` (HTTPS only), Retrofit/OkHttp,
encrypted token storage, Room for an offline cache/outbox, retry with idempotency
keys, and background synchronization. Document files should use Android content URIs
only long enough to upload; do not duplicate identity documents into public storage.
Conflict responses must be shown to the user instead of silently overwriting a newer
supervisor edit.

# CRM for Team — web

Responsive React + TypeScript client for the Android CRM. Both clients use the same API, accounts, permissions, SPKs, and prospects. The web adapter contains no database credentials or duplicate CRM business rules.

## Run locally

Use Node.js 22.12+ (24 LTS recommended). From the repository root:

```powershell
cd web
npm.cmd ci
npm.cmd run dev
```

Open `http://127.0.0.1:5173` and sign in with an existing CRM account. On Windows, `run-web.bat` installs missing dependencies and starts the website. The API defaults to `https://crm-for-team-server.vercel.app`; no Android build or local database is required.

For another API, copy `.env.example` to `.env.local`, change `CRM_API_URL`, and restart the dev server. This is a server-side setting, never a `VITE_` setting. Production API calls change real team data, just as Android does.

## Included workflows

- Login, persistent sessions, automatic access renewal, logout, password visibility, password change, and mandatory first-login password change.
- Dashboard API totals: current-month SPKs, lifetime outstanding, and all running prospects.
- SPK forms: sales assignment, LOT number, customer, phone, retail/fleet, car/color, quantity, OTR/deal price, cash/credit/COP, tenor, TDP, insurance, bonuses, description, and delivery range.
- Supervisor/master Noka allocation with server-maintained allocation date, Noka copy, refund and CSI controls.
- SPK monthly status filters, lifetime outstanding, 25-row pagination, CRM/DMS/Lunas/Plan DO/delivery checklist, Plan DO date, cancellation, and deletion confirmation.
- SPK revision conflicts block stale forms. Reloading replaces the draft with the current server record.
- Monthly prospects, sales filters, creation, follow-up history, successful/failed completion, read-only archives, and pagination. Month uses creation time in Asia/Jakarta.
- Master account creation, activation/deactivation, temporary password reset, deletion with retained history, and supervisor/consultant grouping (including orphan consultants).
- Supervisor Sales page with current-month SPKs and running prospects per consultant. Consultants see their own data; supervisors see their team; the master sees all data. The existing API enforces access.

Like Android, the website needs internet. It refreshes on navigation, saving, and the refresh button; it does not stream other users' changes continuously. Document uploads and offline editing are not implemented in the existing product and are not presented as working web features.

## Browser sessions

The browser calls its own `/api/*` URLs. `api/gateway.ts` forwards allowlisted routes through `lib/gateway.ts` to the existing API. Access and rotating refresh tokens use HttpOnly, SameSite=Strict cookies, with Secure over HTTPS. Tokens are stripped from login responses and never placed in localStorage. Mutations require matching Origin to prevent CSRF, including login. Web Locks serialize refreshes across tabs, and an in-flight promise shares refreshes within a tab.

The refresh cookie lasts up to 400 days, subject to browser limits and account/session revocation. Closing the browser keeps the session. Logout and successful password changes clear cookies. Temporary network failures preserve the session for retry.

## Publish on Vercel

Create a **separate Vercel project from the same Git repository**, with Root Directory **`web`**, Framework **Vite**, Build Command **`npm run build`**, and Output Directory **`dist`**. Set server-side `CRM_API_URL` to the existing API origin (the default is supplied). Use Node.js 24. Keep the existing API project's Root Directory at **`server`**.

`vercel.json` routes `/api/*` to the gateway and applies security headers. Navigation uses fragments, so reloads and direct links work without a catch-all rewrite shadowing API functions. Static-only hosting of `dist` is insufficient: the gateway function is required.

Deploy the small `server/api/prospects/item.ts` change too: it enforces read-only completed prospects, matching Android/web archive behavior. No database migration or Android rebuild is required for this guard. The web otherwise uses existing API routes and schema.

References: [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [Vite plugin API](https://vite.dev/guide/api-plugin.html).

## Verification

```powershell
cd web
npm.cmd run build
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Browser tests require the `server` dependencies (`pnpm install --frozen-lockfile` there). The script compiles and tests the API first.

The suite runs desktop Chromium and a phone-sized Chromium viewport through the actual gateway and API handlers. An isolated in-memory PostgreSQL engine (PGlite) loads the repository schema/migrations and test accounts; it never connects to Neon. Tests verify database writes/permissions, sessions, SPK forms/delivery/filters/pagination/conflicts, prospects/history/archives, account actions, and error recovery. Unit tests check cookies, CSRF, token stripping/rotation, and validation. Reports are in ignored `playwright-report` and `test-results` directories.

These verify local application/server integration. Vercel routing, HTTPS cookies, live Neon configuration, and real-device compatibility still require a post-deployment smoke check using test accounts and records.

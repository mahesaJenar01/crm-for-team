# CRM for Team

The repository contains `app` (Android), `web` (browser), and `server` (shared API).
Android and web use the same accounts and database. For web setup, deployment,
and verification, see [web/README.md](web/README.md). On Windows, `run-web.bat`
starts the web client locally.

Android CRM for Mahesa Jenar's sales team. The application ID is
`com.mahesajenar.crmforteam`; keep it unchanged after the first public release.

## What works now

- Master, sales supervisor, and sales consultant experiences.
- Master-only account creation, account activation, and temporary-password reset.
- Master account deletion that retains SPK and prospect history; deleting a supervisor leaves their consultants without a supervisor and new SPKs in the open queue.
- Consultants grouped under their supervisor in account management, with a supervisor Sales view showing current-month SPKs and pending prospects.
- Full-page SPK creation and editing with credit details, delivery date ranges,
  automatic Open status, current-month filtering, lifetime outstanding view, and
  25-row pagination.
- SPK status filters (All by default, Open, Closed, Cancelled), with yellow open,
  green closed, and black cancelled cards. Noka allocation is entered only in the
  SPK creation/edit form by supervisors or the master.
- Delivery requires Lunas, DMS, and CRM; Plan DO requires Lunas and is automatically
  checked on delivery if not already planned, retaining an existing Plan DO date.
- Prospects default to the current creation month and Prospek berjalan. Successful
  and failed prospects are archived under Prospek selesai, with green and red cards
  and read-only follow-up history.
- Supervisor visibility and controls for team SPKs, delivery,
  cancellation, refund, and DMS/CSI incentives.
- Live SPKs, prospects, and accounts through the Vercel API and Neon database.
- Staff first-login password change and persistent server-managed sessions until logout.
- Password visibility controls while typing on sign-in, account creation, and password-change screens.

The app needs internet access. It does not store passwords. An app-private refresh
token keeps users signed in after closing the app until they log out. Changes are saved to the server.
Document upload is not available yet, so do not use the app to collect identity
documents. See [SERVER.md](SERVER.md) for server details and future work.

## Obtainium via GitHub Releases

1. Push this project to a GitHub repository.
2. Complete the one-time signing setup in [BUILDING.md](BUILDING.md).
3. Edit `versionName` in `version.properties` when you want a new semantic version.
4. Run `run.bat release`.
5. Publish the newly created `dist\crm-for-team-<versionName>-<versionCode>.apk`
   as a GitHub Release asset. Use a unique tag, preferably `v<versionName>`.
6. In Obtainium, add the GitHub repository URL (not the APK URL).

Future releases must keep the same application ID and the same signing key, and each
APK must have a larger `versionCode`. If `v<versionName>` already exists on GitHub,
choose a new `versionName`; never overwrite an existing release or tag.

Install new APKs as updates. Uninstalling the app can delete its local data and must
not be the normal update process.

See [BUILDING.md](BUILDING.md) for exact build and GitHub CLI commands.

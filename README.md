# CRM for Team

Android CRM prototype for Mahesa Jenar's sales team. The application ID is
`com.mahesajenar.crmforteam`; keep it unchanged after the first public release.

## What works now

- Master, sales supervisor, and sales consultant experiences.
- Master-only account creation.
- SPK creation with retail/fleet documents, credit details, delivery date ranges,
  automatic Open status, current-month filtering, lifetime outstanding view, and
  25-row pagination.
- Supervisor visibility and controls for team SPKs, VIN allocation, delivery,
  cancellation, refund, and DMS/CSI incentives.
- Supervisor prospect tracking and simulation data.

This first build is an offline prototype: changes live in memory and reset after the
app process is restarted. The bundled master login uses the credentials provided to
the project owner; only a one-way verifier is stored in source. Demo logins are shown
on the login screen. Before real staff or customer documents are used, implement the
server plan in [SERVER.md](SERVER.md); client-side role checks are not security.

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

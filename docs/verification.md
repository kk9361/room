# Verification report

## Render deployment follow-up - 14 November 2026

The supplied dashboard identifies `https://roommate-ledger-api.onrender.com` and shows a failed deployment of commit `a4b612e`. The attached application logs repeatedly return HTTP 503 from `/api/v1/health/ready`; this code requires database connection, indexes and bootstrap to succeed before readiness is enabled. The excerpt does not include the remote database exception. Public health, readiness, OpenAPI and empty login requests timed out from this workspace. No production login success is claimed.

The Docker start command and container health check now honor `PORT`, with an 8000 default for local containers. The Render Blueprint assigns port 10000. Failed initialization logs a sanitized stage, exception type, code and suggested action while keeping readiness at 503. Five regression cases cover invalid credentials, server selection timeout, permissions, index conflicts and bootstrap failure; they verify that private exception text never appears in logs.

The complete backend suite passed **52 tests against temporary real MongoDB**. Python lint passed. Docker/Blueprint configuration was checked statically; Docker is unavailable locally, so no image build or container execution is claimed. No frontend or Android code changed in this follow-up. See [production deployment instructions](production-login.md) for the Render settings, Atlas outbound allowlist, current service URL and verification commands. The latest changes are local and are not in the failed deployment shown. Evidence: ignored `artifacts/render-deployment-backend-tests.log`.

## Atlas-only storage follow-up — 14 November 2026

The updated private credentials passed Atlas authentication. Existing records were backed up and copied to the verified empty Atlas `roommate` database; record counts and expense reconciliation passed. The running app was restarted against Atlas, and readiness reported `{"status":"ready","database":"roommate"}`. The old persistent local MongoDB process was stopped. Normal startup now uses `scripts/atlas-dev.mjs`; the former local-database entrypoint and configuration defaults have been removed. See [Atlas-only storage](atlas-storage.md).

Automated regression checks continue to use disposable test databases, with an explicit environment and restricted database names. They do not write synthetic accounts or expenses to Atlas.

The Atlas-only follow-up passed **47 backend tests**, **9 browser tests**, Python lint, startup syntax checks and a real rejected-local-URI startup check. After the regression tests, every imported Atlas document was compared with the private recovery export and matched, including account password hashes. The website returned HTTP 200, Atlas readiness returned HTTP 200 for `roommate`, and the old local MongoDB port 27018 was closed. Evidence: ignored `artifacts/atlas-storage-verification.json` and `artifacts/atlas-only-qa.log`.

## Production login follow-up

The production-login configuration changes have their own [diagnosis and verification report](production-login.md). The earlier follow-up passed 16 URL/configuration tests, the Next.js production build, 32 backend tests against temporary real MongoDB, the existing 8 browser tests with direct API routing, and the new focused authentication browser test. The Render service URL is now identified, but hosted readiness and successful live browser login are still required; local passing tests do not establish production completion.

Verified on **13 November 2026**, Windows, in `C:\Boys_Expence`. Announcement API checks ran on 12 November; the final web build, browser checks, Android build, and packaging were refreshed on 13 November.

## Completed checks

| Check | Actual result |
| --- | --- |
| Backend unit/API/security/operations tests with isolated mock database | **30 passed** |
| Same backend suite against temporary real MongoDB 8.2.1 | **30 passed** |
| Financial concurrent submissions | 12 simultaneous requests produced one expense and one set of embedded splits |
| Financial example | ₹900 split three ways produced +₹600/−₹300/−₹300; two confirmed ₹300 settlements returned all balances to zero |
| Password/session controls | Argon2id, forced initial change, prior-session invalidation, refresh rotation/replay detection, logout passed |
| Room access and invitations | Wrong recipient, expiry, reuse, outsiders, role permissions, and final admin protection passed |
| Private spending | Cross-user and administrator access denied; room totals exclude personal expenses |
| Monthly dates | Kolkata UTC settlement boundary tests passed |
| Backup/restore | Round-trip into a new database passed; existing/live database overwrite refused |
| Next.js production build | **Passed**, including TypeScript and static generation |
| Edge browser suite | **8 passed** on the final web implementation |
| Browser flows | Bootstrap/password change, room creation, UI invitations, all three split methods, refresh persistence, private editing/deletion, recipient confirmation, CSV download, member announcement posting, recipient popup and bell badge, read acknowledgment, final admin guard, member navigation, offline save failure, retry, and guarded full-data reset |
| Full-data reset | Non-admin, wrong confirmation phrase, and wrong password rejected; valid reset emptied all non-system collections and invalidated the administrator session. UI test used only the temporary synthetic QA database. |
| Announcement permissions and privacy | Active members can post; other active members receive private unread state; the author receives no self-notification; outsider access denied; read acknowledgment changes only the recipient's unread state |
| API contract | OpenAPI snapshot regenerated with 47 paths, including unread announcements, recipient read acknowledgment, and full-data reset |
| Responsive layouts | Checked at 1440, 768, 390, and 320 pixels; no document horizontal overflow; screenshots recorded after data loaded |
| Premium mobile experience | Lavender/purple design tokens, rounded card and control system, safe-area-aware web navigation dock, working center Add action, and More drawer; phone/tablet/desktop navigation and small-screen layout passed browser checks |
| Keyboard dialog behavior | Escape closes dialog; focus management implemented; browser errors checked |
| Shared client money checks | Parser rejects invalid inputs; equal/percentage previews conserve every paisa; zero exact/percentage shares supported |
| Android TypeScript | **Passed** with Expo-aligned TypeScript 6 and React types |
| Expo SDK dependency compatibility | **Dependencies are up to date** |
| Android Metro/Hermes JavaScript export | **Passed** (3337 modules, approximately 5.2 MB Hermes bundle) |
| Expo native project generation | **Passed**, package `com.roommate.ledger` |
| Android release APK | **Passed**, rebuilt with the premium theme, live Home categories/activity, center Add navigation, member announcements, and in-app alerts: package `com.roommate.ledger` 1.0.0, minimum SDK 24, target SDK 36, compile SDK 37; signature verified with the Android debug preview key; ARM64 and x86_64 native code |
| Android artifact | `artifacts/RoomMate-Ledger-preview.apk`; SHA-256 recorded alongside the APK |
| Android device interaction | **Not verified**: the final ADB check reported no attached devices. An earlier emulator attempt stalled before installation; no successful device installation or interaction is claimed. |
| Dependency audits | Web: 0 known vulnerabilities; mobile: 0 known vulnerabilities; Python: no known vulnerabilities reported |
| Private configuration | `.env`, data, backups, tools, native signing files, and test authentication state ignored/excluded |
| Source packaging | Final source ZIP integrity and private-value checks passed; SHA-256 recorded alongside the archive |
| Historical local mode (removed 14 November) | This earlier check used the retired local startup option; normal app storage is now Atlas |
| Historical Atlas connection check (13 November) | Timed out or rejected credentials; superseded by the successful Atlas migration and readiness checks on 14 November above |

## Release verification still required

- **Atlas from the hosted service:** local Atlas authentication, migration and readiness passed on 14 November. Render still needs its own current private URI and outbound network access in Atlas, then successful hosted readiness. The supplied failed-deployment logs do not establish the exact remote database error.
- **Standalone Android APK and device:** APK compilation, signature, and metadata verification passed. The preview APK uses Android's development key and emulator API `http://10.0.2.2:8000/api/v1`. Set a reachable HTTPS backend URL for phone distribution and sign a production AAB with the release identity before store publication. No Android device is attached, so app installation and interaction remain unverified.
- **Hosted production:** Vercel and Render service URLs are supplied, but their account access is not connected. The latest Render deployment shown failed. Deploy the latest source, configure the backend environment and Atlas allowlist, then verify readiness and browser login. No successful cloud deployment or store publication is claimed.
- **External delivery:** invitation tokens and in-app announcement alerts work. Email invitation delivery and operating-system push while the app is closed are not implemented.
- **Docker runtime:** Docker was unavailable on this computer; the deployment files have not been built under Docker here.

## Evidence and reproducibility

- `apps/web/tests/ledger.spec.ts`: actual browser workflows.
- `apps/web/tests/money.spec.ts`: shared client money invariants.
- `backend/tests/`: unit, API, concurrency, privacy, time boundary, and backup tests.
- `artifacts/dashboard-1440.png`, `dashboard-768.png`, `dashboard-390.png`, `dashboard-320.png`: final data-loaded screenshots (local artifacts, not source fixtures).
- `artifacts/playwright-report/`: browser results.
- `artifacts/android-build.log`, `android-sdk-install.log`: native tooling/build evidence.
- `artifacts/android-announcements-build.log`: Android rebuild containing member announcement posting and native in-app alerts.
- `artifacts/android-premium-build.log`, `android-premium-verification.txt`: successful final premium APK build, package/ABI metadata, signature verification, and checksum.
- `artifacts/atlas-premium-check.txt`: final sanitized read-only Atlas connection result.
- `scripts/qa.mjs`: temporary real-Mongo environment, isolated test databases, service startup and teardown. `--backend-only` runs the real database suite; `--skip-backend` runs browser verification against a fresh temporary stack after an unchanged backend suite has passed.
- `scripts/check_atlas.py`: read-only live connection diagnostic that does not print credentials.
- `scripts/package_release.py`: source archive, SHA-256 checksum, integrity and secret checks.

Third-party Mongo mock code emits Python `utcnow()` deprecation warnings, and the installed Starlette test client warns about its legacy `httpx` adapter. These are warnings, not failed assertions. Application timestamps use timezone-aware UTC.

## Android native status

The mobile design system now shares the lavender/purple palette and card styling. The home screen adds API-backed monthly category totals and recent shared activity; the center Add tab opens the real expense form, and Settle remains available from the Home quick action. The noticeboard remains available to all active members, with native alerts, a Home badge, and per-announcement read controls. Notifications are checked every ten seconds while using the selected room; email and operating-system push delivery while the app is closed are not implemented. Native compilation initially exposed Windows Ninja path limits; the tracked Expo config plugin sets the SDK-supported `expo.android.cmakeObjectPathMax=250` option on Windows, and introspection confirmed fresh generated projects receive it. SDK/NDK archives were verified against official repository checksums. The preview APK is signed with the Android debug preview key. An interrupted NDK directory containing only installer metadata was preserved under `.tools/incomplete-ndk-27.1.12297006`.

The final `assembleRelease` completed successfully after resuming the interrupted build without clearing its native outputs: 655 tasks, 51 executed and 604 up-to-date. `apksigner verify` and `aapt dump badging` passed for the new artifact, and the SHA-256 sidecar was verified against its bytes. The build script now writes that sidecar automatically on future APK builds.

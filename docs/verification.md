# Verification report

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
| Persistent local mode | Real MongoDB, API and Next.js started; HTTP page 200, readiness 200, admin login 200, forced password change true; stopped cleanly afterwards |
| Supplied Atlas connection | Final 13 November read-only check returned **ServerSelectionTimeoutError**. Earlier attempts reached Atlas but authentication was rejected with code 8000. No live data was modified. |

## Release verification still required

- **Live Atlas:** the final connection check timed out before selecting a server. Check Atlas hostname, network access list, DNS, and TLS, then verify the database credentials in private `.env`; earlier attempts rejected authentication even with the password URL-encoded and database `roommate` selected. Rerun `scripts/check_atlas.py` before live verification. No live Atlas data was read, modified, dropped, or reset.
- **Standalone Android APK and device:** APK compilation, signature, and metadata verification passed. The preview APK uses Android's development key and emulator API `http://10.0.2.2:8000/api/v1`. Set a reachable HTTPS backend URL for phone distribution and sign a production AAB with the release identity before store publication. No Android device is attached, so app installation and interaction remain unverified.
- **Hosted production:** no hosting account/project, public backend domain, or release signing identity was supplied. Container and EAS configuration are included; no cloud deployment or store publication is claimed.
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

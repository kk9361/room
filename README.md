# RoomMate Ledger

A working household expense ledger built from the supplied architecture pack. The original ZIP contained specifications only; those files are preserved under `specification/`.

The app includes FastAPI + async PyMongo, Next.js + TypeScript + Tailwind, and Expo Router for Android. Accounts, rooms, invitations, categories, equal/exact/percentage splits, reversals, balances, confirmed settlements, private personal expenses, reports, CSV exports, room announcements with member posting and unread notifications, platform administration, and audit logs are implemented.

Any active room member can publish an announcement. Other active members receive an in-app popup and unread bell badge on the web, or a native alert while using Android; they can open the announcement or mark it read. These are in-app notifications and do not send email or operating-system push messages while the app is closed.

To post on the web, select your room, open **Announcements → New announcement**, enter a title and message, then select **Publish announcement**. Other members see the popup within about ten seconds while they have that room open. The bell keeps unread announcements until each member opens or marks them read. On Android, publish from the room section in **Profile**; incoming announcements show a native popup and an unread badge on **Home**.

## Start on this computer

The toolchain and dependencies have already been installed in this workspace. Your private Atlas configuration and generated temporary administrator password are in `.env`. Open that file locally to retrieve `BOOTSTRAP_PASSWORD`; it is deliberately excluded from source control and deliverable ZIPs.

Application data is stored in **MongoDB Atlas**, database `roommate`. The startup command verifies Atlas connectivity before starting FastAPI and Next.js. Correct the private Atlas credentials/network access if that check fails; startup never switches to an on-computer database.

```powershell
Set-Location C:\Boys_Expence
npm run dev
```

Open **http://127.0.0.1:3000**. Sign in as `admin` using the temporary password from `.env`, then choose your own new password. Create a room and invite your roommates by their username or email. Each person registers their own account and accepts their invitation using “Join with invitation”.

The website and API run on this computer, while accounts, rooms, expenses and other application records are saved in Atlas. Ctrl+C stops the website/API. The former local database startup option has been removed. Historical files under `.local-data` and private backups are preserved for recovery; normal application startup never opens them.

See [Atlas-only storage](docs/atlas-storage.md) for the current startup behavior, existing-data migration and test isolation.

## Clean installation

Requirements: Windows PowerShell, Node.js **22.13+**, and Python 3.11+ to install `uv`. The setup script downloads a project-local Python 3.12 environment. Android native builds additionally need Android Studio, Android SDK, and a compatible JDK.

```powershell
Set-Location C:\Boys_Expence
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
npm run dev
```

Setup preserves an existing `.env`. On a fresh checkout, it asks for database details and a hidden temporary admin password and generates the JWT signing key. Dependency lockfiles are included for all three projects.

## Use MongoDB Atlas

1. Correct the database user's credentials in the private `.env`. Password characters such as `@` must be URL-encoded (`%40`) inside the URI. Use the Atlas **database user**, not an Atlas website login.
2. Keep `MONGODB_DATABASE=roommate`; account records use `users`. Other modules create their own collections. Setup never resets data. The Platform admin has a separate, password-protected clear action that permanently deletes every document in every application collection, including all user accounts and audit history; collection and index definitions remain.
3. Allow this computer/deployment's IP in Atlas network access and grant the database user appropriate access to `roommate`.
4. Stop any previously running app before restarting with `npm run dev`; the API and website use ports 8000/3000.

```powershell
.\.venv\Scripts\python.exe scripts\check_atlas.py
powershell -File scripts\start-atlas.ps1
```

In another terminal:

```powershell
npm --prefix apps/web run dev
```

API documentation: **http://127.0.0.1:8000/docs**. Liveness: `/api/v1/health`. Readiness: `/api/v1/health/ready`; it returns 503 if database initialization or connectivity fails. Restart the API after changing configuration.

## Financial and security rules

- INR amounts are strict integer paise. Shared expenses and all their splits are saved in **one atomic MongoDB document**, so transactions are not needed for financial posting. There is no separate split collection that could be partially written.
- Equal splits allocate remainder paise by sorted user ID. Percentage splits use integer basis points and largest remainder allocation. Both clients use the same shared TypeScript implementation; the backend independently validates every submission.
- Posted shared expenses cannot be silently edited or deleted. Creator/admin reversals retain the original and reason. Reversed expenses are excluded from balances and reports.
- Net balance = shared paid − assigned shares + confirmed settlements sent − confirmed settlements received. Positive means a member is owed money. Pending/rejected/cancelled payments have no balance effect.
- Financial creates require `Idempotency-Key`. Replaying the same payload returns the original; reusing a key for a changed payload returns 409. Confirmation and reversal transitions also safely handle repeated requests.
- Passwords use Argon2id. JWT access tokens expire in 15 minutes. Web refresh credentials use HttpOnly SameSite cookies; Android uses SecureStore. Refresh reuse revokes the session family. Password changes revoke previous sessions. The bootstrap admin must replace the temporary password.
- Platform admins can clear all application records after re-entering their password and typing `CLEAR ALL DATA`. This also deletes the current admin, every session, and the audit history. Restart the API afterward to bootstrap a new admin from `.env`; the configured bootstrap credentials must be available. External backups are not affected.
- Room administrators cannot read another user's personal spending. Platform admin lists and audit logs do not expose personal purchase amounts/descriptions. Email password recovery is explicitly disabled until an email delivery service is implemented.
- Room membership and invitation acceptance use optimistic concurrency on one room document, protecting the final administrator and one-time invitation use. Rooms are capped at 100 membership entries. Lists are paginated, usually 20 per page with a maximum of 100.
- Room-scoped dates are stored as ISO local calendar dates; settlement timestamps are UTC. Monthly settlement reports use the configured room timezone's UTC boundaries.

## Android

```powershell
Set-Location apps/mobile
Copy-Item .env.example .env.local
npm start
```

Android emulator API: `http://10.0.2.2:8000/api/v1`. This address connects to FastAPI on the computer; FastAPI saves data in Atlas. For a physical phone, use a hosted HTTPS backend. Never put database credentials in mobile or web configuration.

Type checking and Android JavaScript bundling:

```powershell
npm run typecheck
npm run export:android
```

To build a standalone preview APK locally, set `JAVA_HOME` and `ANDROID_HOME`, then run from the repository root:

```powershell
powershell -File scripts/build-android.ps1 -ApiUrl http://10.0.2.2:8000/api/v1
```

The script regenerates the native project and copies the APK to `artifacts/RoomMate-Ledger-preview.apk`. This preview uses the generated development signing key; use your own signing identity for distribution. EAS `preview` and `production` profiles are included. EAS requires your Expo account/project. Set a real HTTPS `EXPO_PUBLIC_API_URL` for production; a guard rejects the placeholder hostname. Development cleartext networking is enabled only when explicitly targeting an HTTP API; production builds disable it.

## Verification

```powershell
# Fast unit and API tests using an isolated Mongo mock
Set-Location backend
..\.venv\Scripts\python.exe -m pytest -q

# Production web build
Set-Location ../apps/web
npm run build

# Full real-Mongo integration + Edge browser workflows
Set-Location ../..
npm run qa
```

The QA runner creates temporary MongoDB databases, runs backend tests, starts the API and the production web server, runs Playwright, then shuts down its processes. It never uses the Atlas URI. Install Microsoft Edge for the default browser channel, or adjust `apps/web/playwright.config.ts` to an installed Playwright browser. Build the web app before running full QA. Ports 8000 and 3000 must be free.

Tests cover money conservation, rounding, bad amounts, payer outside split participants, role boundaries, invitation recipient/expiry/reuse, final admin protection, refresh rotation/reuse/logout, forced password change, concurrent idempotency, private CRUD/reports, settlement transitions, reversal, Kolkata reporting boundaries, exports, audit privacy, rate limiting, and backup restoration. Browser tests exercise the actual forms and desktop/tablet/mobile layouts.

See [the verification report](docs/verification.md) for actual results and external release blockers. No hosted deployment or physical device installation is implied by a successful local build.

## Operations

Backups contain private user data and password hashes. Store them privately, restrict access, and encrypt them outside this application. Refresh sessions and rate limit buckets are deliberately omitted; restored users sign in again.

```powershell
.\.venv\Scripts\python.exe scripts/database_tools.py reconcile
.\.venv\Scripts\python.exe scripts/database_tools.py backup --file .backups/ledger-backup.json
.\.venv\Scripts\python.exe scripts/database_tools.py restore --file .backups/ledger-backup.json --database roommate_restore_review
```

Restore accepts only a brand-new database whose name starts with `roommate_restore_`; it never overwrites a database. Review and reconcile the restored data before deliberately changing your environment to use it. A backup/restore round-trip is part of the automated suite.

Dockerfiles and `infra/compose.yaml` are provided for container hosting. Docker was not available for local validation. Production needs HTTPS termination, `APP_ENV=production`, `COOKIE_SECURE=true`, a strong private JWT key, a CORS origin allowlist, least-privilege Atlas access, a backup schedule, and a real Android API URL. Keep web and API on the same origin through the Next.js proxy. The API proxy URL is chosen at web build time.

For the Vercel frontend and the Render FastAPI service, see the [production login and deployment guide](docs/production-login.md). The supplied Render dashboard identifies `https://roommate-ledger-api.onrender.com`; its latest deployment shown failed database readiness. The guide covers the current failure, private Atlas settings, Render port configuration, Vercel URL variables and PowerShell verification/deployment commands. Hosted readiness and browser login still need to pass after redeployment.

## Repository

```text
apps/web/                 Next.js web application and browser tests
apps/mobile/              Expo Router Android application
backend/app/              API routers, schemas, services, repositories, database setup
backend/tests/            Money, API, security, concurrency, and operations tests
packages/api-contract/    Shared client types, money utilities, OpenAPI snapshot
scripts/                  Setup, local stack, QA, Atlas diagnostics, APK build, operations
infra/                    Container deployment configuration
docs/                     Implementation and verification notes
specification/            Original architecture pack, preserved as reference
```

The implementation uses the maintained [PyMongo Async API](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/reference/migration/), [Next.js App Router](https://nextjs.org/docs/app), and [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/). Architecture details in the original pack that differ from the atomic document design are explained in [implementation notes](docs/implementation.md).

# Production login: diagnosis, deployment and verification

**14 November deployment update:** The supplied Render dashboard identifies the backend as `https://roommate-ledger-api.onrender.com`. Its deployment of commit `a4b612e` failed: the attached logs repeatedly show HTTP 503 from `/api/v1/health/ready`, followed by Render's health-check timeout. The exact remote database exception is absent from the supplied excerpt. Public requests from this workspace timed out, so hosted readiness and production login remain unverified.

Atlas authentication now passes from this computer with the corrected private credentials. Existing records were imported into Atlas `roommate`, and the running local API reports that database as ready. Normal startup uses Atlas exclusively; see [Atlas-only storage](atlas-storage.md). Render has separate environment variables and network access; editing local `.env` does not update that service.

## Current verified state

The supplied website is `https://room-six-murex.vercel.app`. The backend route is **`POST https://roommate-ledger-api.onrender.com/api/v1/auth/login`**, identified from the dashboard's service URL and this repository's FastAPI router. This identifies the intended route; it does not establish a healthy hosted service.

Current deployment findings:

| Check | Actual result |
| --- | --- |
| Render deployment shown in dashboard | Failed on commit `a4b612e`; readiness timed out |
| Attached Render application logs | Repeated `GET /api/v1/health/ready` returned 503 |
| Application readiness implementation | Requires database connection, indexes and administrator bootstrap to succeed |
| Local Atlas connection and running API | Passed; readiness reports database `roommate` |
| Public backend health, readiness, OpenAPI and empty login request | Timed out from this workspace on 14 November; no credentials sent |
| Render private environment / Atlas network allowlist | Not inspected; user plans to update them before redeploying |
| Latest Atlas-only and container changes | Present locally; not part of the failed deployment shown |

Earlier read-only HTTP checks on 13 November 2026 found:

| Request | Actual result |
| --- | --- |
| Website `/` | 200 HTML |
| Website `/api/v1/health` | 404 JSON, `Cannot GET /api/v1/health` |
| Website `/api/v1/health/ready` | 404 JSON |
| Website `POST /api/v1/auth/login` with `{}` | 404 JSON, `Cannot POST /api/v1/auth/login` |
| Previously suggested example host `roommate-api.onrender.com` health and OpenAPI | Both 404; not a verified deployment of this project |

The earlier example host returned the same error format as the production proxy, suggesting a wrong upstream. Use the actual dashboard URL above after it passes readiness. Neither Render nor Vercel account access is connected in this workspace. **Production login remains unverified and the production fix is incomplete.**

## What the code actually does

- `apps/web/src/lib/api.ts` originally used a fixed `/api/v1` base. Thus browser requests intentionally went to the Vercel origin.
- `apps/web/next.config.ts` forwarded that prefix to `API_INTERNAL_URL` at build time. Same-origin requests are valid when that proxy points to this FastAPI service; the browser URL alone does not prove a routing error.
- FastAPI mounts `backend/app/api/v1/auth.py` under `/api/v1` in `backend/app/main.py`. The actual route is **`POST /api/v1/auth/login`**, with JSON fields `identifier` and `password`. No duplicate endpoint is needed.
- Registration, refresh, logout and account identity are `/api/v1/auth/register`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`, and `/api/v1/auth/me`. Invitations are `/api/v1/rooms/{room_id}/invitations` and `/api/v1/invitations/accept`.
- All browser HTTP calls, including CSV downloads, already share the API client. It now reads `NEXT_PUBLIC_API_BASE_URL` directly, so direct backend access works consistently across features.
- The URL normalizer accepts a backend origin or its `/api/v1` base and appends the version prefix exactly once. Credentials, query strings and endpoint paths are rejected. Vercel builds without an upstream are rejected instead of falling back to loopback.
- JWT access tokens stay in memory. Web refresh tokens stay in an HttpOnly cookie; they are not placed in localStorage or returned as mobile refresh tokens. The server validates signature, expiry, user auth version and session revocation. Logout revokes the session and deletes its cookie.
- Direct access from `vercel.app` to a different site requires `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and exact credentialed CORS. Cross-site cookies can still be blocked by browser privacy settings. The existing same-origin proxy remains available for those browsers; it can keep `COOKIE_SAMESITE=strict`.

## Repair the existing Render deployment first

1. Commit and push the reviewed source changes to `kk9361/room`, branch `main`. Keep private `.env` files excluded. The failed screenshot's commit predates the Atlas-only and deployment changes now in the workspace.
2. Open the existing **roommate-ledger-api** service in [Render](https://dashboard.render.com). Update its **Environment** with the values below before redeploying. Do not create a second service.
3. Copy the complete, working Atlas URI from private configuration into Render's `MONGODB_URI`. It must contain the current URL-encoded database password and no `<db_password>` placeholder. A password reset in Atlas or an edit to local `.env` does not update Render's saved URI.
4. Open this service's **Connect > Outbound** tab and add every listed CIDR range to **Atlas > Network Access**. Verify that the Atlas database user can read and write `roommate` and create its indexes. Wait for the allowlist entries to become active.
5. Keep the health-check path **`/api/v1/health/ready`** in Render Settings. The container now binds to `0.0.0.0:$PORT`; the Blueprint sets `PORT=10000`. Its Docker health check uses the same port. Port alignment is a separate correction: the supplied 503 responses already establish that Render reached the old application.
6. Select **Manual Deploy > Deploy latest commit** after the environment and network changes are saved. A successful startup logs `{"event":"database_ready"}`. Failed startup now emits a sanitized `database_unavailable` event with its stage, error type, numeric code and suggested action, without exception text or secrets.
7. Run the verification command below. Database readiness must pass before configuring Vercel. Existing application passwords remain valid; bootstrap secrets do not reset existing users. For a newly created admin, retrieve `BOOTSTRAP_PASSWORD` privately from Render and change it at first sign-in.

| Render environment key | Value |
| --- | --- |
| `PORT` | `10000` |
| `APP_ENV` | `production` |
| `MONGODB_URI` | Complete working Atlas URI, entered privately |
| `MONGODB_DATABASE` | `roommate` |
| `JWT_SECRET` | Keep the existing generated private secret, at least 32 characters |
| `BOOTSTRAP_USERNAME` | `admin` |
| `BOOTSTRAP_PASSWORD` | Keep the existing generated private secret; at least 12 characters if creating an initial admin |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` for direct browser requests |
| `CORS_ORIGINS` | `https://room-six-murex.vercel.app` |

If readiness still fails, find the first new `database_unavailable` event in the deployment logs:

| Diagnostic action | Check |
| --- | --- |
| `check_atlas_database_user_credentials` | Current Atlas database username/password in Render's URI; codes 18 or 8000 |
| `check_atlas_network_access_dns_tls` | Render outbound ranges in Atlas, cluster availability, DNS and TLS |
| `check_database_user_permissions` | Atlas database role for `roommate`; code 13 |
| `check_database_indexes_and_duplicate_records` | Index conflicts or duplicate indexed records; codes 85, 86 or 11000 |
| `check_bootstrap_configuration` | Initial-admin configuration if bootstrap is needed |

The logs supplied so far do not identify which of these caused the remote failure. Keep the readiness check strict; using the liveness path would hide failed database initialization. After fixing startup settings, restart/redeploy so initialization runs again.

Render's free services sleep on idle and have usage limits. They are useful for evaluation, but their cold starts are unsuitable for a reliable always-on production service. Deployment of the Docker image itself has not been tested locally because Docker is unavailable.

## Exact Vercel variables after the backend is verified

For direct browser requests, use:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://roommate-ledger-api.onrender.com/api/v1` |
| `API_INTERNAL_URL` | `https://roommate-ledger-api.onrender.com` |

These are public routing addresses, not credentials. Keep `MONGODB_URI`, `JWT_SECRET`, `BOOTSTRAP_PASSWORD`, `COOKIE_*`, `APP_ENV`, and `CORS_ORIGINS` on the backend host. Do not import the backend `.env` into Vercel. Set Production variables for the production website and redeploy: public variables and rewrites are fixed during `next build`.

Keep the Vercel framework as Next.js, Root Directory `apps/web`, Node 22.x, install command `npm ci`, build command `npm run build`, and output directory at its default. Enable **Include source files outside of the Root Directory in the Build Step** so `packages/api-contract` is available.

## Windows PowerShell commands

Use Node.js 22.13 or newer. The first block commits and pushes source changes; review `git status` before running it.

```powershell
Set-Location C:\Boys_Expence
git status --short
git add .
git commit -m "Require Atlas storage and fix Render startup diagnostics and port"
git push origin main
```

Update the existing Render service and Atlas access as described above, then deploy its latest commit. The backend URL below comes from the supplied Render dashboard:

```powershell
$backendUrl = 'https://roommate-ledger-api.onrender.com'
.\scripts\Test-ProductionApi.ps1 -BackendUrl $backendUrl
```

The checker verifies health, the `RoomMate Ledger API` OpenAPI identity, the real login route, database readiness, body validation and credentialed CORS before asking for any application credentials. Next, deploy to the **existing** Vercel project when the CLI asks which project to link:

```powershell
.\scripts\Deploy-Vercel.ps1 -BackendUrl $backendUrl
```

This signs in to Vercel, links the existing project, configures both URL variables and deploys production. It uses Vercel's CLI from the repository root so shared source is included. Cloud sign-in and production deployment have not been performed by the agent.

Test application login securely; enter the RoomMate Ledger account password in the credential prompt, never the Atlas database password:

```powershell
.\scripts\Test-ProductionApi.ps1 -BackendUrl $backendUrl -TestLogin
```

This checks invalid-password rejection, successful login, bearer-token validation, protected account/dashboard data, cookie refresh and logout revocation. A new bootstrap admin must first change the temporary password in the website. These are API checks; Windows PowerShell does not reproduce browser cross-site cookie restrictions.

Finally open `https://room-six-murex.vercel.app` in a browser, sign in, reach the dashboard, reload it, and sign out. With direct access, DevTools must show API requests to the verified backend origin. Confirm there are no 404s or CORS failures and reload preserves the session. Only this successful production browser flow completes the task.

If browser privacy settings block the separate backend's refresh cookie, redeploy using the preserved same-origin mode:

```powershell
.\scripts\Deploy-Vercel.ps1 -BackendUrl $backendUrl -UseProxy
```

This sets `NEXT_PUBLIC_API_BASE_URL=/api/v1` and forwards through the verified `API_INTERNAL_URL`. Browser requests will intentionally show the Vercel domain. They must return FastAPI responses. With this mode, set backend `COOKIE_SAMESITE=strict` and redeploy the backend. Do not use the relative browser value without the server proxy target.

## Validation performed in this workspace

Changed files:

- Web routing: `apps/web/src/lib/api.ts`, `apps/web/next.config.ts`, `apps/web/config/api-url.mjs`, `apps/web/.env.example`.
- Web tests and commands: `apps/web/config/api-url.test.mjs`, `apps/web/tests/auth-connectivity.spec.ts`, `apps/web/package.json`, `scripts/qa.mjs`.
- Backend sessions: `backend/app/core/config.py`, `backend/app/services/auth.py`, `backend/app/api/v1/auth.py`, `.env.example`.
- Backend tests: `backend/tests/conftest.py`, `backend/tests/test_production_auth.py`.
- Deployment and documentation: `render.yaml`, `scripts/Test-ProductionApi.ps1`, `scripts/Deploy-Vercel.ps1`, `.gitignore`, `README.md`, `docs/verification.md`, `docs/production-login.md`.

The premium UI source and styles were not changed.

| Check | Actual result |
| --- | --- |
| URL normalization and Vercel build guard | 16 Node tests passed |
| Next.js production build and TypeScript | Passed in both direct-backend and same-origin proxy modes |
| Backend suite against temporary real MongoDB 8.2.1 | 32 passed, including HTTPS cookie/CORS authentication and logout revocation |
| Existing browser regression suite | 8 passed with direct browser API requests |
| New browser authentication test | Passed on its focused rerun after correcting ambiguous alert selection and cookie-path lookup in the test |
| Existing same-origin proxy authentication | Focused browser authentication test passed again against a separate production build using `/api/v1` and the Next.js proxy |
| Authentication browser coverage | Invalid password, UI registration, login, HttpOnly cookie, no token in browser storage, reload persistence, protected dashboard and logout revocation |
| PowerShell API checker | Passed against the isolated QA API, including credentialed login, refresh and logout; rejected the unverified example host before requesting credentials |
| PowerShell deployment helper | Syntax parsed; cloud login/deployment not executed |
| Python lint | Passed for all changed Python files |
| Render Blueprint | YAML parsed; Dockerfile path and private/generated secret settings checked; cloud deployment not executed |
| Latest Atlas-only and startup-diagnostics backend suite | 52 passed against temporary real MongoDB; includes five failing-startup cases with readiness and secret-safe log assertions |
| Render port configuration | Docker command uses `PORT` with an 8000 local default; Blueprint assigns 10000; Docker image runtime not verified locally |
| Production browser login | Not verified; supplied Render deployment failed and account access is unavailable |

The existing 8 browser tests passed in the initial full run. The new authentication test then passed separately; a fresh complete 9-test rerun was unnecessary. Logs are in the ignored `artifacts/login-api-*` files. No production accounts, rooms or expenses were created by the diagnostics. No login credentials were sent to the unverified example host. Temporary MongoDB and synthetic QA accounts were used for local tests.

## Official references

- [Next.js public environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)
- [Render Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render health checks](https://render.com/docs/health-checks)
- [Render port binding](https://render.com/docs/web-services#port-binding)
- [Render outbound IP ranges](https://render.com/docs/outbound-ip-addresses)
- [Render free service limits](https://render.com/docs/free)
- [Vercel environment CLI](https://vercel.com/docs/cli/env)
- [Cross-site cookie attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

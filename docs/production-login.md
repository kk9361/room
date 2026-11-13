# Production login: diagnosis, deployment and verification

## Current verified state

The supplied website is `https://room-six-murex.vercel.app`. Read-only HTTP checks on 13 November 2026 found:

| Request | Actual result |
| --- | --- |
| Website `/` | 200 HTML |
| Website `/api/v1/health` | 404 JSON, `Cannot GET /api/v1/health` |
| Website `/api/v1/health/ready` | 404 JSON |
| Website `POST /api/v1/auth/login` with `{}` | 404 JSON, `Cannot POST /api/v1/auth/login` |
| Previously suggested example host `roommate-api.onrender.com` health and OpenAPI | Both 404; not a verified deployment of this project |

The example host returns the same error format as the production proxy. This suggests a wrong upstream, but the Vercel project's private environment settings have not been inspected. No actual FastAPI deployment URL has been identified. The user does not know that URL. No Render API key, Vercel token or linked Vercel project is available in this workspace. **Production login remains unverified and the production fix is incomplete.**

## What the code actually does

- `apps/web/src/lib/api.ts` originally used a fixed `/api/v1` base. Thus browser requests intentionally went to the Vercel origin.
- `apps/web/next.config.ts` forwarded that prefix to `API_INTERNAL_URL` at build time. Same-origin requests are valid when that proxy points to this FastAPI service; the browser URL alone does not prove a routing error.
- FastAPI mounts `backend/app/api/v1/auth.py` under `/api/v1` in `backend/app/main.py`. The actual route is **`POST /api/v1/auth/login`**, with JSON fields `identifier` and `password`. No duplicate endpoint is needed.
- Registration, refresh, logout and account identity are `/api/v1/auth/register`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`, and `/api/v1/auth/me`. Invitations are `/api/v1/rooms/{room_id}/invitations` and `/api/v1/invitations/accept`.
- All browser HTTP calls, including CSV downloads, already share the API client. It now reads `NEXT_PUBLIC_API_BASE_URL` directly, so direct backend access works consistently across features.
- The URL normalizer accepts a backend origin or its `/api/v1` base and appends the version prefix exactly once. Credentials, query strings and endpoint paths are rejected. Vercel builds without an upstream are rejected instead of falling back to loopback.
- JWT access tokens stay in memory. Web refresh tokens stay in an HttpOnly cookie; they are not placed in localStorage or returned as mobile refresh tokens. The server validates signature, expiry, user auth version and session revocation. Logout revokes the session and deletes its cookie.
- Direct access from `vercel.app` to a different site requires `COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and exact credentialed CORS. Cross-site cookies can still be blocked by browser privacy settings. The existing same-origin proxy remains available for those browsers; it can keep `COOKIE_SAMESITE=strict`.

## Deploy the real FastAPI backend first

1. Commit and push the reviewed source changes to `kk9361/room`. Never commit `.env` files, database credentials or token values.
2. Sign in to [Render](https://dashboard.render.com), select **New → Blueprint**, and connect that repository. Render reads the new root `render.yaml`.
3. Enter the actual Atlas connection URI privately when Render asks for `MONGODB_URI`. Password characters in that URI must be URL encoded. Do not put this URI in Vercel's public variables.
4. The Blueprint builds the existing Python 3.12 Dockerfile, generates separate random JWT and initial-admin secrets, selects database `roommate`, enables secure cross-site cookies, and sets `CORS_ORIGINS=https://room-six-murex.vercel.app`.
5. Open the newly created backend service's **Connect → Outbound** tab. Allow its IP ranges in **Atlas → Network Access**. Verify the Atlas database user's permissions and credentials. Restart/redeploy the backend if initialization failed before network access was added.
6. Copy the actual HTTPS service URL from the top of Render's service page. Do not assume a hostname from the service name. The earlier example address is not yours unless your dashboard independently confirms it.
7. Run the verification command below. Readiness must pass before configuring Vercel. If there are already users in Atlas, their existing application credentials remain in force; bootstrap secrets do not reset existing users. For a newly created admin, retrieve the generated `BOOTSTRAP_PASSWORD` privately from Render and change it at first sign-in.

Render's free services sleep on idle and have usage limits. They are useful for evaluation, but their cold starts are unsuitable for a reliable always-on production service. Deployment of the Docker image itself has not been tested locally because Docker is unavailable.

## Exact Vercel variables after the backend is verified

For direct browser requests, use:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | The verified backend HTTPS origin followed by `/api/v1` |
| `API_INTERNAL_URL` | The same verified backend HTTPS origin; preserves the existing API proxy for older clients and diagnostics |

These are public routing addresses, not credentials. Keep `MONGODB_URI`, `JWT_SECRET`, `BOOTSTRAP_PASSWORD`, `COOKIE_*`, `APP_ENV`, and `CORS_ORIGINS` on the backend host. Do not import the backend `.env` into Vercel. Set Production variables for the production website and redeploy: public variables and rewrites are fixed during `next build`.

Keep the Vercel framework as Next.js, Root Directory `apps/web`, Node 22.x, install command `npm ci`, build command `npm run build`, and output directory at its default. Enable **Include source files outside of the Root Directory in the Build Step** so `packages/api-contract` is available.

## Windows PowerShell commands

Use Node.js 22.13 or newer. The first block commits and pushes source changes; review `git status` before running it.

```powershell
Set-Location C:\Boys_Expence
git status --short
git add .
git commit -m "Fix API deployment configuration and cross-origin web sessions"
git push origin main
```

Create the Render Blueprint, configure Atlas access, and copy its actual service URL. This prompt avoids publishing an invented example hostname:

```powershell
$backendUrl = Read-Host 'Paste the actual HTTPS URL from your Render backend service'
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
| Production browser login | Not verified; real FastAPI backend URL and hosting access still required |

The existing 8 browser tests passed in the initial full run. The new authentication test then passed separately; a fresh complete 9-test rerun was unnecessary. Logs are in the ignored `artifacts/login-api-*` files. No production accounts, rooms or expenses were created by the diagnostics. No login credentials were sent to the unverified example host. Temporary MongoDB and synthetic QA accounts were used for local tests.

## Official references

- [Next.js public environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/)
- [Render Blueprint configuration](https://render.com/docs/blueprint-spec)
- [Render outbound IP ranges](https://render.com/docs/outbound-ip-addresses)
- [Render free service limits](https://render.com/docs/free)
- [Vercel environment CLI](https://vercel.com/docs/cli/env)
- [Cross-site cookie attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)

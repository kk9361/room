# Atlas-only application storage

Normal development and production save application records in MongoDB Atlas. The default database is `roommate`. The browser and Android app call FastAPI; neither stores the ledger in browser storage or connects directly to MongoDB.

## Startup

Keep the complete Atlas connection URI and backend secrets in the private root `.env`. The URI must contain the real URL-encoded database password, not `<db_password>`.

```powershell
Set-Location C:\Boys_Expence
npm run dev
```

If Node is installed only in the workspace toolchain:

```powershell
.\.tools\node_modules\node\bin\node.exe scripts\atlas-dev.mjs
```

Startup checks Atlas, starts FastAPI, waits for database readiness, then starts Next.js. It does not start MongoDB, replace `MONGODB_URI`, or change the configured database. The website/API run on this computer; records remain in Atlas.

For a connection-only check:

```powershell
.\.venv\Scripts\python.exe scripts\check_atlas.py
```

Backend-only startup is still available through `scripts/start-atlas.ps1`, with the same connection preflight. Backend settings reject local database URLs in development and production. Missing/invalid credentials stop startup instead of selecting another database.

## Existing records

On 14 November 2026, the updated private credentials passed Atlas authentication. The target `roommate` database was checked and contained no application documents. Existing application records were backed up privately, then imported with their original IDs, membership references, financial values and password hashes. Imported collection counts and expense reconciliation were verified. The previous app supervisor was stopped, and the app was restarted against Atlas.

Migration evidence is in ignored `artifacts/atlas-storage-migration-result.json`. Private recovery exports are under `.backups`; historical `.local-data` files are preserved but are not opened by normal startup. Active session tokens were not transferred, so sign in again with your existing application password. Updating the Atlas database password does not change application account passwords.

To inspect the records, refresh Atlas Data Explorer and select `roommate`, then `users`, `rooms`, `expenses`, `settlements` or `announcements`. Backend readiness at `http://127.0.0.1:8000/api/v1/health/ready` must report database `roommate`.

## Automated tests

Tests use explicit `APP_ENV=test` and disposable databases named `test_*` or `qa_*`. This protects the real Atlas ledger from test operations, including the full-data-clear regression test. Test databases are not an application startup option, and normal application startup rejects a test setting against database `roommate`.

The retired `scripts/local-dev.mjs` entrypoint has been removed. `npm run dev` now points to `scripts/atlas-dev.mjs`. Setup requires Atlas credentials and no longer offers a blank-host local mode.

The storage change passed 47 backend tests and 9 browser tests. A final document-by-document comparison confirmed that the imported Atlas records still matched the private backup after the isolated tests finished.

## Hosting

This storage change does not host FastAPI on the internet. The Vercel website and a physical Android device still require a reachable hosted FastAPI service using the same Atlas configuration. Keep the Atlas URI, JWT secret and database password exclusively on the backend host.

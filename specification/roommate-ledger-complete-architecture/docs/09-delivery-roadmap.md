# 09 — Delivery Roadmap

Implement in vertical slices. Each phase ends with tests, documentation, and a truthful completion report.

## Phase 0 — Repository and environment
- Inspect existing files; preserve useful starter code.
- Create monorepo structure and conventions.
- Add `.env.example`, secret-safe configuration, lint/format/test commands.
- Document Windows PowerShell setup.
Exit: clean install instructions and health endpoint.

## Phase 1 — Backend foundation
- FastAPI app, config, logging, Mongo client lifecycle, readiness/liveness.
- Database index creation and startup validation.
- Error handling, request IDs, pytest setup.
Exit: health tests pass; readiness fails clearly without DB and succeeds with valid Atlas URI.

## Phase 2 — Authentication and RBAC
- Bootstrap Super Admin from environment.
- Argon2id, login, refresh rotation, logout, forced password change.
- Roles and authorization dependencies.
Exit: auth and permission tests pass.

## Phase 3 — Rooms and membership
- Room CRUD, invitation lifecycle, member roles/status.
Exit: admin/member workflow works end-to-end.

## Phase 4 — Shared expenses
- Categories, create/list/detail/reversal, split algorithms, idempotency.
Exit: exact financial invariants covered by tests.

## Phase 5 — Balances and settlements
- Balance aggregation, suggestions, settlement state machine.
Exit: ledger example in testing document passes.

## Phase 6 — Personal expenses
- Owner-private CRUD and reports.
Exit: cross-user privacy tests pass.

## Phase 7 — Web application
- Login, app shell, room dashboard, expenses, balances, personal expenses, reports, announcements.
Exit: production build succeeds and API integration smoke tests pass.

## Phase 8 — Android application
- Expo Router, auth storage, API client, core screens and forms.
Exit: Android build installs and core flows work on device.

## Phase 9 — Reports and announcements
- Monthly/annual aggregation, CSV export, announcement management.
Exit: report totals reconcile to ledger.

## Phase 10 — Hardening
- Rate limits, security review, audit coverage, performance, backup/restore.
Exit: security checklist and regression suite pass.

## Phase 11 — Release
- Production environment, web deployment, backend deployment, EAS APK/AAB.
- Verify URLs, CORS, secrets, database access and release notes.
Exit: release checklist signed off.

## Codex execution rules
- Work one phase at a time unless asked otherwise.
- First inspect repository and report current state.
- Never replace working code without explaining why.
- Do not claim tests/builds/database checks passed unless run and output verified.
- After each phase: list changed files, commands run, test results, blockers, next phase.
- Ask before destructive database changes, migrations, or secret rotation.

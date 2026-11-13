# Codex Master Implementation Prompt — RoomMate Ledger

You are the senior full-stack engineer implementing RoomMate Ledger. Treat the architecture documents in `docs/` as the source of truth. This is a build-from-scratch implementation; the existing Phase 1 starter ZIP may not have been run. Inspect the repository before changing anything.

## Product and stack
Build a polished shared-expense product for 5–10 room members with:
- FastAPI + Python 3.12+ + Pydantic v2 + async PyMongo
- MongoDB Atlas
- Next.js App Router + TypeScript + Tailwind
- Expo React Native + Expo Router + TypeScript
- Android application ID `com.roommate.ledger`
- INR only; all money integer paise
- Brand colours: navy `#172554`, teal `#14B8A6`, background `#F8FAFC`, amber `#F59E0B`

## Non-negotiable architecture
1. Clients call FastAPI only. Never connect clients directly to MongoDB.
2. Separate routers, schemas, services, repositories, and persistence models.
3. Enforce authorization on the server for every operation.
4. Use Argon2id password hashing; short-lived access JWTs; rotating refresh tokens; hash refresh tokens at rest.
5. Bootstrap Super Admin only from environment variables or an explicit secure command. Never hardcode or print credentials. Force temporary password change at first login.
6. Personal expenses are private to their owner and never included in room balances or room reports.
7. Shared expenses are immutable after posting; corrections use reversal with reason and audit record.
8. All financial writes are idempotent and transaction-safe. Verify Atlas transaction support. Never leave expense without splits.
9. Never use floating-point money.
10. Add automated tests for business rules, permissions, and privacy.

## Required modules
Authentication, users, rooms, room memberships, invitations, categories, shared expenses, expense splits, personal expenses, balances, settlements, reports, announcements, audit logs, health/readiness.

## Required features
- Super Admin, Room Admin, Room Member roles.
- Room create/update/archive; invitations with expiry and one-time acceptance.
- Equal, exact, and percentage split.
- Balance calculation and settlement suggestions.
- Settlement pending/completed/rejected/cancelled workflow.
- Personal expense CRUD and private reporting.
- Monthly and annual room reports; personal reports; CSV export.
- Announcements.
- Web and Android clients with consistent design tokens.
- APK build instructions and EAS configuration.

## Financial invariants
- Store money as integer paise.
- Equal split: integer division; distribute remainder deterministically by sorted user ID.
- Exact split: sum must equal total exactly.
- Percentage: basis points total 10000; largest-remainder allocation.
- `net = shared paid - assigned shares + completed settlements paid - completed settlements received`.
- Positive net means creditor; negative means debtor.
- Pending settlements do not affect balances.
- Reversed expenses do not affect balances.
- Personal expenses never affect room balance.

## Required repository layout
Use the layout in `docs/02-system-architecture.md`. Include `.env.example` with placeholders only, `.gitignore`, README, Windows PowerShell setup guide, tests, and API documentation.

## Execution plan
Implement phases in `docs/09-delivery-roadmap.md`. Start by:
1. Inspecting all repository files and current git state.
2. Reporting what exists and what is missing.
3. Proposing exact Phase 0/1 file changes.
4. Implementing Phase 0/1 only.
5. Running formatting, type checks, tests, and health checks that are possible.
6. Reporting exact command outputs and blockers.

Do not proceed to later phases until the user asks or explicitly approves. If a dependency, credential, Atlas configuration, or external service is missing, implement the safe interface and clearly report the blocker; do not fabricate success.

## Quality bar
- Production-minded modular code, type hints, validation, clear errors.
- No placeholder buttons or fake success states.
- No TODO for core financial logic.
- Responsive accessible web UI; native-feeling Android UI.
- Loading, empty, error, retry, and offline states.
- Pagination and date filters for lists.
- Tests for every money algorithm and authorization boundary.
- Keep README and architecture docs synchronized with implementation.
- At the end of each phase report: summary, changed files, commands run, tests/builds with pass/fail, manual verification, unresolved risks, next recommended phase.

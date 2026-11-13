# RoomMate Ledger — Complete Project Architecture Pack

This is an implementation blueprint, not a runnable application. It defines the product, architecture, data model, API contract, security rules, UI structure, delivery phases, testing strategy, and a Codex master prompt.

## Product
RoomMate Ledger manages shared household/room expenses and private personal expenses for small shared rooms (initially 5–10 members). It provides expense splitting, balances, settlements, monthly reports, announcements, and role-based administration.

## Technology decisions
- Backend: Python 3.12+, FastAPI, Pydantic v2, async PyMongo
- Database: MongoDB Atlas M0 for development; validate transaction support before relying on multi-document transactions
- Web: Next.js App Router, TypeScript, Tailwind CSS
- Android: Expo React Native, Expo Router, TypeScript
- Authentication: short-lived JWT access tokens + rotating refresh tokens; Argon2id password hashing
- API: versioned REST `/api/v1`
- Currency: INR, stored as integer paise; never store monetary values as floating point
- Package ID: `com.roommate.ledger`

## Important
The earlier Phase 1 ZIP is only a starter scaffold and is not assumed to have been run. This pack gives the complete target architecture. Implement it in vertical slices and verify each phase before moving on. Do not claim Atlas connectivity, tests, or builds succeeded unless actually verified.

## Documents
1. `docs/01-product-requirements.md` — scope, roles, workflows, requirements
2. `docs/02-system-architecture.md` — components, deployment, boundaries
3. `docs/03-data-model.md` — MongoDB collections and indexes
4. `docs/04-api-contract.md` — endpoints and payload conventions
5. `docs/05-business-rules.md` — splitting, balances, settlements, privacy
6. `docs/06-security-and-operations.md` — auth, secrets, audit, backups
7. `docs/07-ui-architecture.md` — web/mobile navigation and design system
8. `docs/08-testing-and-acceptance.md` — test plan and acceptance criteria
9. `docs/09-delivery-roadmap.md` — phased implementation sequence
10. `prompts/CODEX-MASTER-PROMPT.md` — complete implementation prompt

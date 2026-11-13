# 01 — Product Requirements

## 1. Purpose
A shared expense ledger for a bachelor room/flat. Members record expenses, see who paid and who owes, settle balances, track their own personal spending privately, and receive room announcements.

## 2. Initial assumptions
- One account may belong to multiple rooms in future; design IDs and membership records to allow this.
- Initial room size: 5–10 active members.
- Currency: INR only in release 1.
- One room has one configured timezone (default `Asia/Kolkata`).
- Expenses are immutable financial events after posting; corrections use reversal/adjustment records, not silent edits.
- Personal expenses are visible only to their owner and authorized Super Admin support workflow (default: not visible to room admins or other members).
- A user can be a member of a room and can be an admin in another room.

## 3. Roles and permissions
### Super Admin
- Platform-level account and room support.
- Create/disable rooms and manage platform settings.
- View audit metadata.
- No routine access to private personal expense descriptions/amounts. Any exceptional support access must be explicit, time-limited, reason-recorded, and audited.

### Room Admin
- Manage room profile, members, invitations, categories, and announcements.
- View room-shared expenses, balances, settlements, and reports.
- Cannot view another member's personal expenses.
- Cannot promote a member to Super Admin.

### Room Member
- View room-shared ledger, balances, announcements, and reports.
- Create shared expenses and settlements.
- View and manage their own personal expenses.
- Cannot manage room roles or other users' private expenses.

## 4. Core modules
1. Authentication and account profile
2. Room creation, joining, invitations, membership lifecycle
3. Shared expense entry and splitting
4. Personal expense tracking
5. Member balances and settlement workflow
6. Monthly/annual reports and exports
7. Room announcements
8. Categories and preferences
9. Audit trail and administration

## 5. Key user journeys
### First-time setup
1. Super Admin account is bootstrapped from private environment configuration.
2. Super Admin signs in and must change the temporary password.
3. Admin creates a room and invites members.
4. Members accept invitation and join.
5. Room admin configures categories and room settings.

### Record shared expense
1. Member selects room, date, category, description, total amount, payer.
2. Member selects participants and split method: equal, exact amounts, or percentages.
3. Client previews each share.
4. API validates totals and membership, then records expense and splits atomically where supported.
5. Ledger and balances update from posted records.

### Record personal expense
1. User enters amount, date, category, note.
2. Record is private to the owner.
3. It is included in the owner's personal reports, never in room balances.

### Settle up
1. Members view net balances and suggested transfers.
2. Debtor records a payment to creditor (or authorized counterpart records confirmation).
3. Settlement status moves pending → completed, or pending → rejected/cancelled.
4. Only completed settlements affect balances.

## 6. Functional requirements
- Email or username login; username is required for bootstrap admin.
- Access/refresh token authentication, logout, refresh-token rotation.
- Room invitations with expiry and one-time acceptance.
- Shared expenses support equal, exact, and percentage splits.
- Support payer distinct from creator.
- Multiple payers may be considered in later release; release 1 supports one payer per expense.
- Personal expense CRUD for owner only.
- Settlement suggestions minimize number of transfers for small rooms.
- Monthly and annual room reports; personal reports.
- CSV export in release 1; PDF/XLSX can follow after core ledger is stable.
- Announcements with created/updated/archived state.
- Search, pagination, date filters, category filters.
- Audit log for security-sensitive and financial actions.

## 7. Non-functional requirements
- All monetary arithmetic in integer paise.
- API validation and authorization on server; never trust UI role checks.
- Use UTC timestamps in storage; render in room timezone.
- Idempotency for financial create/confirm endpoints.
- Pagination for lists.
- Structured logs with request IDs; never log passwords, tokens, or full secrets.
- Accessible contrast, keyboard support on web, sensible Android touch targets.
- Responsive web layout and Android-native navigation.

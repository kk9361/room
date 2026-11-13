# 08 — Testing and Acceptance

## Backend automated tests
- Password hashing and verification; no plaintext persistence.
- Login, refresh rotation, refresh reuse detection, logout.
- Role matrix for Super Admin, Room Admin, Room Member.
- Invitation expiry and one-time acceptance.
- Equal split remainder distribution deterministic.
- Exact split rejects totals that do not match.
- Percentage split sums to 10000 basis points and distributes paise correctly.
- Balance formula for payer, participant, non-participant.
- Personal expense isolation across users and roles.
- Settlement pending does not change balance; completed does.
- Reversed expense excluded from balances.
- Idempotency prevents duplicate expenses/settlements.
- Final room admin cannot be removed/demoted.
- Date boundary handling for Asia/Kolkata.

## Web tests
- Login and protected routes.
- Role-based navigation.
- Expense split preview matches backend.
- Error, loading, empty states.
- Personal expenses never appear in room ledger/report.
- Responsive layouts at mobile/tablet/desktop sizes.

## Android tests
- Login and token persistence in SecureStore.
- Token refresh and logout.
- Add shared and personal expenses.
- Split preview and validation.
- Offline/network failure messaging.
- APK build and install on a physical Android device.

## Acceptance criteria
A release candidate is acceptable only when:
1. A clean clone can be set up from README without undocumented steps.
2. Backend tests pass against isolated test database.
3. Atlas readiness endpoint succeeds using configured credentials.
4. A Super Admin can log in and is forced to change temporary password.
5. Room Admin can create room and invite members.
6. Members can create shared expense and see accurate split/balance.
7. Personal expenses are private and excluded from room totals.
8. Settlement completion updates balances correctly.
9. Monthly report matches underlying ledger calculations.
10. Web build succeeds.
11. Android preview/release APK builds and installs.
12. No secrets are committed or bundled into client apps.

## Manual financial test example
Room has A, B, C.
A pays ₹900 shared equally among A/B/C.
Shares are ₹300 each.
Initial net: A +₹600, B -₹300, C -₹300.
B pays A ₹300 and C pays A ₹300; after both settlements complete, all net balances are zero.

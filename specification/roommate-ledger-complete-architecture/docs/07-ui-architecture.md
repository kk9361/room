# 07 — UI Architecture and Design System

## Brand tokens
- Primary navy: `#172554`
- Accent teal: `#14B8A6`
- Background: `#F8FAFC`
- Highlight amber: `#F59E0B`
- Text: slate/near-black; muted text: slate gray
- Use consistent semantic success/warning/error colours with accessible contrast.

## Shared UX principles
- Show current room clearly and make room switching easy.
- Distinguish Shared Expenses from My Personal Expenses in navigation and visual labels.
- Always show currency as ₹ and format using Indian number grouping.
- Show split preview before saving.
- Confirm reversal and settlement completion.
- Provide loading, empty, error, offline, and retry states.
- Never imply an expense is saved until API confirms success.

## Web navigation
Unauthenticated:
- Login
- Forgot/reset password

Authenticated shell:
- Dashboard
- Rooms
- Shared Expenses
- Balances & Settle Up
- Personal Expenses
- Reports
- Announcements
- Settings
- Admin (role-gated)

Suggested pages:
- `/dashboard`
- `/rooms`
- `/rooms/[roomId]`
- `/rooms/[roomId]/expenses`
- `/rooms/[roomId]/expenses/new`
- `/rooms/[roomId]/balances`
- `/rooms/[roomId]/settlements`
- `/rooms/[roomId]/reports`
- `/rooms/[roomId]/announcements`
- `/personal/expenses`
- `/personal/reports`
- `/admin`

## Android navigation
Use Expo Router with authenticated route group and bottom tabs:
- Home
- Expenses
- Settle
- Reports
- Profile
Room context switcher appears in header. Personal expenses are accessible under Profile/Personal or a clearly separated Expenses sub-tab.

## Dashboard content
- Current month shared spend
- My paid amount
- My share
- My net balance
- Recent shared expenses
- Pending settlement items
- Latest announcements
- Quick actions: Add shared expense, Add personal expense, Settle up

## Expense form
Fields:
- Description, amount, date, category, payer
- Participants
- Split type selector: Equal / Exact / Percentage
- Live split preview with paise rounding
- Idempotency key generated per submission attempt
- Submit disabled until valid

## Accessibility
- Keyboard navigation and focus indicators on web.
- Labels for all form controls.
- Minimum comfortable touch targets on Android.
- Do not use colour alone to communicate debtor/creditor status; include text/icon.

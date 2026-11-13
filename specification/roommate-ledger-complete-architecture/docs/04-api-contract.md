# 04 — API Contract

Base path `/api/v1`. JSON request/response. Authenticated routes use `Authorization: Bearer <access_token>`. Standard errors:
```json
{"error":{"code":"VALIDATION_ERROR","message":"Readable message","details":[],"request_id":"..."}}
```
List responses:
```json
{"items":[],"page":1,"page_size":20,"total":0}
```

## Auth
- `POST /auth/login` — username/email + password; returns access token, refresh token cookie or secure response strategy, user summary.
- `POST /auth/refresh` — rotate refresh token; detect reuse and revoke token family.
- `POST /auth/logout` — revoke current refresh token.
- `POST /auth/change-password` — current + new password.
- `POST /auth/forgot-password` and `POST /auth/reset-password` — only when email delivery is configured; otherwise disable rather than expose account state.
- `GET /auth/me` — current user and memberships.

## Users and rooms
- `GET /users/me`, `PATCH /users/me`
- `POST /rooms`, `GET /rooms`, `GET /rooms/{room_id}`, `PATCH /rooms/{room_id}`
- `GET /rooms/{room_id}/members`
- `POST /rooms/{room_id}/invitations`
- `POST /invitations/accept`
- `PATCH /rooms/{room_id}/members/{user_id}` — role/status; admin only, guarded against removing final admin.

## Categories
- `GET /rooms/{room_id}/categories`
- `POST /rooms/{room_id}/categories`
- `PATCH /rooms/{room_id}/categories/{category_id}`
- `GET /personal/categories`
- `POST /personal/categories`

## Shared expenses
- `POST /rooms/{room_id}/expenses`
- `GET /rooms/{room_id}/expenses?from=&to=&category_id=&page=&page_size=`
- `GET /rooms/{room_id}/expenses/{expense_id}`
- `POST /rooms/{room_id}/expenses/{expense_id}/reverse`
- `GET /rooms/{room_id}/balances`
- `GET /rooms/{room_id}/balances/me`

Example create request:
```json
{
  "expense_date":"2026-11-09",
  "description":"Groceries",
  "category_id":"...",
  "paid_by":"user_id",
  "total_paise":125000,
  "split_type":"equal",
  "participants":["user_a","user_b","user_c"]
}
```
Exact split adds `shares:[{"user_id":"...","share_paise":...}]`; percentage split adds integer basis points summing to 10000.

## Personal expenses
- `POST /personal/expenses`
- `GET /personal/expenses?from=&to=&category_id=`
- `GET /personal/expenses/{expense_id}`
- `PATCH /personal/expenses/{expense_id}`
- `DELETE /personal/expenses/{expense_id}` — owner only; soft-delete recommended.

## Settlements
- `GET /rooms/{room_id}/settlements/suggestions`
- `POST /rooms/{room_id}/settlements`
- `POST /rooms/{room_id}/settlements/{settlement_id}/confirm`
- `POST /rooms/{room_id}/settlements/{settlement_id}/reject`
- `GET /rooms/{room_id}/settlements`

## Reports and announcements
- `GET /rooms/{room_id}/reports/monthly?year=&month=`
- `GET /rooms/{room_id}/reports/annual?year=`
- `GET /personal/reports/monthly?year=&month=`
- `GET /rooms/{room_id}/reports/export?from=&to=&format=csv`
- `GET /rooms/{room_id}/announcements`
- `POST /rooms/{room_id}/announcements`
- `PATCH /rooms/{room_id}/announcements/{announcement_id}`

## Platform admin and health
- `GET /admin/rooms`, `GET /admin/users`, `PATCH /admin/users/{user_id}/status`
- `GET /admin/audit-logs`
- `GET /health`, `GET /health/ready`

## API conventions
- Validate ownership and room membership on every resource access.
- Return 404 for resources outside caller's access scope where appropriate to avoid ID enumeration.
- Use `Idempotency-Key` header on expense and settlement creation.
- Use ISO 8601 dates; server stores timestamps in UTC.
- Enforce max page size (e.g. 100).

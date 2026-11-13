# 03 — MongoDB Data Model

Use MongoDB ObjectId (or UUID consistently) for identifiers. Store `created_at` and `updated_at` as UTC datetimes. Monetary values are integer paise.

## Collections

### users
```json
{
  "_id": "ObjectId",
  "username": "unique lowercase",
  "email": "optional unique normalized",
  "display_name": "string",
  "password_hash": "Argon2id hash",
  "status": "active|disabled|pending",
  "must_change_password": true,
  "created_at": "UTC datetime",
  "updated_at": "UTC datetime",
  "last_login_at": "UTC datetime"
}
```
Indexes: unique username; unique sparse normalized email; status.

### rooms
```json
{
  "_id": "ObjectId",
  "name": "string",
  "slug": "unique",
  "created_by": "user_id",
  "status": "active|archived",
  "currency": "INR",
  "timezone": "Asia/Kolkata",
  "settings": {"allow_member_expenses": true},
  "created_at": "UTC datetime",
  "updated_at": "UTC datetime"
}
```
Indexes: unique slug; status.

### room_members
```json
{
  "_id": "ObjectId",
  "room_id": "room_id",
  "user_id": "user_id",
  "role": "room_admin|room_member",
  "status": "invited|active|left|removed",
  "joined_at": "UTC datetime|null",
  "created_at": "UTC datetime"
}
```
Indexes: unique `(room_id,user_id)`; `(user_id,status)`; `(room_id,status)`.

### invitations
Fields: room_id, invited_by, email_or_username, token_hash, expires_at, accepted_at, status, created_at.
Indexes: unique token_hash; `(room_id,status,expires_at)`.

### categories
Fields: scope (`room|personal`), room_id nullable, owner_user_id nullable, name, icon, is_active, created_at.
Indexes: `(scope,room_id,name)` and `(scope,owner_user_id,name)` as appropriate.

### expenses (shared only)
Fields:
- room_id, created_by, paid_by, expense_date
- description, category_id, total_paise
- split_type (`equal|exact|percentage`)
- participant_user_ids
- status (`posted|reversed`)
- idempotency_key
- created_at, updated_at, reversed_at, reversal_reason

Indexes: `(room_id,expense_date desc)`, `(room_id,category_id,expense_date)`, `(created_by,created_at)`, unique `(room_id,idempotency_key)` where present.

### expense_splits
One record per participant:
- expense_id, room_id, user_id, share_paise
- created_at
Indexes: unique `(expense_id,user_id)`; `(room_id,user_id,expense_id)`.

### personal_expenses
Fields: owner_user_id, expense_date, description, category_id, amount_paise, notes, created_at, updated_at.
Indexes: `(owner_user_id,expense_date desc)`, `(owner_user_id,category_id,expense_date)`.

### settlements
Fields: room_id, from_user_id, to_user_id, amount_paise, status (`pending|completed|rejected|cancelled`), payment_method, note, created_by, idempotency_key, completed_at, created_at, updated_at.
Indexes: `(room_id,status,created_at)`, `(room_id,from_user_id)`, `(room_id,to_user_id)`, unique `(room_id,idempotency_key)` where present.

### announcements
Fields: room_id, title, body, created_by, status (`published|archived`), published_at, created_at, updated_at.
Indexes: `(room_id,status,published_at desc)`.

### refresh_tokens
Fields: user_id, token_hash, family_id, expires_at, revoked_at, replaced_by, created_at, device_label.
Indexes: unique token_hash; `(user_id,expires_at)`; `(family_id)`.

### audit_logs
Fields: actor_user_id, action, resource_type, resource_id, room_id nullable, metadata_safe, request_id, created_at.
Indexes: `(room_id,created_at desc)`, `(actor_user_id,created_at desc)`, `(resource_type,resource_id)`.

## Data integrity
- Validate all referenced users are active room members at expense creation.
- Expense total must equal sum of split shares exactly.
- Unique idempotency key per room prevents duplicate submissions.
- Use soft archive for rooms/categories/announcements; never delete posted financial history.
- Reversal creates an auditable compensating event or marks original reversed with immutable reversal metadata.
- Do not embed unbounded expense history arrays inside room documents.

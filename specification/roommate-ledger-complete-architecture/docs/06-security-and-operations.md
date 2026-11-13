# 06 — Security and Operations

## Authentication
- Hash passwords with Argon2id using a maintained library and secure parameters.
- Never store plaintext passwords or reversible password encryption.
- Access JWT short lifetime (e.g. 10–15 minutes); refresh tokens longer but rotated on every use.
- Store only refresh-token hashes in MongoDB.
- Detect refresh token reuse; revoke token family and require login.
- Use Secure, HttpOnly, SameSite cookies for web refresh tokens where deployment permits.
- Android stores refresh credentials in Expo SecureStore, not AsyncStorage.
- Force bootstrap admin to change temporary password at first login.
- Rate-limit login, password reset, invitation acceptance, and sensitive endpoints.

## Bootstrap Super Admin
- Configure initial username and temporary password via deployment secrets/environment variables only.
- On startup or explicit bootstrap command, create account only if no Super Admin exists.
- Hash temporary password with Argon2id.
- Never commit credentials, print them, or include them in frontend/mobile config.
- Do not hardcode the previously shared temporary password. Rotate it before real use.

## Authorization
- Implement server-side role checks and resource-level ownership checks.
- Avoid trusting client-provided user IDs for owner-scoped operations.
- Prevent deleting/demoting the last active room admin.
- Super Admin actions require explicit platform permission and audit trail.
- Use deny-by-default access policy.

## MongoDB and secrets
- Atlas URI only in backend environment.
- Restrict Atlas network access to deployment/known developer IPs.
- Use least-privilege database user.
- Never use `0.0.0.0/0` permanently.
- Validate TLS and certificate defaults.
- Separate dev/staging/prod databases.

## Audit and observability
Audit: login failures (without password), password change, room creation, invite, membership/role changes, expense post/reversal, settlement state changes, admin actions.
- Structured logs with request ID, actor ID, route, status, latency.
- Redact authorization headers, cookies, secrets, personal expense content.
- Health liveness must not require DB; readiness checks DB.
- Configure backups and test restore before production.

## Financial reliability
- Use transactions if supported.
- Idempotency key on create operations.
- Validate all writes and reconcile expense totals against splits.
- Do not update balances as a mutable counter in release 1; derive balances from immutable financial records or maintain a rebuildable projection.
- Add consistency tests and periodic reconciliation.

## Deployment checklist
- HTTPS, CORS allowlist, secure cookies, environment secrets.
- No debug mode in production.
- Pin dependencies and scan for known vulnerabilities.
- Error responses must not leak stack traces or secrets.
- Verify Android release build uses production API URL and no development credentials.

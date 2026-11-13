# Implementation notes

The supplied ZIP is a blueprint, not executable application code. Its embedded master prompt is preserved as reference, while the user's full-project request determines the implementation scope.

## Data model choices

Identifiers are consistent 24-character random hexadecimal strings. MongoDB stores UTC datetimes and strict integer paise. Expense dates are local calendar dates, avoiding an incorrect conversion of date-only inputs to midnight UTC.

`expenses.splits` is embedded, with at most 100 participants. An expense and its complete splits therefore commit atomically on every supported MongoDB topology. Expenses and settlements have unique `(room_id,idempotency_key)` indexes plus payload fingerprints. No multi-document transaction support is assumed or claimed; Atlas authentication must succeed before topology checks can complete. A derived balance sums posted expenses and completed settlements without storing mutable balance counters.

Memberships and invitations are embedded in each small, bounded room document. Optimistic version matching prevents concurrent updates from overwriting each other or removing the final administrator. Repeated invitations are pruned when new invitations are issued; pending invitations are bounded. A version conflict returns 409 and asks the caller to refresh and retry. Historical memberships are retained. Room admins manage their own room only; platform support endpoints are separate.

Financial records contain inline audit actor/action/time or immutable reversal/finalization metadata, in addition to the searchable `audit_logs` collection. Personal audit entries record resource identifiers and actions without private purchase content. A failure after a financial commit can be retried using the original idempotency key.

Refresh sessions are single documents. Rotation compares the current hash and updates it atomically while retaining consumed hashes for replay detection. Family expiry is absolute, 30 days; rotation does not extend it indefinitely. Access JWTs are validated against both the live user auth version and active session, so password changes, disablement, logout, and detected refresh replay invalidate existing access.

## User experience

The authenticated web shell persists in the root layout to keep login state, room choice, and forms stable during route navigation. Tokens are not persisted in web localStorage. Core pages have loading, empty, error, and retry states. Modal dialogs trap focus, close with Escape, and restore focus. Small screens use a collapsible sidebar and horizontally scrollable financial tables.

Android has five Expo Router tabs, a room switcher, shared expense entry with all split methods and previews, settlement confirmation, private expense CRUD, reports, native CSV text sharing, profile/password updates, invitations, membership controls, room preferences, categories, and noticeboard management. Platform-wide administration is available on web. Android refresh secrets are held in SecureStore; network failures produce explicit errors and do not fabricate saved data.

The web platform-admin screen offers an explicit full-data reset. The API requires a super-admin session, the current password, and the exact `CLEAR ALL DATA` phrase, then deletes every document from every non-system collection (including users, sessions, and audit history). It retains collection/index definitions. Restarting the API recreates the configured bootstrap administrator; backups outside the database are unaffected. The reset is tested only against disposable QA databases.

## Deliberate release boundaries

Active room members can publish announcements. Publishing snapshots the other active members into a private unread-recipient list on the announcement record; the API never includes that list in public responses. Web sessions poll every ten seconds and show a popup plus an unread bell list; Android sessions poll while active and show a native alert and Home-tab badge. Opening or marking an item read removes only that member from its unread list. These are in-app notifications, not email or operating-system push messages.

No emails, hosted URLs, cloud deployments, payments, APK store publication, or external messages are sent by this implementation. Invitations return a one-time token for the room administrator to share privately. The ledger records payments made outside the app. Email password recovery is disabled with a documented response. Exceptional platform access to personal spending is not provided.

PDF/XLSX exports, receipt attachments, multiple payers, notifications, budgets, and other later-release features are outside the supplied release-one scope. CSV exports are implemented with spreadsheet formula escaping. Platform settings are environment-driven.

## Sources checked

- PyMongo Async API and migration: https://www.mongodb.com/docs/languages/python/pymongo-driver/current/reference/migration/
- MongoDB client configuration: https://www.mongodb.com/docs/languages/python/pymongo-driver/current/connect/
- Next.js installation: https://nextjs.org/docs/pages/getting-started/installation
- Expo Router: https://docs.expo.dev/versions/latest/sdk/router/
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- Exact Expo/React Native versions were checked against the installed Expo SDK's `bundledNativeModules.json`.

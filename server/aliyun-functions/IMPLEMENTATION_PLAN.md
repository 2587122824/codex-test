# Function Compute Implementation Plan

This plan turns the current mock API and contract into the first real Codex
Sleep beta backend on Alibaba Cloud Function Compute and RDS PostgreSQL.

## Runtime Choices

- Runtime: Node.js 20 Function Compute HTTP handler.
- Database: PostgreSQL through `pg`.
- Tokens: opaque random tokens stored server-side as SHA-256 hashes.
- SMS: Alibaba Cloud SMS SDK, with a fixed local/mock code only outside
  production.
- Validation: small hand-written validators first; add a schema library later
  only if the request surface grows.

## Environment

Required variables:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `ALIYUN_ACCESS_KEY_ID`
- `ALIYUN_ACCESS_KEY_SECRET`
- `ALIYUN_SMS_SIGN_NAME`
- `ALIYUN_SMS_TEMPLATE_CODE`
- `SESSION_SECRET`

Optional beta variables:

- `SMS_CODE_TTL_SECONDS`, default `300`
- `SESSION_TTL_SECONDS`, default `604800`
- `SMS_SEND_COOLDOWN_SECONDS`, default `60`
- `SMS_SEND_HOURLY_LIMIT`, default `5`

## Route Order

`handler.js` now implements these routes with an injectable adapter and local
in-memory storage. `postgres-adapter.js` and `aliyun-sms-adapter.js` provide the
first production adapter scaffolds; deployment still needs bundling with `pg`
and the official Alibaba SMS SDK packages.

1. `POST /auth/send-code`
   - Validate and normalize phone.
   - Enforce cooldown and hourly limits using `auth_sms_codes`.
   - Generate a 6-digit code, store a hash, and send SMS.
   - Return `{ "requestId": "..." }`.

2. `POST /auth/verify-code`
   - Validate phone and code.
   - Find the newest unconsumed, unexpired code hash.
   - Mark it consumed, upsert `profiles`, create `auth_sessions`.
   - Return the session shape from `api-contract.md`.

3. `GET /auth/session`
   - Read bearer token.
   - Hash token and find a non-revoked, non-expired session.
   - Return the session user and current access token.

4. `POST /auth/logout`
   - Hash bearer token and set `revoked_at`.
   - Return `204 No Content`.

5. `POST /sync/merge`
   - Authenticate session.
   - Merge favorites, history, sleep logs, settings in one transaction.
   - Treat track IDs and sleep log IDs as opaque strings.
   - Return canonical `RemoteSyncData`.

## Merge Storage Mapping

- `user_favorites`: upsert active rows for local favorites, then tombstone rows
  listed in `deletedFavorites`.
- `play_history`: upsert by track ID, increment `play_count`, keep
  `last_played_at` newest-first in responses, cap response to 12 IDs.
- `sleep_logs`: upsert by `(user_id, opaque client ID)` when local data is
  newer; tombstones win when `deletedAt >= updated_at`.
- `user_settings`: upsert `default_sleep_timer_minutes` and `theme_mode` when
  `clientSyncedAt >= updated_at`.

## First Manual Smoke Test

1. Run `rds-schema.sql` on a clean RDS database.
2. Deploy the handler with SMS in a beta template.
3. Set `EXPO_PUBLIC_API_BASE_URL` to the Function Compute domain.
4. Send a code, verify login, favorite one track, switch theme, sync.
5. Reinstall or clear app storage, log in again, and confirm favorites, recent
   plays, and theme return from the cloud snapshot.

## Security Notes

- Never store raw SMS codes or raw access/refresh tokens.
- Return the same generic error for invalid and expired codes in production.
- Keep SMS cooldowns server-side; frontend throttling is only cosmetic.
- Log request IDs and user IDs, but do not log phone codes or tokens.

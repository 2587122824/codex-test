# Alibaba Cloud Function API Contract

The Expo app talks only to `EXPO_PUBLIC_API_BASE_URL`. The first deploy target is
Alibaba Cloud Function Compute with HTTP triggers. Put API Gateway in front later
if rate limiting, custom domains, or WAF rules are needed.

## Authentication

Authenticated routes use `Authorization: Bearer <accessToken>`. The app treats
tokens as opaque strings. Token signing, refresh, and revocation stay on the
server side.

## Routes

### POST /auth/send-code

Sends an SMS code through Alibaba Cloud SMS.

Request:

```json
{ "phone": "+8613800000000" }
```

Response:

```json
{ "requestId": "aliyun-sms-request-id" }
```

Recommended beta limits:

- Normalize phone numbers before storing or sending SMS.
- Allow at most 1 code per phone per minute and 5 codes per phone per hour.
- Store only a hash of the code and expire codes after 5 minutes.

### POST /auth/verify-code

Verifies the SMS code, creates the profile if needed, and returns an app session.

Request:

```json
{ "phone": "+8613800000000", "code": "123456" }
```

Response:

```json
{
  "session": {
    "user": { "id": "uuid", "phone": "+8613800000000" },
    "accessToken": "opaque-or-jwt-access-token",
    "refreshToken": "opaque-refresh-token",
    "expiresAt": "2026-06-02T12:00:00.000Z"
  }
}
```

### GET /auth/session

Returns the current session for a valid access token.

Response:

```json
{
  "session": {
    "user": { "id": "uuid", "phone": "+8613800000000" },
    "accessToken": "current-access-token",
    "expiresAt": "2026-06-02T12:00:00.000Z"
  }
}
```

### POST /auth/logout

Revokes the current server session. Return `204 No Content` or `{ "ok": true }`.

### POST /sync/merge

Merges local guest data into the signed-in account and returns the canonical
cloud snapshot. Treat all track IDs and sleep log IDs as opaque client strings.

Request:

```json
{
  "local": {
    "favoriteIds": ["rain-window"],
    "historyIds": ["rain-window"],
    "sleepLogs": [],
    "settings": { "defaultSleepTimerMinutes": 0, "themeMode": "system" }
  },
  "deletedFavorites": [{ "id": "ocean-waves", "deletedAt": "2026-06-02T08:00:00.000Z" }],
  "deletedSleepLogs": [],
  "clientSyncedAt": "2026-06-02T08:05:00.000Z"
}
```

Response:

```json
{
  "data": {
    "favoriteIds": ["rain-window"],
    "historyIds": ["rain-window"],
    "sleepLogs": [],
    "settings": { "defaultSleepTimerMinutes": 0, "themeMode": "system" },
    "syncedAt": "2026-06-02T08:05:01.000Z"
  }
}
```

## Merge Rules

- Favorites: union active local and remote IDs, then apply tombstones.
- History: latest-first unique IDs, keep the newest 12 entries.
- Sleep logs: client-generated IDs, newest `updated_at` wins, tombstones win
  over older active rows.
- Settings: after first sign-in, use newest `updated_at`.

## Error Shape

Return JSON for non-204 errors:

```json
{ "message": "Human-readable error message.", "code": "OPTIONAL_MACHINE_CODE" }
```

The Expo client currently reads `message` and shows it in the account/sync UI.

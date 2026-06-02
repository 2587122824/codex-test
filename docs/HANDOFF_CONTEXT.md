# Codex Sleep Handoff Context

Last updated: 2026-06-02

Use this document to continue development from another Codex account or machine.

## Repository State

- Repository: `2587122824/codex-test`
- Local workspace used for this handoff: `I:\AI_Workspace\codex-test`
- Active branch: `codex/playback-modes`
- Open draft PR: <https://github.com/2587122824/codex-test/pull/1>
- Latest pushed commit at handoff: `5261003 Migrate account sync to Aliyun backend`
- Current target: internal beta readiness, not public store release yet.

## Product Direction

Codex Sleep is an Expo React Native sleep audio app. The current product goal is
to reach a small internal beta:

- Stable sleep audio playback.
- A calmer, dark, sleep-first audio player UI.
- Local-first data that keeps working without login.
- Account login and cloud sync prepared for a China-friendly backend.
- Clear beta feedback, privacy, and asset-source documentation.

Do not prioritize large new features yet. Stability, Android testing, content
quality, and sync reliability are more important.

## Current Tech Stack

- Expo / React Native / TypeScript.
- `expo-audio` for playback.
- `@react-native-async-storage/async-storage` for local app data.
- `expo-secure-store` for mobile auth token storage.
- `lucide-react-native` for icons.
- Alibaba Cloud backend target:
  - Function Compute for HTTP API.
  - Alibaba Cloud SMS for phone OTP.
  - Alibaba Cloud RDS PostgreSQL for account and sync data.
  - OSS is reserved for future remote audio or image hosting.

Important user preference: if adding any new technology stack, ask first and
state the corresponding company/vendor. For example:

- Alibaba Cloud SMS SDK: Alibaba Cloud.
- PostgreSQL driver `pg`: node-postgres open-source project.
- Token/JWT library `jose` or `jsonwebtoken`: open-source ecosystem.
- Validation library `zod`: open-source ecosystem.

## Completed Work

### Playback

The sleep timer issue has been fixed conceptually and in code. Tracks now
continue according to playback mode after natural audio end, so a 10-minute or
30-minute timer is not interrupted just because a short track finishes.

Implemented playback modes:

- `repeat-one`
- `sequential`
- `repeat-all`
- `shuffle`

Key file:

- `src/features/player/useAudioPlayer.ts`

The player has queue state, current index, next/previous controls, sleep timer
preservation, loading failure state, and local favorite/history handling.

### UI

The app has been moved toward a dark, audio-product style:

- Immersive player panel.
- Simplified now-playing hierarchy.
- Mini player outside the full player page.
- Icon-based navigation and controls.
- Compact content rows.

Main UI file:

- `src/application/SleepApp.tsx`

Shared UI files:

- `src/shared/ui/theme.ts`
- `src/shared/ui/TrackRow.tsx`
- `src/shared/ui/ModuleCard.tsx`
- `src/shared/ui/PillButton.tsx`

### Content And Beta Docs

Audio catalog has 13 local beta tracks:

- 5 music
- 3 story
- 5 noise

Relevant files:

- `src/shared/content/audioCatalog.ts`
- `docs/AUDIO_ASSET_SOURCES.md`
- `docs/INTERNAL_BETA_CHECKLIST.md`
- `docs/PRIVACY_POLICY_DRAFT.md`
- `docs/PLAY_STORE_CHECKLIST.md`

Some audio is still beta/placeholder material. Before public release, replace
or verify all assets and attribution.

### Alibaba Cloud Account Sync Migration

The previous Supabase foundation was removed. The app now uses a backend API
boundary instead of importing a backend SDK directly.

Removed:

- `@supabase/supabase-js`
- `react-native-url-polyfill`
- `src/shared/supabase/client.ts`
- `supabase/schema.sql`
- `docs/SUPABASE_SETUP.md`

Added:

- `src/shared/api/client.ts`
- `server/aliyun-functions/README.md`
- `server/aliyun-functions/api-contract.md`
- `server/aliyun-functions/rds-schema.sql`
- `scripts/validate-aliyun-backend.js`

Runtime app config now uses:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-function-domain.example.com
```

The app calls these backend routes:

- `POST /auth/send-code`
- `POST /auth/verify-code`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /sync/merge`

The frontend treats access and refresh tokens as opaque strings. Token signing,
refresh, hashing, and revocation should be implemented server-side.

## Important Files

- App entry: `App.tsx`
- Main app shell/UI: `src/application/SleepApp.tsx`
- Audio player hook: `src/features/player/useAudioPlayer.ts`
- Account hook: `src/features/account/useAccountSync.ts`
- Sync service: `src/features/account/syncService.ts`
- API client: `src/shared/api/client.ts`
- Local storage keys: `src/shared/storage/keys.ts`
- Local storage wrapper: `src/shared/storage/storage.ts`
- Audio catalog: `src/shared/content/audioCatalog.ts`
- Alibaba backend contract: `server/aliyun-functions/api-contract.md`
- Alibaba RDS schema: `server/aliyun-functions/rds-schema.sql`

## Validation Commands

Run these after meaningful changes:

```bash
npm.cmd run check
npx.cmd expo install --check
git diff --check
```

`npm.cmd run check` currently runs:

```bash
npm run typecheck
npm run validate:audio
npm run validate:aliyun
```

Recent known-good validation:

- `npm.cmd run check` passed.
- `npx.cmd expo install --check` passed.
- `git diff --check` passed, with only normal Windows CRLF warnings when shown
  by some git commands.

## Local Development

Install and start:

```bash
npm install
npm run start
```

The in-app browser had previously been open at:

```text
http://localhost:8081/
```

Expo may choose another port if that one is busy.

## Android Notes

The user has tested APKs on a phone and also has MuMu emulator available.
There was previous Android crash investigation. The most likely resolved cause
was native asset/icon or package/runtime mismatch during APK builds, but the
current handoff does not include a fresh APK build after the Alibaba migration.

Before the next phone test:

1. Run `npm.cmd run check`.
2. Build a local APK if the environment supports it.
3. Install on MuMu first if available.
4. If it crashes, collect `adb logcat` from MuMu or the phone.

## Next Recommended Work

### 1. Implement Real Alibaba Cloud Functions

The repo currently contains API contracts and database schema, but not the real
Function Compute handler implementation.

Before adding dependencies, ask the user for approval and state vendors. Likely
choices:

- Alibaba Cloud official SMS SDK: Alibaba Cloud.
- `pg`: node-postgres open-source project.
- `jose`: open-source JWT/token library.
- `zod`: open-source validation library.

Core backend tasks:

- Create `POST /auth/send-code`.
- Store hashed SMS codes in `auth_sms_codes`.
- Create `POST /auth/verify-code`.
- Create or fetch `profiles` row.
- Issue access/refresh tokens and store token hashes in `auth_sessions`.
- Implement `GET /auth/session`.
- Implement `POST /auth/logout`.
- Implement `POST /sync/merge` using the merge rules in
  `server/aliyun-functions/api-contract.md`.

### 2. Add End-To-End Sync Tests

Add a lightweight test or script for sync merge rules:

- Favorites union plus tombstones.
- History latest-first and capped at 12.
- Sleep logs by client-generated ID.
- Settings by latest `updated_at`.

### 3. Fresh Android APK Test

Build and test after backend/API client changes:

- App starts without crashing.
- Guest mode still works with empty `EXPO_PUBLIC_API_BASE_URL`.
- Account page shows "not configured" state cleanly.
- Playback still works offline.

### 4. UI Polish Pass

The UI is much better than the MVP, but can still be polished:

- Review mobile spacing on small Android screens.
- Improve Chinese copy that may have encoding problems in older files.
- Ensure buttons never overlap with bottom mini player/navigation.

## Cautions

- Do not reintroduce Supabase unless the user explicitly reverses the Alibaba
  Cloud decision.
- Do not commit `.env`; it is local-only and ignored.
- Avoid adding new backend libraries without asking the user first.
- Keep the app local-first: guest mode must remain fully usable.
- The PR is draft and broad. Keep future commits focused and update the PR body
  when a substantial area changes.


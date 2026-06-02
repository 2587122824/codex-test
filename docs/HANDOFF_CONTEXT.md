# Codex Sleep Handoff Context

Last updated: 2026-06-03

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
npm run validate:sync
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

## 2026-06-03 Command Log

- `Get-Content -LiteralPath docs/HANDOFF_CONTEXT.md` from `I:\AI_Workspace`: failed because `docs/HANDOFF_CONTEXT.md` was not present at workspace root.
- `rg --files -g HANDOFF_CONTEXT.md` from `I:\AI_Workspace`: found `codex-test\docs\HANDOFF_CONTEXT.md`; continuing work from `codex-test`.
- `Get-Content -LiteralPath docs/HANDOFF_CONTEXT.md` from `I:\AI_Workspace\codex-test`: read current handoff; next focus remains internal beta readiness on `codex/playback-modes`.
- `git status -sb`: confirmed active branch `codex/playback-modes`; only `docs/HANDOFF_CONTEXT.md` is modified so far from command-log updates.
- `Get-Content -LiteralPath package.json`: reviewed scripts; current `check` runs typecheck, audio validation, and Aliyun validation, with no sync merge test yet.
- `Get-Content -LiteralPath server/aliyun-functions/api-contract.md`: reviewed `/sync/merge` rules for favorites, history, sleep logs, and settings; will add a dependency-free validation script around these rules.
- `Get-Content -LiteralPath src/features/account/syncService.ts`: reviewed local sync payload shape and deleted-entity tombstone fields used by the frontend.
- `Get-Content -LiteralPath src/shared/types/sleep.ts`: confirmed `SleepLogEntry` client fields and `UserSettings`; merge tests should model server-side `updatedAt` metadata separately.
- `rg --files scripts`: found existing validation scripts `validate-audio-catalog.js` and `validate-aliyun-backend.js`; will follow this lightweight script pattern.
- `Get-Content -LiteralPath scripts/validate-aliyun-backend.js`: reviewed existing validation style; new sync merge validation will use CommonJS, no added dependencies, and explicit pass/fail output.

## 2026-06-03 Development Updates

- Added `scripts/validate-sync-merge-rules.js`, a dependency-free Node assertion script covering `/sync/merge` contract rules for favorites, history, sleep logs, and settings.
- Updated `package.json` with `validate:sync` and included it in `npm run check`.
- Updated `docs/INTERNAL_BETA_CHECKLIST.md` so beta testing covers Account & Sync behavior and describes the app as local-first with Aliyun sync available only when the API endpoint and handlers are configured.
- Added `scripts/mock-aliyun-api.js`, a dependency-free local Mock API for phone OTP login, session recovery, logout, and sync merge testing.
- Updated `package.json` with `mock:api` and updated `docs/INTERNAL_BETA_CHECKLIST.md` with Mock API setup, fixed OTP `123456`, and local-only limitations.

### 2026-06-03 Validation

- `npm.cmd run validate:sync`: passed; favorites, history, sleep logs, and settings merge-rule assertions succeeded.
- `npm.cmd run check`: passed; typecheck, audio catalog validation, Aliyun backend contract validation, and sync merge validation all succeeded.
- `git diff --check`: passed; only normal Windows LF-to-CRLF working-copy warnings were reported for touched files.
- `npx.cmd expo install --check`: first sandboxed run failed with `EPERM` writing `C:\Users\Administrator\.expo\native-modules-cache`; reran with approval and it passed with "Dependencies are up to date".
- `git diff --stat`: tracked changes currently show `docs/HANDOFF_CONTEXT.md` and `package.json`; will check status for untracked new validation script.
- `git status --short`: current changes are `docs/HANDOFF_CONTEXT.md`, `package.json`, and new `scripts/validate-sync-merge-rules.js`.
- `git diff --check`: final whitespace check passed; only normal Windows LF-to-CRLF working-copy warnings were reported.
- `Get-Content -LiteralPath docs/HANDOFF_CONTEXT.md`: read current handoff from `I:\AI_Workspace\codex-test`; continuing internal beta work on `codex/playback-modes`.
- `Select-String -Path C:\Users\Administrator\.codex\memories\MEMORY.md -Pattern 'codex-test|Codex Sleep|HANDOFF_CONTEXT|playback' -Context 2,2`: confirmed prior memory reinforces reading and updating the handoff file command-by-command.
- `git status -sb`: confirmed branch `codex/playback-modes`; working tree has modified `docs/HANDOFF_CONTEXT.md`, modified `package.json`, and untracked `scripts/validate-sync-merge-rules.js`.
- `git diff -- package.json scripts/validate-sync-merge-rules.js`: reviewed tracked diff; `package.json` now adds `validate:sync` and includes it in `check`, while the untracked sync script needs separate inspection.
- `Get-Content -LiteralPath scripts/validate-sync-merge-rules.js`: reviewed the new dependency-free sync merge validation script; it asserts favorites tombstones, history latest-first unique cap, sleep-log newest/tombstone behavior, and latest settings selection.
- `npm.cmd run check`: passed; typecheck, audio catalog validation, Aliyun backend contract validation, and sync merge rule validation all succeeded.
- `Get-Content -LiteralPath docs/INTERNAL_BETA_CHECKLIST.md`: reviewed beta checklist; noticed known limitations still describe the app as local-only even though Aliyun API sync scaffolding now exists.
- `Get-Content -LiteralPath src/features/account/useAccountSync.ts`: reviewed account sync hook and found several user-facing Chinese error/status strings are mojibake.
- `Select-String -Path src/application/SleepApp.tsx -Pattern 'account|sync|登录|同步|not configured|configured|feedback|Privacy|Audio Credits' -Context 2,3`: reviewed account, feedback, privacy, and settings UI references; main app copy is generally normal Chinese and describes Aliyun sync states.
- `$i=1; Get-Content -LiteralPath src/features/account/useAccountSync.ts | ForEach-Object { '{0,4}: {1}' -f $i, $_; $i++ }`: located mojibake account-sync strings around lines 46, 98, 120, 147, and 149 for targeted cleanup.
- `node -e "const fs=require('fs'); const lines=fs.readFileSync('src/features/account/useAccountSync.ts','utf8').split(/\r?\n/); [45,97,119,146,148].forEach(i=>console.log((i+1)+': '+JSON.stringify(lines[i])));"`: verified the source file actually contains correct UTF-8 Chinese strings; mojibake was PowerShell display output, so no code edit is needed there.
- `npm.cmd run check`: passed again after updating the internal beta checklist; typecheck, audio validation, Aliyun validation, and sync merge validation all succeeded.
- `git diff --check`: passed after checklist and handoff updates; only normal Windows LF-to-CRLF working-copy warnings were reported.
- `git status -sb`: before implementing Mock API, branch is `codex/playback-modes`; existing changes include handoff/checklist/package updates and new `scripts/validate-sync-merge-rules.js`.
- `Get-Content -LiteralPath docs/INTERNAL_BETA_CHECKLIST.md`, `server/aliyun-functions/api-contract.md`, and `package.json`: reviewed current beta account-sync notes, API contract routes, and scripts before adding the local Mock API.
- `npm.cmd run mock:api`: started the new local Mock API on `http://localhost:8787`; fixed OTP is `123456` and data is in-memory only.
- `Invoke-RestMethod POST http://localhost:8787/auth/send-code`: passed for `+8613800000000` and returned a `mock-sms-*` request ID.
- `Invoke-RestMethod POST http://localhost:8787/auth/verify-code`: passed with fixed code `123456`; returned a mock user plus access/refresh tokens and `expiresAt`.
- `Invoke-RestMethod GET http://localhost:8787/auth/session`: passed with Bearer access token and returned the current mock session for startup recovery.
- `Invoke-RestMethod POST http://localhost:8787/sync/merge`: passed; returned merged favorites without tombstoned `ocean-waves`, unique capped-style history, one sleep log, settings `{ defaultSleepTimerMinutes: 45 }`, and `syncedAt`.
- `Invoke-WebRequest POST http://localhost:8787/auth/logout` followed by `GET /auth/session`: logout returned `204`, and the old token then returned `401`.
- Stopped the running `npm.cmd run mock:api` session with Ctrl+C and confirmed termination.
- `npm.cmd run check`: passed after adding Mock API; typecheck, audio validation, Aliyun contract validation, and sync merge validation all succeeded.
- `git diff --check`: passed after Mock API implementation; only normal Windows LF-to-CRLF working-copy warnings were reported.
- `git status --short`: final changed files are `docs/HANDOFF_CONTEXT.md`, `docs/INTERNAL_BETA_CHECKLIST.md`, `package.json`, new `scripts/mock-aliyun-api.js`, and new `scripts/validate-sync-merge-rules.js`.
- `git diff --stat`: tracked diff currently shows handoff, internal beta checklist, and `package.json`; new scripts remain untracked until added to Git, so they do not appear in this stat output yet.
- `npm.cmd run mock:api`: restarted the local Mock API on `http://localhost:8787` for CORS preflight verification.
- `Invoke-WebRequest OPTIONS http://localhost:8787/sync/merge`: passed with status `204`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, and expected auth/content headers.
- Stopped the second `npm.cmd run mock:api` session with Ctrl+C and confirmed termination.
- `git diff --check`: final whitespace check passed after CORS verification notes; only normal Windows LF-to-CRLF working-copy warnings were reported.
- `git status -sb`: final branch remains `codex/playback-modes`; modified files are handoff, internal beta checklist, and `package.json`, with new scripts `mock-aliyun-api.js` and `validate-sync-merge-rules.js` untracked.
- `git status -sb`: final status shows modified `docs/HANDOFF_CONTEXT.md`, `docs/INTERNAL_BETA_CHECKLIST.md`, `package.json`, plus untracked `scripts/validate-sync-merge-rules.js`.
- `git diff --stat`: tracked diff summary shows handoff, internal beta checklist, and package script changes; untracked sync validation script is not included in the stat output until staged.
- `git status -sb`: resumed work; branch remains `codex/playback-modes`, with modified handoff/checklist/package files plus untracked `scripts/validate-sync-merge-rules.js` and `scripts/mock-aliyun-api.js`.
- `Get-Content -LiteralPath scripts/mock-aliyun-api.js`: reviewed untracked mock Aliyun API script; it provides in-memory OTP/session/logout/sync routes for local beta testing, but is not yet wired into package scripts and its merge behavior is simpler than the contract validation script.
- `Get-Content -LiteralPath package.json`, `Get-Content -LiteralPath src/shared/api/client.ts`, and `Get-Content -LiteralPath src/features/account/syncService.ts`: confirmed `mock:api` is already present, frontend API calls use opaque bearer tokens, and `/sync/merge` expects `{ data: RemoteSyncData }`.
- `Select-String -Path server/aliyun-functions/api-contract.md -Pattern '/sync/merge|favorites|history|sleep|settings|tombstone|updated' -Context 2,4`: rechecked merge contract; mock API should reflect favorites tombstones, latest-first capped history, sleep-log tombstones, and settings merge behavior as closely as the current frontend snapshot allows.
- `apply_patch` on `scripts/mock-aliyun-api.js`: started aligning the mock API with merge metadata by changing per-user sync storage from plain snapshot data to a store containing `data`, sleep-log update metadata, and settings update metadata.
- `apply_patch` on `scripts/mock-aliyun-api.js`: replaced the mock merge function with store-aware logic for favorite tombstones, latest-first capped history, sleep-log active/tombstone precedence, and settings newest-batch behavior while keeping the frontend response shape as `{ data }`.
- `node --check scripts/mock-aliyun-api.js`: passed; mock Aliyun API script parses successfully after merge-store changes.
- Mock API smoke test command using `Start-Process -Environment`: failed because this PowerShell version does not support the `-Environment` parameter; the mock server did not start and the HTTP request could not connect.
- Mock API smoke test with temporary `$env:MOCK_API_PORT=8791`: passed; `/auth/send-code`, `/auth/verify-code`, and authenticated `/sync/merge` returned the expected JSON shape, with favorite tombstones applied and settings/history/sleep-log data returned under `{ data }`.
- `rg -n "mock:api|mock Aliyun|MOCK_API_PORT|EXPO_PUBLIC_API_BASE_URL|localhost:8787|127.0.0.1:8787" docs server README.md package.json`: found `mock:api` already documented in `docs/INTERNAL_BETA_CHECKLIST.md` and earlier handoff logs; README and Aliyun docs mention only the real API base URL.
- `Get-Content -LiteralPath docs/INTERNAL_BETA_CHECKLIST.md`: confirmed the checklist already documents local Mock API setup, fixed OTP `123456`, in-memory limitations, and guest-mode/account-sync tester tasks.
- `apply_patch` on `package.json`: added `validate:mock-api` (`node --check scripts/mock-aliyun-api.js`) and included it in `npm run check` after the existing sync validation.
- `npm.cmd run check`: passed with typecheck, audio catalog validation, Aliyun contract validation, sync merge validation, and the new mock API syntax validation.
- `git diff --check`: passed after mock API and package updates; only normal Windows LF-to-CRLF working-copy warnings were reported.
- `git status -sb`: final status shows modified `docs/HANDOFF_CONTEXT.md`, `docs/INTERNAL_BETA_CHECKLIST.md`, and `package.json`, plus untracked `scripts/mock-aliyun-api.js` and `scripts/validate-sync-merge-rules.js`.
- `git diff --stat`: tracked diff summary shows handoff, internal beta checklist, and package script changes; untracked mock/sync validation scripts are not included until staged.
- `git diff -- package.json scripts/mock-aliyun-api.js docs/INTERNAL_BETA_CHECKLIST.md | Select-Object -First 220`: reviewed key tracked diffs; package now exposes `mock:api`, `validate:sync`, and `validate:mock-api`, and the beta checklist documents the local Mock API flow and local-first limitation.
- `Get-Content -LiteralPath docs/HANDOFF_CONTEXT.md`: read handoff before implementing the UI polish plan; first execution step is to validate and commit the already-completed Mock API, sync validation, and beta checklist updates.
- `git status -sb`: confirmed pending first-commit scope on `codex/playback-modes`: modified handoff/checklist/package plus new mock API and sync validation scripts.
- `npm.cmd run check`: passed before the first planned small commit; typecheck, audio validation, Aliyun contract validation, sync merge validation, and mock API syntax validation all succeeded.
- `npx.cmd expo install --check`: passed before the first planned small commit; dependencies are up to date.
- `git diff --check`: passed before the first planned small commit; only normal Windows LF-to-CRLF working-copy warnings were reported.
- `git add docs/HANDOFF_CONTEXT.md docs/INTERNAL_BETA_CHECKLIST.md package.json scripts/mock-aliyun-api.js scripts/validate-sync-merge-rules.js`: staged the first planned small commit scope; Git reported normal Windows LF-to-CRLF working-copy warnings.
- `git add docs/HANDOFF_CONTEXT.md`: restaged the handoff after recording the first staging command; Git reported the normal Windows LF-to-CRLF warning.

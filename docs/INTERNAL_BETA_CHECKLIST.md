# Internal Beta Checklist

Use this checklist before sharing Codex Sleep with a small test group.

## Tester Tasks

1. Open each module from the home screen: music, stories, and white noise.
2. Play one music track for at least 10 minutes with no timer enabled by default.
3. Switch playback mode between single repeat, sequential, repeat all, and shuffle.
4. Favorite one track, restart the app, and confirm it remains in favorites.
5. Play two different tracks and confirm they appear in recently played.
6. Open AI Sleep, select each sleep goal, switch between 5/10/20/30 minute durations, and start one recommendation.
7. Confirm AI Sleep opens the player, starts the recommended queue, and applies the selected timer.
8. Open the player timer controls, set a preset or custom sleep timer, and confirm the timer state appears only for the current playback session.
9. Open Settings, switch appearance between system, dark, and light, and confirm key screens remain readable.
10. Open Privacy, Audio Credits, and the beta feedback link.
11. Play at least 3 music tracks, 3 story/guidance tracks, and 3 white-noise tracks from the expanded 30-item catalog.
12. Open Account & Sync from Settings:
   - With no `EXPO_PUBLIC_API_BASE_URL`, confirm guest mode explains that data is saved locally.
   - With the local Mock API configured, send a phone code, enter `123456`, sign in, and confirm favorites, recent plays, and settings merge after login.
   - With the deployed Aliyun API configured, use a real SMS code, sign in, and confirm favorites, recent plays, and settings restore after clearing local app data.
   - Sign out and confirm local playback and favorites remain usable.

## Local Mock Account API

Use the Mock API to test the account flow before deploying real Alibaba Cloud
Function Compute handlers:

```bash
npm.cmd run mock:api
```

Then set the Expo app variable to the printed URL, for example:

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8787
```

The Mock API uses fixed SMS code `123456`, stores users/sessions/sync data in
memory, supports CORS for Expo Web, and resets when the process exits. It is
only for local/internal flow testing; it does not send real SMS, persist to RDS,
hash tokens, or implement real cloud revocation policy.

## Cloud Account API

After deploying Function Compute, use `docs/CLOUD_BETA_RELEASE_CHECKLIST.md` for
RDS setup, SMS smoke, and app end-to-end sync recovery checks. The cloud API
must pass `npm.cmd run smoke:aliyun-cloud` before inviting external testers.

## Device Checks

- Run `npm.cmd run validate:android-beta` before cutting an Android preview APK.
- Test once in Expo Go or an Android preview build.
- Confirm playback continues while navigating between app screens.
- Confirm the timer stops audio when it reaches zero.
- Confirm a failed audio load does not show `NaN` time or break the layout.
- Confirm bottom navigation does not cover the main player controls.
- Confirm the bottom navigation shows Home, AI Sleep, Favorites, and Settings; the full player is opened from tracks or the mini player.
- Confirm guest mode remains usable when the Aliyun API endpoint is empty or unreachable.
- Internal preview APKs may use the debug keystore only for small-group testing; generate a real release keystore before any public or store-distributed build.

## Audio Quality Checks

- Current beta catalog target: 10 music, 8 story/guidance, and 12 white-noise items.
- Confirm no track has a sudden volume jump at start or end.
- For loopable music/noise, confirm the first repeat does not feel sharply cut.
- For Mandarin story/guidance tracks, confirm speech is slow enough for bedtime use.
- Open Audio Credits and confirm every item has source, author, license, and URL.
- Treat project-owned generated/TTS audio as beta-quality: usable for internal testing, but still subject to final public-release quality review.

## Feedback To Collect

- Which audio category felt most useful?
- Did the AI Sleep recommendation match the selected goal?
- Did the timer behavior match expectations?
- Were any labels confusing?
- Did playback fail or stop unexpectedly?
- Was anything missing after removing the manual sleep log?

## Known Beta Limitations

- The expanded audio catalog is authorization-first and currently has no `Internal beta placeholder` items, but project-owned generated/TTS audio still needs a final quality review before public launch.
- The app is local-first. Account sync can be tested with the local Mock API; real beta cloud sync requires a configured Aliyun API endpoint and passing cloud smoke.
- Android release signing is still in internal-beta mode and uses the debug keystore in the native project until a production keystore is created.
- Codex Sleep is a relaxation tool, not a medical device or treatment.

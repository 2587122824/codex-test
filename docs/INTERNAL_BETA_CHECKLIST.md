# Internal Beta Checklist

Use this checklist before sharing Codex Sleep with a small test group.

## Tester Tasks

1. Open each module from the home screen: music, stories, and white noise.
2. Play one music track for at least 10 minutes with the default timer enabled.
3. Switch playback mode between single repeat, sequential, repeat all, and shuffle.
4. Favorite one track, restart the app, and confirm it remains in favorites.
5. Play two different tracks and confirm they appear in recently played.
6. Add one sleep log entry with a rating and note, then edit it.
7. Set a custom sleep timer and confirm the timer state appears on the player screen.
8. Open Settings, Privacy, Audio Credits, and the beta feedback link.
9. Open Account & Sync from Settings:
   - With no `EXPO_PUBLIC_API_BASE_URL`, confirm guest mode explains that data is saved locally.
   - With the local Mock API configured, send a phone code, enter `123456`, sign in, and confirm favorites, recent plays, settings, and sleep logs merge after login.
   - Sign out and confirm local playback, favorites, and sleep logs remain usable.

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

## Device Checks

- Test once in Expo Go or an Android preview build.
- Confirm playback continues while navigating between app screens.
- Confirm the timer stops audio when it reaches zero.
- Confirm a failed audio load does not show `NaN` time or break the layout.
- Confirm bottom navigation does not cover the main player controls.
- Confirm guest mode remains usable when the Aliyun API endpoint is empty or unreachable.

## Feedback To Collect

- Which audio category felt most useful?
- Did the timer behavior match expectations?
- Were any labels confusing?
- Did playback fail or stop unexpectedly?
- Was the sleep log worth keeping, or did it feel like extra work?

## Known Beta Limitations

- Some audio items are internal placeholders and must be replaced before public launch.
- The app is local-first. Account sync can be tested with the local Mock API; real beta cloud sync still requires a configured Aliyun API endpoint and real Function Compute handlers.
- Codex Sleep is a relaxation tool, not a medical device or treatment.

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

## Device Checks

- Test once in Expo Go or an Android preview build.
- Confirm playback continues while navigating between app screens.
- Confirm the timer stops audio when it reaches zero.
- Confirm a failed audio load does not show `NaN` time or break the layout.
- Confirm bottom navigation does not cover the main player controls.

## Feedback To Collect

- Which audio category felt most useful?
- Did the timer behavior match expectations?
- Were any labels confusing?
- Did playback fail or stop unexpectedly?
- Was the sleep log worth keeping, or did it feel like extra work?

## Known Beta Limitations

- Some audio items are internal placeholders and must be replaced before public launch.
- The app is local-only and does not sync data between devices.
- Codex Sleep is a relaxation tool, not a medical device or treatment.

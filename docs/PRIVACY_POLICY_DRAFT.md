# Codex Sleep Privacy Policy Draft

Last updated: 2026-06-01

Codex Sleep is a local-first sleep companion app. Guest mode does not require login and keeps user data on the device. If the user signs in, selected app data is synchronized through the Alibaba Cloud backend for backup and multi-device recovery. The app does not include advertising, analytics, or tracking SDKs.

## Data Stored On Device

The app stores the following data locally on the user's device:

- Favorites
- Recently played audio
- Current playback timer and app settings
- AI Sleep choices such as selected goal and timer are used only during the current app session

This data is used only to provide app functionality. In guest mode it remains on the user's device.

## Data Collection

When account sync is enabled and the user signs in, the app may upload the following data to Alibaba Cloud Function Compute and RDS PostgreSQL:

- Account identifiers such as phone number or social login user ID
- Favorites
- Recently played audio IDs
- Current playback timer and app settings

Audio files are not uploaded by account sync. Users should be offered account deletion and cloud data deletion controls before public launch.

## Health Disclaimer

Codex Sleep provides relaxation audio and sleep guidance. It is not a medical device and does not diagnose, treat, cure, or prevent any condition. Users should consult a qualified professional for medical concerns.

## Contact

For internal beta feedback, contact `codex-sleep-feedback@example.com`.

Replace this address with the final developer support email before public launch.

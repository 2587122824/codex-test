# Audio Asset Sources

This project now has a clean audio replacement workflow:

- MVP audio files are generated locally and are safe placeholders owned by this project.
- Production audio should be replaced with files that have explicit license records.
- Every catalog item must keep `source.name`, `source.author`, `source.license`, `source.url`, and `source.attributionRequired`.

## Recommended Sources

Use these sources first because their license terms are easy to inspect and record:

- Pixabay Music and Sound Effects: royalty-free music and sound effects with a simple content license.
- Wikimedia Commons: useful for public domain and Creative Commons audio files.
- LibriVox: public domain audiobook recordings for sleep stories and classic fairy tales.
- Freesound: good for white noise and environmental loops, but filter for CC0 or CC BY only.

Avoid non-commercial licenses for a commercial app:

- Do not use CC BY-NC, CC BY-NC-SA, or unclear YouTube downloads.
- For CC BY assets, show attribution in an in-app credits screen.
- For CC0/public domain assets, still keep the source URL for auditability.

## Target Folder Layout

```text
assets/audio/music/
assets/audio/stories/
assets/audio/noise/
assets/covers/
```

## Replacement Checklist

1. Download the original source from the creator page, not a mirror.
2. Confirm the license allows app distribution and commercial use.
3. Prefer MP3 or WAV for broad Expo/mobile compatibility.
4. Normalize loudness so tracks do not jump in volume.
5. Update `src/shared/content/audioCatalog.ts`.
6. Keep the source URL and attribution fields with the track.

# Google Play Launch Checklist

## Build

- Android package: `com.codexsleep.app`
- Version: `1.0.0`
- Version code: `1`
- Preview build: `npx eas build --platform android --profile preview`
- Production build: `npx eas build --platform android --profile production`

## Store Listing

Short description:

> 音乐、故事和白噪音助眠，支持字幕、定时关闭和本地睡眠记录。

Full description draft:

> Codex Sleep 是一个纯本地助眠 App，提供舒缓音乐、睡前故事和白噪音。你可以收藏常听内容，查看字幕，引导自己慢慢放松，并用定时关闭功能安心入睡。App 还支持本地睡眠记录，帮助你回顾睡眠时长和主观评分。
>
> 当前版本不需要登录，不上传个人数据，不接入广告或追踪 SDK。收藏、最近播放、设置和睡眠记录都保存在本机。

Screenshots to prepare:

- Home with three sleep modules
- Music list
- Story list
- Player with captions and progress
- Sleep log edit form
- Settings with privacy and audio credits

## Content And Privacy

- Replace generated MVP audio with licensed production audio before public launch.
- Verify each audio item has author, license, source URL, and attribution flag.
- Publish `docs/PRIVACY_POLICY_DRAFT.md` as a real web page and replace the contact section.
- Google Play data safety: declare local-only data storage and no server collection for this version.
- Avoid medical claims such as treating insomnia or diagnosing sleep disorders.

# Google Play Launch Checklist

## Build

- Android package: `com.codexsleep.app`
- Version: `1.0.0`
- Version code: `1`
- Preview build: `npx eas build --platform android --profile preview`
- Production build: `npx eas build --platform android --profile production`

## Store Listing

Short description:

> 音乐、故事、白噪音和本地 AI 推荐助眠，支持字幕与定时关闭。

Full description draft:

> Codex Sleep 是一个本地优先的助眠 App，提供舒缓音乐、睡前故事、白噪音和本地 AI 助眠推荐。你可以按快速入睡、焦虑放松、半夜醒来、自然白噪音或睡前故事选择目标，让 App 自动组合播放队列和定时关闭时长。
>
> 当前版本不需要登录，不接入广告或追踪 SDK。收藏、最近播放和设置会先保存在本机；配置账号 API 后，可用于多设备同步和备份。

Screenshots to prepare:

- Home with three sleep modules
- Music list
- Story list
- AI Sleep recommendation screen
- Player with captions and progress
- Settings with privacy and audio credits

## Content And Privacy

- Run `npm run check` before every beta or release candidate build.
- Complete `docs/INTERNAL_BETA_CHECKLIST.md` before inviting external testers.
- Review project-owned generated/TTS beta audio quality before public launch; replace any weak item with commissioned or licensed production audio.
- Verify each of the 30 beta audio items has author, license, source URL, and attribution flag.
- Publish `docs/PRIVACY_POLICY_DRAFT.md` as a real web page and replace the contact section.
- Google Play data safety: declare local-only data storage and no server collection for this version.
- Avoid medical claims such as treating insomnia or diagnosing sleep disorders.

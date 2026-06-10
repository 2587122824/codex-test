# Codex Sleep

一个基于 Expo React Native + TypeScript 的本地优先手机助眠 App。当前阶段目标是小范围内测可用。

## 核心模块

- 听歌助眠：舒缓音乐、轻音乐、冥想音乐。
- 听故事助眠：单集睡前故事。
- 听白噪音助眠：雨声、海浪等循环环境声。
- 播放器：支持单曲循环、顺序播放、列表循环、随机播放和默认定时关闭。
- 本地记录：收藏、最近播放、设置和睡眠记录保存在设备本机。

## 音频资产

当前内测版已内置 13 条本地音频，按 `music`、`stories`、`noise` 三类组织。部分音乐、故事和白噪音仍是内测占位素材，正式发布前需要替换为授权素材。正式素材替换流程见 `docs/AUDIO_ASSET_SOURCES.md`。

## 本地运行

```bash
npm install
npm run start
```

## 环境变量

复制 `.env.example` 为 `.env.local` 后按需调整。第一版默认使用本地内置音频，不需要后端密钥。

```bash
npm run typecheck
npm run validate:audio
npm run validate:aliyun
npm run check
```

## Alibaba Cloud Backend

Account sync is designed around Alibaba Cloud Function Compute, Alibaba Cloud SMS,
and Alibaba Cloud RDS PostgreSQL. The app only needs one public endpoint:

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-function-domain.example.com
```

Backend schema and route contracts live in `server/aliyun-functions/`.

## 内测准备

- 内测任务清单见 `docs/INTERNAL_BETA_CHECKLIST.md`。
- 隐私政策草稿见 `docs/PRIVACY_POLICY_DRAFT.md`。
- Google Play 上架准备事项见 `docs/PLAY_STORE_CHECKLIST.md`。

# Codex Sleep

一个基于 Expo React Native + TypeScript 的手机助眠 App MVP。

## 核心模块

- 听歌助眠：舒缓音乐、轻音乐、冥想音乐。
- 听故事助眠：单集睡前故事。
- 听白噪音助眠：雨声、海浪等循环环境声。

## 音频资产

当前 MVP 已内置 9 条本地样例音频，按 `music`、`stories`、`noise` 三类组织。正式素材替换流程见 `docs/AUDIO_ASSET_SOURCES.md`。

## 本地运行

```bash
npm install
npm run start
```

## 环境变量

复制 `.env.example` 为 `.env.local` 后按需调整。第一版默认使用本地内置音频，不需要后端密钥。

```bash
npm run typecheck
```

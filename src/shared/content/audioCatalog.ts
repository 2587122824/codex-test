import type { AudioItem, AudioType, ModuleDefinition } from '../types/audio';

export const modules: ModuleDefinition[] = [
  {
    type: 'music',
    title: '听歌助眠',
    subtitle: '舒缓音乐 / 轻音乐 / 冥想音乐',
    description: '慢速旋律和低刺激音色，适合睡前放松。',
    accent: '#6D8BFF',
  },
  {
    type: 'story',
    title: '听故事助眠',
    subtitle: '单集睡前故事',
    description: '节奏轻柔的短故事，帮助注意力慢慢安静下来。',
    accent: '#B7791F',
  },
  {
    type: 'noise',
    title: '听白噪音助眠',
    subtitle: '雨声 / 海浪 / 森林环境声',
    description: '循环环境声遮蔽干扰，适合持续陪伴入睡。',
    accent: '#1F9D86',
  },
];

export const audioCatalog: AudioItem[] = [
  {
    id: 'music-breath',
    type: 'music',
    title: '慢呼吸练习',
    description: '稳定、低频的舒缓音乐，占位音频可替换为正式曲目。',
    duration: 180,
    category: '冥想音乐',
    asset: require('../../../assets/audio/music-breath.wav'),
    cover: '#6D8BFF',
  },
  {
    id: 'music-moon',
    type: 'music',
    title: '月光轻眠',
    description: '适合睡前阅读后的轻音乐。',
    duration: 210,
    category: '轻音乐',
    asset: require('../../../assets/audio/music-moon.wav'),
    cover: '#8E6BFF',
  },
  {
    id: 'story-stars',
    type: 'story',
    title: '星星慢慢落下',
    description: '单集睡前故事，占位音频用于验证播放链路。',
    duration: 300,
    category: '温柔故事',
    asset: require('../../../assets/audio/story-stars.wav'),
    cover: '#B7791F',
  },
  {
    id: 'story-forest',
    type: 'story',
    title: '森林里的晚安信',
    description: '轻节奏短故事，后续可替换为真人旁白。',
    duration: 360,
    category: '自然故事',
    asset: require('../../../assets/audio/story-forest.wav'),
    cover: '#9C6A2E',
  },
  {
    id: 'noise-rain',
    type: 'noise',
    title: '窗边细雨',
    description: '循环雨声白噪音，适合屏蔽夜间干扰。',
    duration: 120,
    category: '雨声',
    asset: require('../../../assets/audio/noise-rain.wav'),
    cover: '#1F9D86',
  },
  {
    id: 'noise-ocean',
    type: 'noise',
    title: '远处海浪',
    description: '低频海浪环境声，默认循环播放。',
    duration: 120,
    category: '海浪',
    asset: require('../../../assets/audio/noise-ocean.wav'),
    cover: '#247BA0',
  },
];

export const getModule = (type: AudioType) =>
  modules.find((module) => module.type === type);

export const getItemsByType = (type: AudioType) =>
  audioCatalog.filter((item) => item.type === type);

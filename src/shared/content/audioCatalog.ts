import type { AudioItem, AudioType, ModuleDefinition } from '../types/audio';

const generatedSource = {
  name: 'MVP local generated asset',
  author: 'Codex Sleep project',
  license: 'Project-owned placeholder',
  url: 'docs/AUDIO_ASSET_SOURCES.md',
  attributionRequired: false,
};

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
    id: 'music-breathing-pad',
    type: 'music',
    title: '慢呼吸和弦',
    description: '长音和弦随呼吸缓慢起伏，适合刚躺下时放松身体。',
    duration: 24,
    category: '冥想音乐',
    asset: require('../../../assets/audio/music/breathing-pad.wav'),
    cover: '#6D8BFF',
    source: generatedSource,
  },
  {
    id: 'music-moon-piano',
    type: 'music',
    title: '月光钢琴',
    description: '稀疏的柔和音符，减少旋律刺激，适合作为睡前背景。',
    duration: 24,
    category: '轻音乐',
    asset: require('../../../assets/audio/music/moon-piano.wav'),
    cover: '#8E6BFF',
    source: generatedSource,
  },
  {
    id: 'music-deep-meditation',
    type: 'music',
    title: '低频冥想垫底',
    description: '更低频、更稳定的环境底音，适合冥想和放空。',
    duration: 28,
    category: '舒缓音乐',
    asset: require('../../../assets/audio/music/deep-meditation.wav'),
    cover: '#4E7AC7',
    source: generatedSource,
  },
  {
    id: 'story-stars-falling',
    type: 'story',
    title: '星星慢慢落下',
    description: '中文 TTS 单集睡前故事，语速较慢，适合验证故事助眠体验。',
    duration: 20,
    category: '温柔故事',
    asset: require('../../../assets/audio/stories/stars-falling.wav'),
    cover: '#B7791F',
    source: generatedSource,
  },
  {
    id: 'story-forest-letter',
    type: 'story',
    title: '森林里的晚安信',
    description: '一封来自森林小屋的晚安信，帮助注意力从白天抽离。',
    duration: 20,
    category: '自然故事',
    asset: require('../../../assets/audio/stories/forest-letter.wav'),
    cover: '#9C6A2E',
    source: generatedSource,
  },
  {
    id: 'story-cloud-boat',
    type: 'story',
    title: '云朵小船',
    description: '短篇云朵故事，节奏轻，适合睡前最后几分钟。',
    duration: 18,
    category: '梦境故事',
    asset: require('../../../assets/audio/stories/cloud-boat.wav'),
    cover: '#C28C3A',
    source: generatedSource,
  },
  {
    id: 'noise-rain-window',
    type: 'noise',
    title: '窗边细雨',
    description: '细雨和随机雨滴组合，默认循环播放，适合屏蔽夜间干扰。',
    duration: 28,
    category: '雨声',
    asset: require('../../../assets/audio/noise/rain-window.wav'),
    cover: '#1F9D86',
    source: generatedSource,
  },
  {
    id: 'noise-ocean-waves',
    type: 'noise',
    title: '远处海浪',
    description: '周期性海浪起伏和低频底音，适合持续陪伴入睡。',
    duration: 30,
    category: '海浪',
    asset: require('../../../assets/audio/noise/ocean-waves.wav'),
    cover: '#247BA0',
    source: generatedSource,
  },
  {
    id: 'noise-night-wind',
    type: 'noise',
    title: '夜晚微风',
    description: '轻风环境声，变化慢，不会突然打断睡意。',
    duration: 30,
    category: '风声',
    asset: require('../../../assets/audio/noise/night-wind.wav'),
    cover: '#5C8374',
    source: generatedSource,
  },
];

export const getModule = (type: AudioType) =>
  modules.find((module) => module.type === type);

export const getItemsByType = (type: AudioType) =>
  audioCatalog.filter((item) => item.type === type);

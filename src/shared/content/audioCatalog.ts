import type { AudioItem, AudioType, ModuleDefinition } from '../types/audio';

const generatedSource = {
  name: 'MVP local generated asset',
  author: 'Codex Sleep project',
  license: 'Project-owned placeholder',
  url: 'docs/AUDIO_ASSET_SOURCES.md',
  attributionRequired: false,
};

const soporificSource = {
  name: 'Wikimedia Commons / Free Music Archive',
  author: 'Kevin MacLeod',
  license: 'CC BY 3.0',
  url: 'https://commons.wikimedia.org/wiki/File:Kevin_MacLeod_-_Soporific.ogg',
  attributionRequired: true,
};

const ambientSource = {
  name: 'Wikimedia Commons / SoundCloud',
  author: 'Brenticus',
  license: 'CC BY 3.0',
  url: 'https://commons.wikimedia.org/wiki/File:Brenticus_-_Ambient.ogg',
  attributionRequired: true,
};

const rainSource = {
  name: 'Wikimedia Commons / PDSounds',
  author: 'ezwa',
  license: 'Public domain',
  url: 'https://commons.wikimedia.org/wiki/File:Rain_(1).ogg',
  attributionRequired: false,
};

const campfireSource = {
  name: 'Wikimedia Commons / Freesound',
  author: 'Glaneur de sons',
  license: 'CC BY 3.0',
  url: 'https://commons.wikimedia.org/wiki/File:Campfire_sound_ambience.ogg',
  attributionRequired: true,
};

const shorebirdsSource = {
  name: 'Wikimedia Commons / USFWS',
  author: 'U.S. Fish and Wildlife Service',
  license: 'Public domain',
  url: 'https://commons.wikimedia.org/wiki/File:Cape_May_Shorebirds_(distant).ogg',
  attributionRequired: false,
};

const breathingCaptions = [
  { start: 0, end: 8, text: '慢慢吸气，让肩膀松下来。' },
  { start: 8, end: 16, text: '缓缓呼气，把注意力交给声音。' },
  { start: 16, end: 24, text: '不用追赶旋律，只要安静地躺着。' },
];

const softMusicCaptions = [
  { start: 0, end: 8, text: '让第一声落下，今晚不用再用力。' },
  { start: 8, end: 16, text: '如果想到别的事，就轻轻回到音乐里。' },
  { start: 16, end: 24, text: '眼睛可以慢慢闭上，身体会自己休息。' },
];

const meditationCaptions = [
  { start: 0, end: 9, text: '感受低频声音像一条稳定的线。' },
  { start: 9, end: 18, text: '念头来了也没关系，让它慢慢经过。' },
  { start: 18, end: 28, text: '把今天放在一边，留给明天再处理。' },
];

const rainCaptions = [
  { start: 0, end: 9, text: '雨声落在窗边，房间变得更安静。' },
  { start: 9, end: 18, text: '听见雨滴，也听见自己的呼吸。' },
  { start: 18, end: 28, text: '让细雨陪你慢慢沉入睡意。' },
];

const oceanCaptions = [
  { start: 0, end: 10, text: '海浪远远靠近，又轻轻退回去。' },
  { start: 10, end: 20, text: '跟着起伏放松胸口和腹部。' },
  { start: 20, end: 30, text: '每一次浪声，都把紧张带走一点。' },
];

const windCaptions = [
  { start: 0, end: 10, text: '夜风很轻，只经过，不打扰。' },
  { start: 10, end: 20, text: '让身体停在柔软的位置上。' },
  { start: 20, end: 30, text: '你可以什么都不做，只是休息。' },
];

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
    title: 'Soporific',
    description: 'Kevin MacLeod 的舒缓环境音乐，适合长时间睡前放松。',
    duration: 290,
    category: '冥想音乐',
    asset: require('../../../assets/audio/music/soporific-kevin-macleod.ogg'),
    cover: '#6D8BFF',
    captions: breathingCaptions,
    source: soporificSource,
  },
  {
    id: 'music-moon-piano',
    type: 'music',
    title: 'Ambient',
    description: 'Brenticus 的氛围音乐，音色柔和，适合作为睡前背景。',
    duration: 265,
    category: '轻音乐',
    asset: require('../../../assets/audio/music/brenticus-ambient.ogg'),
    cover: '#8E6BFF',
    captions: softMusicCaptions,
    source: ambientSource,
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
    captions: meditationCaptions,
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
    captions: [
      { start: 0, end: 5, text: '夜空很安静。' },
      { start: 5, end: 11, text: '星星一颗一颗慢慢落下，像柔软的灯。' },
      { start: 11, end: 16, text: '它们照在你的窗前。' },
      { start: 16, end: 20, text: '你只需要跟着呼吸，慢慢闭上眼睛。' },
    ],
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
    captions: [
      { start: 0, end: 5, text: '森林里的小木屋亮着一盏灯。' },
      { start: 5, end: 10, text: '晚风把一封晚安信送到枕边。' },
      { start: 10, end: 16, text: '信上写着，今天已经很好了。' },
      { start: 16, end: 20, text: '现在可以休息了。' },
    ],
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
    captions: [
      { start: 0, end: 5, text: '一只云朵做的小船，停在安静的湖面。' },
      { start: 5, end: 10, text: '你躺在船里，听见水波轻轻摇晃。' },
      { start: 10, end: 15, text: '它带着你往前，越来越轻。' },
      { start: 15, end: 18, text: '然后进入柔软的梦里。' },
    ],
    source: generatedSource,
  },
  {
    id: 'noise-rain-window',
    type: 'noise',
    title: '窗边细雨',
    description: '来自 PDSounds 的真实雨声录音，默认循环播放，适合屏蔽夜间干扰。',
    duration: 45,
    category: '雨声',
    asset: require('../../../assets/audio/noise/rain-pdsounds-ezwa.ogg'),
    cover: '#1F9D86',
    captions: rainCaptions,
    source: rainSource,
  },
  {
    id: 'noise-ocean-waves',
    type: 'noise',
    title: '海岸远声',
    description: '美国鱼类及野生动物管理局录音，远处鸟鸣和浪声混合。',
    duration: 14,
    category: '海岸',
    asset: require('../../../assets/audio/noise/shorebirds-waves-usfws.ogg'),
    cover: '#247BA0',
    captions: oceanCaptions,
    source: shorebirdsSource,
  },
  {
    id: 'noise-night-wind',
    type: 'noise',
    title: '篝火环境声',
    description: 'Freesound 上的真实篝火环境声，适合安静陪伴入睡。',
    duration: 60,
    category: '篝火',
    asset: require('../../../assets/audio/noise/campfire-glaneur.ogg'),
    cover: '#5C8374',
    captions: windCaptions,
    source: campfireSource,
  },
];

export const getModule = (type: AudioType) =>
  modules.find((module) => module.type === type);

export const getItemsByType = (type: AudioType) =>
  audioCatalog.filter((item) => item.type === type);

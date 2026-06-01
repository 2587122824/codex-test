export type AudioType = 'music' | 'story' | 'noise';

export type CaptionCue = {
  start: number;
  end: number;
  text: string;
};

export type AudioItem = {
  id: string;
  type: AudioType;
  title: string;
  description: string;
  duration: number;
  category: string;
  asset: number | string;
  cover: string;
  captions?: CaptionCue[];
  source: {
    name: string;
    author: string;
    license: string;
    url: string;
    attributionRequired: boolean;
  };
};

export type ModuleDefinition = {
  type: AudioType;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
};

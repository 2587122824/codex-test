import type { PlaybackMode } from '../../shared/types/audio';

export const defaultPlaybackMode: PlaybackMode = 'repeat-all';
export const historyLimit = 12;

export const getRandomNextIndex = (
  queueLength: number,
  currentIndex: number,
  random = Math.random,
) => {
  if (queueLength <= 1) {
    return 0;
  }

  let nextIndex = currentIndex;
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(random() * queueLength);
  }

  return nextIndex;
};

export const getNextPlaybackIndex = ({
  queueLength,
  currentIndex,
  mode,
  repeatOneReturnsCurrent = true,
  random,
}: {
  queueLength: number;
  currentIndex: number;
  mode: PlaybackMode;
  repeatOneReturnsCurrent?: boolean;
  random?: () => number;
}) => {
  if (queueLength <= 0) {
    return null;
  }

  if (mode === 'repeat-one' && repeatOneReturnsCurrent) {
    return currentIndex;
  }

  if (mode === 'sequential' && currentIndex >= queueLength - 1) {
    return null;
  }

  if (mode === 'shuffle') {
    return getRandomNextIndex(queueLength, currentIndex, random);
  }

  return (currentIndex + 1) % queueLength;
};

export const getPreviousPlaybackIndex = ({
  queueLength,
  currentIndex,
  mode,
  random,
}: {
  queueLength: number;
  currentIndex: number;
  mode: PlaybackMode;
  random?: () => number;
}) => {
  if (queueLength <= 0) {
    return null;
  }

  if (mode === 'sequential' && currentIndex <= 0) {
    return null;
  }

  if (mode === 'shuffle') {
    return getRandomNextIndex(queueLength, currentIndex, random);
  }

  return (currentIndex - 1 + queueLength) % queueLength;
};

export const addTrackToHistory = (currentIds: string[], trackId: string) =>
  [trackId, ...currentIds.filter((id) => id !== trackId)].slice(0, historyLimit);

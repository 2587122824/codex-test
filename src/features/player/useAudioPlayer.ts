import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { storageKeys } from '../../shared/storage/keys';
import { storage } from '../../shared/storage/storage';
import type { AudioItem, PlaybackMode } from '../../shared/types/audio';

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

const timerOptions = [15, 30, 45, 60];
const defaultPlaybackMode: PlaybackMode = 'repeat-all';

const getRandomNextIndex = (queueLength: number, currentIndex: number) => {
  if (queueLength <= 1) {
    return 0;
  }

  let nextIndex = currentIndex;
  while (nextIndex === currentIndex) {
    nextIndex = Math.floor(Math.random() * queueLength);
  }

  return nextIndex;
};

export const useAudioPlayer = () => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<AudioItem[]>([]);
  const currentIndexRef = useRef(0);
  const playbackModeRef = useRef<PlaybackMode>(defaultPlaybackMode);
  const finishTransitionRef = useRef(false);
  const handleTrackFinishedRef = useRef<(() => Promise<void>) | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioItem | null>(null);
  const [queue, setQueue] = useState<AudioItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackMode, setPlaybackModeState] = useState<PlaybackMode>(defaultPlaybackMode);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [historyIds, setHistoryIds] = useState<string[]>([]);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const syncQueueState = useCallback((nextQueue: AudioItem[], nextIndex: number) => {
    queueRef.current = nextQueue;
    currentIndexRef.current = nextIndex;
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
  }, []);

  const unloadCurrentSound = useCallback(async () => {
    if (soundRef.current) {
      soundRef.current.setOnPlaybackStatusUpdate(null);
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  }, []);

  const stop = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTimerEndsAt(null);
    setRemainingSeconds(0);
    setPositionMillis(0);
    setPlaybackError(null);
    await unloadCurrentSound();
    setPlaybackState('idle');
  }, [unloadCurrentSound]);

  const addToHistory = useCallback(async (trackId: string) => {
    setHistoryIds((current) => {
      const next = [trackId, ...current.filter((id) => id !== trackId)].slice(0, 12);
      storage.setJson(storageKeys.history, next);
      return next;
    });
  }, []);

  const playTrackAtIndex = useCallback(
    async (nextQueue: AudioItem[], nextIndex: number, addHistory = true) => {
      const safeQueue = nextQueue.length > 0 ? nextQueue : queueRef.current;
      const track = safeQueue[nextIndex];

      if (!track) {
        setPlaybackState('paused');
        return;
      }

      setPlaybackState('loading');
      setCurrentTrack(track);
      syncQueueState(safeQueue, nextIndex);
      setPositionMillis(0);
      setDurationMillis(track.duration * 1000);
      setPlaybackError(null);

      if (addHistory) {
        await addToHistory(track.id);
      }

      await unloadCurrentSound();

      try {
        const { sound } = await Audio.Sound.createAsync(
          typeof track.asset === 'string' ? { uri: track.asset } : track.asset,
          {
            isLooping: false,
            shouldPlay: false,
            volume: 0.85,
          },
        );

        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) {
            return;
          }

          setPositionMillis(status.positionMillis);
          setDurationMillis(status.durationMillis ?? track.duration * 1000);

          if (status.didJustFinish && !finishTransitionRef.current) {
            finishTransitionRef.current = true;
            void (handleTrackFinishedRef.current?.() ?? Promise.resolve()).finally(() => {
              finishTransitionRef.current = false;
            });
          }
        });
        await sound.playAsync();
        setPlaybackState('playing');
      } catch {
        setPlaybackError('音频暂时无法播放，请稍后重试或切换其他内容。');
        setPlaybackState('paused');
      }
    },
    [addToHistory, syncQueueState, unloadCurrentSound],
  );

  const playTrack = useCallback(
    async (track: AudioItem, sourceQueue?: AudioItem[]) => {
      const nextQueue = sourceQueue && sourceQueue.length > 0 ? sourceQueue : [track];
      const nextIndex = Math.max(
        0,
        nextQueue.findIndex((item) => item.id === track.id),
      );

      await playTrackAtIndex(nextQueue, nextIndex);
    },
    [playTrackAtIndex],
  );

  const handleTrackFinished = useCallback(async () => {
    const activeQueue = queueRef.current;
    const activeIndex = currentIndexRef.current;
    const mode = playbackModeRef.current;

    if (activeQueue.length === 0) {
      setPlaybackState('paused');
      return;
    }

    if (mode === 'repeat-one') {
      setPositionMillis(0);
      await soundRef.current?.setPositionAsync(0);
      await soundRef.current?.playAsync();
      setPlaybackState('playing');
      return;
    }

    if (mode === 'sequential' && activeIndex >= activeQueue.length - 1) {
      setPlaybackState('paused');
      return;
    }

    const nextIndex =
      mode === 'shuffle'
        ? getRandomNextIndex(activeQueue.length, activeIndex)
        : (activeIndex + 1) % activeQueue.length;

    await playTrackAtIndex(activeQueue, nextIndex);
  }, [playTrackAtIndex]);

  useEffect(() => {
    handleTrackFinishedRef.current = handleTrackFinished;
  }, [handleTrackFinished]);

  const playNext = useCallback(async () => {
    const activeQueue = queueRef.current;
    const activeIndex = currentIndexRef.current;

    if (activeQueue.length === 0) {
      return;
    }

    if (playbackModeRef.current === 'sequential' && activeIndex >= activeQueue.length - 1) {
      return;
    }

    const nextIndex =
      playbackModeRef.current === 'shuffle'
        ? getRandomNextIndex(activeQueue.length, activeIndex)
        : (activeIndex + 1) % activeQueue.length;

    await playTrackAtIndex(activeQueue, nextIndex);
  }, [playTrackAtIndex]);

  const playPrevious = useCallback(async () => {
    const activeQueue = queueRef.current;
    const activeIndex = currentIndexRef.current;

    if (activeQueue.length === 0) {
      return;
    }

    if (playbackModeRef.current === 'sequential' && activeIndex <= 0) {
      await seekToStart();
      return;
    }

    const previousIndex =
      playbackModeRef.current === 'shuffle'
        ? getRandomNextIndex(activeQueue.length, activeIndex)
        : (activeIndex - 1 + activeQueue.length) % activeQueue.length;

    await playTrackAtIndex(activeQueue, previousIndex);
  }, [playTrackAtIndex]);

  const seekToMillis = useCallback(
    async (millis: number) => {
      const clampedMillis = Math.max(0, Math.min(millis, durationMillis || millis));
      setPositionMillis(clampedMillis);

      if (!soundRef.current) {
        return;
      }

      await soundRef.current.setPositionAsync(clampedMillis);
    },
    [durationMillis],
  );

  async function seekToStart() {
    setPositionMillis(0);
    await soundRef.current?.setPositionAsync(0);
  }

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current) {
      setPlaybackError('还没有可控制的音频，请先从列表选择内容。');
      return;
    }

    if (playbackState === 'playing') {
      await soundRef.current.pauseAsync();
      setPlaybackState('paused');
    } else {
      await soundRef.current.playAsync();
      setPlaybackState('playing');
    }
  }, [playbackState]);

  const toggleFavorite = useCallback((trackId: string) => {
    setFavoriteIds((current) => {
      const next = current.includes(trackId)
        ? current.filter((id) => id !== trackId)
        : [trackId, ...current];
      storage.setJson(storageKeys.favorites, next);
      return next;
    });
  }, []);

  const setPlaybackMode = useCallback((mode: PlaybackMode) => {
    playbackModeRef.current = mode;
    setPlaybackModeState(mode);
  }, []);

  const setSleepTimer = useCallback(
    (minutes: number | null) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (!minutes) {
        setTimerEndsAt(null);
        setRemainingSeconds(0);
        return;
      }

      const endsAt = Date.now() + minutes * 60 * 1000;
      setTimerEndsAt(endsAt);
      timerRef.current = setTimeout(() => {
        stop();
      }, minutes * 60 * 1000);
    },
    [stop],
  );

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      staysActiveInBackground: true,
    });

    storage.getJson(storageKeys.favorites, [] as string[]).then(setFavoriteIds);
    storage.getJson(storageKeys.history, [] as string[]).then(setHistoryIds);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      soundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (!timerEndsAt) {
      return undefined;
    }

    const interval = setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEndsAt]);

  const activeTimerMinutes = useMemo(() => {
    if (!timerEndsAt) {
      return null;
    }

    return Math.ceil((timerEndsAt - Date.now()) / 60000);
  }, [timerEndsAt, remainingSeconds]);

  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

  return {
    currentTrack,
    queue,
    currentIndex,
    playbackMode,
    playbackState,
    playbackError,
    positionMillis,
    durationMillis,
    progress,
    favoriteIds,
    historyIds,
    timerOptions,
    timerEndsAt,
    activeTimerMinutes,
    remainingSeconds,
    isFavorite: (trackId: string) => favoriteIds.includes(trackId),
    playTrack,
    playNext,
    playPrevious,
    togglePlayback,
    seekToMillis,
    toggleFavorite,
    setPlaybackMode,
    setSleepTimer,
    stop,
  };
};

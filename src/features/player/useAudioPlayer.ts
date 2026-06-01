import { Audio } from 'expo-av';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { storageKeys } from '../../shared/storage/keys';
import { storage } from '../../shared/storage/storage';
import type { AudioItem } from '../../shared/types/audio';

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused';

const timerOptions = [15, 30, 45, 60];

export const useAudioPlayer = () => {
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioItem | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [historyIds, setHistoryIds] = useState<string[]>([]);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const unloadCurrentSound = useCallback(async () => {
    if (soundRef.current) {
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

  const playTrack = useCallback(
    async (track: AudioItem) => {
      setPlaybackState('loading');
      setCurrentTrack(track);
      await addToHistory(track.id);
      await unloadCurrentSound();

      try {
        const { sound } = await Audio.Sound.createAsync(
          typeof track.asset === 'string' ? { uri: track.asset } : track.asset,
          {
            isLooping: track.type === 'noise',
            shouldPlay: false,
            volume: 0.85,
          },
        );

        soundRef.current = sound;
        await sound.playAsync();
        setPlaybackState('playing');
      } catch {
        setPlaybackState('paused');
      }
    },
    [addToHistory, unloadCurrentSound],
  );

  const togglePlayback = useCallback(async () => {
    if (!soundRef.current) {
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
      staysActiveInBackground: false,
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

  return {
    currentTrack,
    playbackState,
    favoriteIds,
    historyIds,
    timerOptions,
    timerEndsAt,
    activeTimerMinutes,
    remainingSeconds,
    isFavorite: (trackId: string) => favoriteIds.includes(trackId),
    playTrack,
    togglePlayback,
    toggleFavorite,
    setSleepTimer,
    stop,
  };
};

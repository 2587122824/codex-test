import { storageKeys } from '../../shared/storage/keys';
import { storage } from '../../shared/storage/storage';
import type { SleepLogEntry, UserSettings } from '../../shared/types/sleep';
import { supabase } from '../../shared/supabase/client';

export type LocalSyncSnapshot = {
  favoriteIds: string[];
  historyIds: string[];
  sleepLogs: SleepLogEntry[];
  settings: UserSettings;
};

export type RemoteSyncData = LocalSyncSnapshot & {
  syncedAt: string;
};

type DeletedEntity = {
  id: string;
  deletedAt: string;
};

type RemoteFavorite = {
  track_id: string;
  deleted_at: string | null;
};

type RemoteHistory = {
  track_id: string;
  last_played_at: string;
  deleted_at: string | null;
};

type RemoteSleepLog = {
  id: string;
  sleep_at: string;
  wake_at: string;
  duration_minutes: number;
  rating: SleepLogEntry['rating'];
  note: string | null;
  updated_at: string;
  deleted_at: string | null;
};

type RemoteSettings = {
  default_sleep_timer_minutes: number;
  updated_at: string;
};

const nowIso = () => new Date().toISOString();

const unique = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

const readDeleted = (key: string) => storage.getJson(key, [] as DeletedEntity[]);

const upsertChunk = async (table: string, rows: Record<string, unknown>[]) => {
  if (!supabase || rows.length === 0) {
    return;
  }

  const { error } = await supabase.from(table).upsert(rows);
  if (error) {
    throw error;
  }
};

export const markFavoriteDeleted = async (trackId: string) => {
  const deleted = await readDeleted(storageKeys.deletedFavorites);
  const next = [
    { id: trackId, deletedAt: nowIso() },
    ...deleted.filter((item) => item.id !== trackId),
  ];
  await storage.setJson(storageKeys.deletedFavorites, next);
};

export const clearFavoriteDeleted = async (trackId: string) => {
  const deleted = await readDeleted(storageKeys.deletedFavorites);
  await storage.setJson(
    storageKeys.deletedFavorites,
    deleted.filter((item) => item.id !== trackId),
  );
};

export const markSleepLogDeleted = async (logId: string) => {
  const deleted = await readDeleted(storageKeys.deletedSleepLogs);
  const next = [
    { id: logId, deletedAt: nowIso() },
    ...deleted.filter((item) => item.id !== logId),
  ];
  await storage.setJson(storageKeys.deletedSleepLogs, next);
};

export const syncUserData = async (userId: string, local: LocalSyncSnapshot): Promise<RemoteSyncData> => {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const [deletedFavorites, deletedSleepLogs] = await Promise.all([
    readDeleted(storageKeys.deletedFavorites),
    readDeleted(storageKeys.deletedSleepLogs),
  ]);
  const deletedFavoriteIds = new Set(deletedFavorites.map((item) => item.id));
  const deletedSleepLogIds = new Set(deletedSleepLogs.map((item) => item.id));

  const [settingsResult, favoritesResult, historyResult, sleepLogsResult] = await Promise.all([
    supabase.from('user_settings').select('default_sleep_timer_minutes, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('user_favorites').select('track_id, deleted_at').eq('user_id', userId),
    supabase
      .from('play_history')
      .select('track_id, last_played_at, deleted_at')
      .eq('user_id', userId)
      .order('last_played_at', { ascending: false }),
    supabase
      .from('sleep_logs')
      .select('id, sleep_at, wake_at, duration_minutes, rating, note, updated_at, deleted_at')
      .eq('user_id', userId),
  ]);

  const remoteSettings = settingsResult.data as RemoteSettings | null;
  const remoteFavorites = (favoritesResult.data ?? []) as RemoteFavorite[];
  const remoteHistory = (historyResult.data ?? []) as RemoteHistory[];
  const remoteSleepLogs = (sleepLogsResult.data ?? []) as RemoteSleepLog[];
  const queryError =
    settingsResult.error ?? favoritesResult.error ?? historyResult.error ?? sleepLogsResult.error;
  if (queryError) {
    throw queryError;
  }

  const activeRemoteFavoriteIds = remoteFavorites
    .filter((item) => !item.deleted_at && !deletedFavoriteIds.has(item.track_id))
    .map((item) => item.track_id);
  const favoriteIds = unique([
    ...local.favoriteIds.filter((id) => !deletedFavoriteIds.has(id)),
    ...activeRemoteFavoriteIds,
  ]);

  const remoteDeletedSleepLogIds = new Set(
    remoteSleepLogs.filter((item) => item.deleted_at).map((item) => item.id),
  );
  const localSleepLogs = local.sleepLogs.filter(
    (log) => !deletedSleepLogIds.has(log.id) && !remoteDeletedSleepLogIds.has(log.id),
  );
  const localSleepLogById = new Map(localSleepLogs.map((log) => [log.id, log]));
  const remoteActiveSleepLogs = remoteSleepLogs
    .filter((item) => !item.deleted_at && !deletedSleepLogIds.has(item.id))
    .map((item): SleepLogEntry => ({
      id: item.id,
      sleepAt: item.sleep_at,
      wakeAt: item.wake_at,
      durationMinutes: item.duration_minutes,
      rating: item.rating,
      note: item.note ?? undefined,
    }));
  const sleepLogById = new Map(remoteActiveSleepLogs.map((log) => [log.id, log]));
  localSleepLogById.forEach((log, id) => sleepLogById.set(id, log));
  const sleepLogs = Array.from(sleepLogById.values()).sort(
    (left, right) => new Date(right.wakeAt).getTime() - new Date(left.wakeAt).getTime(),
  );

  const remoteHistoryIds = remoteHistory
    .filter((item) => !item.deleted_at)
    .map((item) => item.track_id);
  const historyIds = unique([...local.historyIds, ...remoteHistoryIds]).slice(0, 12);

  const settings = remoteSettings
    ? {
        ...local.settings,
        defaultSleepTimerMinutes: remoteSettings.default_sleep_timer_minutes,
      }
    : local.settings;

  const syncedAt = nowIso();
  await Promise.all([
    upsertChunk(
      'user_favorites',
      favoriteIds.map((trackId) => ({
        user_id: userId,
        track_id: trackId,
        deleted_at: null,
        updated_at: syncedAt,
      })),
    ),
    upsertChunk(
      'user_favorites',
      deletedFavorites.map((item) => ({
        user_id: userId,
        track_id: item.id,
        deleted_at: item.deletedAt,
        updated_at: item.deletedAt,
      })),
    ),
    upsertChunk(
      'play_history',
      historyIds.map((trackId, index) => ({
        user_id: userId,
        track_id: trackId,
        last_played_at: new Date(Date.now() - index * 1000).toISOString(),
        play_count: 1,
        deleted_at: null,
        updated_at: syncedAt,
      })),
    ),
    upsertChunk(
      'sleep_logs',
      sleepLogs.map((log) => ({
        user_id: userId,
        id: log.id,
        sleep_at: log.sleepAt,
        wake_at: log.wakeAt,
        duration_minutes: log.durationMinutes,
        rating: log.rating,
        note: log.note ?? null,
        deleted_at: null,
        updated_at: syncedAt,
      })),
    ),
    upsertChunk(
      'sleep_logs',
      deletedSleepLogs.map((item) => ({
        user_id: userId,
        id: item.id,
        deleted_at: item.deletedAt,
        updated_at: item.deletedAt,
      })),
    ),
  ]);

  const settingsUpsert = await supabase.from('user_settings').upsert({
    user_id: userId,
    default_sleep_timer_minutes: settings.defaultSleepTimerMinutes,
    updated_at: syncedAt,
  });
  if (settingsUpsert.error) {
    throw settingsUpsert.error;
  }

  await Promise.all([
    storage.setJson(storageKeys.deletedFavorites, [] as DeletedEntity[]),
    storage.setJson(storageKeys.deletedSleepLogs, [] as DeletedEntity[]),
    storage.setJson(storageKeys.syncMeta, { lastSyncedAt: syncedAt }),
  ]);

  return {
    favoriteIds,
    historyIds,
    sleepLogs,
    settings,
    syncedAt,
  };
};

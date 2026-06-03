import { apiRequest } from '../../shared/api/client';
import { storageKeys } from '../../shared/storage/keys';
import { storage } from '../../shared/storage/storage';
import type { SleepLogEntry, UserSettings } from '../../shared/types/sleep';

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

type SyncResponse = {
  data: RemoteSyncData;
};

type SyncMeta = {
  lastSyncedAt?: string;
  settingsUpdatedAt?: string;
};

const nowIso = () => new Date().toISOString();
const epochIso = new Date(0).toISOString();

const readDeleted = (key: string) => storage.getJson(key, [] as DeletedEntity[]);
const readSyncMeta = () => storage.getJson<SyncMeta>(storageKeys.syncMeta, {});

export const markSettingsUpdated = async (updatedAt = nowIso()) => {
  const syncMeta = await readSyncMeta();
  await storage.setJson(storageKeys.syncMeta, { ...syncMeta, settingsUpdatedAt: updatedAt });
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

export const syncUserData = async (local: LocalSyncSnapshot): Promise<RemoteSyncData> => {
  const [deletedFavorites, deletedSleepLogs, syncMeta] = await Promise.all([
    readDeleted(storageKeys.deletedFavorites),
    readDeleted(storageKeys.deletedSleepLogs),
    readSyncMeta(),
  ]);
  const settingsUpdatedAt = syncMeta.settingsUpdatedAt || epochIso;

  const response = await apiRequest<SyncResponse>('/sync/merge', {
    method: 'POST',
    auth: true,
    body: {
      local,
      deletedFavorites,
      deletedSleepLogs,
      clientSyncedAt: settingsUpdatedAt,
    },
  });

  const nextSyncMeta = {
    ...syncMeta,
    lastSyncedAt: response.data.syncedAt,
    settingsUpdatedAt: response.data.syncedAt,
  };

  await Promise.all([
    storage.setJson(storageKeys.deletedFavorites, [] as DeletedEntity[]),
    storage.setJson(storageKeys.deletedSleepLogs, [] as DeletedEntity[]),
    storage.setJson(storageKeys.syncMeta, nextSyncMeta),
  ]);

  return response.data;
};

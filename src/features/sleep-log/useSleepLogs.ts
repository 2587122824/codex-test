import { useCallback, useEffect, useMemo, useState } from 'react';

import { storageKeys } from '../../shared/storage/keys';
import { storage } from '../../shared/storage/storage';
import type { SleepLogEntry } from '../../shared/types/sleep';
import { markSleepLogDeleted } from '../account/syncService';

const createEntityId = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  return randomUUID ? randomUUID.call(globalThis.crypto) : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const createDefaultLog = (): SleepLogEntry => {
  const wakeAt = new Date();
  const sleepAt = new Date(wakeAt.getTime() - 7.5 * 60 * 60 * 1000);

  return {
    id: createEntityId(),
    sleepAt: sleepAt.toISOString(),
    wakeAt: wakeAt.toISOString(),
    durationMinutes: 450,
    rating: 4,
    note: '睡前完成一次助眠播放',
  };
};

export const useSleepLogs = () => {
  const [logs, setLogs] = useState<SleepLogEntry[]>([]);

  useEffect(() => {
    storage.getJson(storageKeys.sleepLogs, [] as SleepLogEntry[]).then(setLogs);
  }, []);

  const persist = useCallback((next: SleepLogEntry[]) => {
    setLogs(next);
    storage.setJson(storageKeys.sleepLogs, next);
  }, []);

  const addQuickLog = useCallback(() => {
    persist([createDefaultLog(), ...logs]);
  }, [logs, persist]);

  const addLog = useCallback(
    (entry: SleepLogEntry) => {
      persist([entry, ...logs]);
    },
    [logs, persist],
  );

  const updateLog = useCallback(
    (entry: SleepLogEntry) => {
      persist(logs.map((log) => (log.id === entry.id ? entry : log)));
    },
    [logs, persist],
  );

  const removeLog = useCallback(
    (id: string) => {
      void markSleepLogDeleted(id);
      persist(logs.filter((log) => log.id !== id));
    },
    [logs, persist],
  );

  const replaceLogs = useCallback(
    (next: SleepLogEntry[]) => {
      persist(next);
    },
    [persist],
  );

  const averageMinutes = useMemo(() => {
    if (logs.length === 0) {
      return 0;
    }

    return Math.round(
      logs.reduce((total, log) => total + log.durationMinutes, 0) / logs.length,
    );
  }, [logs]);

  return {
    logs,
    averageMinutes,
    addQuickLog,
    addLog,
    updateLog,
    removeLog,
    replaceLogs,
  };
};

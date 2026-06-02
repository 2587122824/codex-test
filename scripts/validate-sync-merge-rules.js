const assert = require('assert/strict');

const uniqueLatestFirst = (items, keyOf) => {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = keyOf(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
};

const mergeFavorites = ({ localIds, remoteIds, deletedFavorites }) => {
  const active = new Set([...remoteIds, ...localIds]);

  for (const tombstone of deletedFavorites) {
    active.delete(tombstone.id);
  }

  return [...active].sort();
};

const mergeHistory = ({ localRows, remoteRows }) =>
  uniqueLatestFirst(
    [...localRows, ...remoteRows].sort((left, right) => right.playedAt.localeCompare(left.playedAt)),
    (row) => row.id,
  )
    .slice(0, 12)
    .map((row) => row.id);

const mergeSleepLogs = ({ localRows, remoteRows, deletedSleepLogs }) => {
  const byId = new Map();

  for (const row of [...remoteRows, ...localRows]) {
    const current = byId.get(row.id);
    if (!current || row.updatedAt > current.updatedAt) {
      byId.set(row.id, { kind: 'active', row, updatedAt: row.updatedAt });
    }
  }

  for (const tombstone of deletedSleepLogs) {
    const current = byId.get(tombstone.id);
    if (!current || tombstone.deletedAt >= current.updatedAt) {
      byId.set(tombstone.id, {
        kind: 'deleted',
        id: tombstone.id,
        updatedAt: tombstone.deletedAt,
      });
    }
  }

  return [...byId.values()]
    .filter((entry) => entry.kind === 'active')
    .map((entry) => entry.row.log)
    .sort((left, right) => right.sleepAt.localeCompare(left.sleepAt));
};

const mergeSettings = ({ local, remote }) => (local.updatedAt >= remote.updatedAt ? local.value : remote.value);

const run = () => {
  assert.deepEqual(
    mergeFavorites({
      localIds: ['rain-window', 'ocean-waves'],
      remoteIds: ['forest-night', 'rain-window'],
      deletedFavorites: [{ id: 'ocean-waves', deletedAt: '2026-06-02T08:00:00.000Z' }],
    }),
    ['forest-night', 'rain-window'],
    'favorites should union local and remote IDs, then apply tombstones',
  );

  const remoteHistory = Array.from({ length: 11 }, (_, index) => ({
    id: `remote-${index}`,
    playedAt: `2026-06-02T07:${String(index).padStart(2, '0')}:00.000Z`,
  }));

  assert.deepEqual(
    mergeHistory({
      localRows: [
        { id: 'rain-window', playedAt: '2026-06-02T09:00:00.000Z' },
        { id: 'remote-9', playedAt: '2026-06-02T09:30:00.000Z' },
      ],
      remoteRows: remoteHistory,
    }),
    ['remote-9', 'rain-window', 'remote-10', 'remote-8', 'remote-7', 'remote-6', 'remote-5', 'remote-4', 'remote-3', 'remote-2', 'remote-1', 'remote-0'],
    'history should be latest-first, unique by track ID, and capped at 12',
  );

  assert.deepEqual(
    mergeSleepLogs({
      localRows: [
        {
          id: 'log-newer-local',
          updatedAt: '2026-06-02T10:00:00.000Z',
          log: {
            id: 'log-newer-local',
            sleepAt: '2026-06-01T23:00:00.000Z',
            wakeAt: '2026-06-02T07:00:00.000Z',
            durationMinutes: 480,
            rating: 4,
          },
        },
        {
          id: 'log-deleted',
          updatedAt: '2026-06-02T08:00:00.000Z',
          log: {
            id: 'log-deleted',
            sleepAt: '2026-05-31T23:00:00.000Z',
            wakeAt: '2026-06-01T06:30:00.000Z',
            durationMinutes: 450,
            rating: 3,
          },
        },
      ],
      remoteRows: [
        {
          id: 'log-newer-local',
          updatedAt: '2026-06-02T09:00:00.000Z',
          log: {
            id: 'log-newer-local',
            sleepAt: '2026-06-01T23:30:00.000Z',
            wakeAt: '2026-06-02T07:00:00.000Z',
            durationMinutes: 450,
            rating: 2,
          },
        },
        {
          id: 'log-remote-only',
          updatedAt: '2026-06-02T07:30:00.000Z',
          log: {
            id: 'log-remote-only',
            sleepAt: '2026-05-30T23:30:00.000Z',
            wakeAt: '2026-05-31T07:00:00.000Z',
            durationMinutes: 450,
            rating: 5,
          },
        },
      ],
      deletedSleepLogs: [{ id: 'log-deleted', deletedAt: '2026-06-02T08:30:00.000Z' }],
    }).map((log) => log.id),
    ['log-newer-local', 'log-remote-only'],
    'sleep logs should keep newest active rows and let newer tombstones win',
  );

  assert.deepEqual(
    mergeSettings({
      local: {
        updatedAt: '2026-06-02T08:00:00.000Z',
        value: { defaultSleepTimerMinutes: 30 },
      },
      remote: {
        updatedAt: '2026-06-02T09:00:00.000Z',
        value: { defaultSleepTimerMinutes: 45 },
      },
    }),
    { defaultSleepTimerMinutes: 45 },
    'settings should use the newest updatedAt value after first sign-in',
  );
};

run();

console.log('Sync merge rule validation passed: favorites, history, sleep logs, and settings.');

const http = require('http');
const { randomUUID } = require('crypto');

const port = Number(process.env.MOCK_API_PORT || process.env.PORT || 8787);
const mockOtp = '123456';
const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;

const usersByPhone = new Map();
const sessionsByAccessToken = new Map();
const syncStoreByUserId = new Map();

const defaultSettings = { defaultSleepTimerMinutes: 30 };

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const createEmptySyncData = () => ({
  favoriteIds: [],
  historyIds: [],
  sleepLogs: [],
  settings: defaultSettings,
  syncedAt: new Date(0).toISOString(),
});

const createEmptySyncStore = () => ({
  data: createEmptySyncData(),
  sleepLogUpdatedAtById: {},
  settingsUpdatedAt: new Date(0).toISOString(),
});

const sendJson = (response, statusCode, body) => {
  response.writeHead(statusCode, jsonHeaders);
  response.end(JSON.stringify(body));
};

const sendNoContent = (response) => {
  response.writeHead(204, jsonHeaders);
  response.end();
};

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });

    request.on('end', () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });

    request.on('error', reject);
  });

const createSession = (user) => {
  const expiresAt = new Date(Date.now() + sessionTtlMs).toISOString();
  const accessToken = `mock-access-${randomUUID()}`;
  const refreshToken = `mock-refresh-${randomUUID()}`;
  const session = { user, accessToken, refreshToken, expiresAt };
  sessionsByAccessToken.set(accessToken, session);
  return session;
};

const getBearerToken = (request) => {
  const authorization = request.headers.authorization || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const getSession = (request) => {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const session = sessionsByAccessToken.get(token);
  if (!session || (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now())) {
    sessionsByAccessToken.delete(token);
    return null;
  }

  return session;
};

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

const normalizeDeleted = (value) =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => ({
          id: item.id,
          deletedAt: typeof item.deletedAt === 'string' ? item.deletedAt : new Date().toISOString(),
        }))
    : [];

const uniqueLatestFirst = (ids) => {
  const seen = new Set();
  const result = [];

  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }

  return result;
};

const isIsoAfterOrEqual = (left, right) => new Date(left).getTime() >= new Date(right).getTime();

const getClientSyncedAt = (body) =>
  typeof body.clientSyncedAt === 'string' ? body.clientSyncedAt : new Date().toISOString();

const mergeSyncStore = (store, body) => {
  const remote = store.data;
  const local = body.local && typeof body.local === 'object' ? body.local : {};
  const localUpdatedAt = getClientSyncedAt(body);
  const deletedFavorites = normalizeDeleted(body.deletedFavorites);
  const deletedSleepLogs = normalizeDeleted(body.deletedSleepLogs);
  const deletedFavoriteIds = new Set(deletedFavorites.map((item) => item.id));

  const favoriteSet = new Set([
    ...normalizeStringArray(remote.favoriteIds),
    ...normalizeStringArray(local.favoriteIds),
  ]);
  for (const id of deletedFavoriteIds) {
    favoriteSet.delete(id);
  }

  const remoteHistoryIds = normalizeStringArray(remote.historyIds);
  const localHistoryIds = normalizeStringArray(local.historyIds);
  const historyIds = uniqueLatestFirst([...localHistoryIds, ...remoteHistoryIds]).slice(0, 12);

  const localSleepLogs = Array.isArray(local.sleepLogs) ? local.sleepLogs : [];
  const remoteSleepLogs = Array.isArray(remote.sleepLogs) ? remote.sleepLogs : [];
  const sleepLogsById = new Map();

  for (const log of remoteSleepLogs) {
    if (log && typeof log.id === 'string') {
      sleepLogsById.set(log.id, {
        kind: 'active',
        log,
        updatedAt: store.sleepLogUpdatedAtById[log.id] || remote.syncedAt,
      });
    }
  }

  for (const log of localSleepLogs) {
    if (!log || typeof log.id !== 'string') {
      continue;
    }

    const current = sleepLogsById.get(log.id);
    if (!current || isIsoAfterOrEqual(localUpdatedAt, current.updatedAt)) {
      sleepLogsById.set(log.id, {
        kind: 'active',
        log,
        updatedAt: localUpdatedAt,
      });
    }
  }

  for (const tombstone of deletedSleepLogs) {
    const current = sleepLogsById.get(tombstone.id);
    if (!current || isIsoAfterOrEqual(tombstone.deletedAt, current.updatedAt)) {
      sleepLogsById.set(tombstone.id, {
        kind: 'deleted',
        updatedAt: tombstone.deletedAt,
      });
    }
  }

  const activeSleepLogEntries = [...sleepLogsById.entries()].filter(([, entry]) => entry.kind === 'active');
  const nextSleepLogUpdatedAtById = Object.fromEntries(
    activeSleepLogEntries.map(([id, entry]) => [id, entry.updatedAt]),
  );

  const shouldUseLocalSettings =
    local.settings && typeof local.settings === 'object' && isIsoAfterOrEqual(localUpdatedAt, store.settingsUpdatedAt);

  const data = {
    favoriteIds: [...favoriteSet],
    historyIds,
    sleepLogs: activeSleepLogEntries.map(([, entry]) => entry.log),
    settings: shouldUseLocalSettings ? local.settings : remote.settings || defaultSettings,
    syncedAt: new Date().toISOString(),
  };

  return {
    data,
    sleepLogUpdatedAtById: nextSleepLogUpdatedAtById,
    settingsUpdatedAt: shouldUseLocalSettings ? localUpdatedAt : store.settingsUpdatedAt,
  };
};

const routeRequest = async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'OPTIONS') {
    sendNoContent(response);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/auth/send-code') {
    const body = await readBody(request);
    if (!body.phone || typeof body.phone !== 'string') {
      sendJson(response, 400, { message: 'Phone is required.' });
      return;
    }

    console.log(`[mock-api] OTP for ${body.phone}: ${mockOtp}`);
    sendJson(response, 200, { requestId: `mock-sms-${randomUUID()}` });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/auth/verify-code') {
    const body = await readBody(request);
    if (!body.phone || typeof body.phone !== 'string') {
      sendJson(response, 400, { message: 'Phone is required.' });
      return;
    }

    if (body.code !== mockOtp) {
      sendJson(response, 401, { message: 'Invalid verification code. Use 123456 for the mock API.' });
      return;
    }

    let user = usersByPhone.get(body.phone);
    if (!user) {
      user = { id: randomUUID(), phone: body.phone };
      usersByPhone.set(body.phone, user);
      syncStoreByUserId.set(user.id, createEmptySyncStore());
    }

    sendJson(response, 200, { session: createSession(user) });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/auth/session') {
    const session = getSession(request);
    if (!session) {
      sendJson(response, 401, { message: 'Please sign in before syncing.' });
      return;
    }

    sendJson(response, 200, { session });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/auth/logout') {
    const token = getBearerToken(request);
    if (token) {
      sessionsByAccessToken.delete(token);
    }

    sendNoContent(response);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/sync/merge') {
    const session = getSession(request);
    if (!session) {
      sendJson(response, 401, { message: 'Please sign in before syncing.' });
      return;
    }

    const body = await readBody(request);
    const store = syncStoreByUserId.get(session.user.id) || createEmptySyncStore();
    const nextStore = mergeSyncStore(store, body);
    syncStoreByUserId.set(session.user.id, nextStore);
    const merged = nextStore.data;
    sendJson(response, 200, { data: merged });
    return;
  }

  sendJson(response, 404, { message: `No mock route for ${request.method} ${url.pathname}.` });
};

const server = http.createServer((request, response) => {
  routeRequest(request, response).catch((error) => {
    console.error('[mock-api] Request failed:', error);
    sendJson(response, 500, { message: error.message || 'Mock API request failed.' });
  });
});

server.listen(port, () => {
  console.log(`[mock-api] Codex Sleep mock Aliyun API listening on http://localhost:${port}`);
  console.log(`[mock-api] Fixed phone verification code: ${mockOtp}`);
  console.log('[mock-api] Data is in-memory only and resets when this process exits.');
});

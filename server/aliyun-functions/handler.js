const crypto = require('crypto');

const defaultSettings = { defaultSleepTimerMinutes: 0, themeMode: 'system' };
const defaultSessionTtlSeconds = Number(process.env.SESSION_TTL_SECONDS || 7 * 24 * 60 * 60);
const defaultSmsCodeTtlSeconds = Number(process.env.SMS_CODE_TTL_SECONDS || 300);
const defaultSmsCooldownSeconds = Number(process.env.SMS_SEND_COOLDOWN_SECONDS || 60);
const defaultSmsHourlyLimit = Number(process.env.SMS_SEND_HOURLY_LIMIT || 5);
const isProduction = process.env.NODE_ENV === 'production';

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

const nowIso = () => new Date().toISOString();
const addSecondsIso = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();

const randomToken = (prefix) => `${prefix}-${crypto.randomBytes(32).toString('base64url')}`;

const hashValue = (value) =>
  crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'codex-sleep-local-dev-secret')
    .update(String(value))
    .digest('hex');

const normalizePhone = (phone) => {
  if (typeof phone !== 'string') {
    return null;
  }

  const normalized = phone.replace(/[\s-]/g, '');
  return /^\+\d{8,15}$/.test(normalized) ? normalized : null;
};

const isIsoAfterOrEqual = (left, right) => new Date(left).getTime() >= new Date(right).getTime();

const normalizeStringArray = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];

const normalizeDeleted = (value) =>
  Array.isArray(value)
    ? value
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => ({
          id: item.id,
          deletedAt: typeof item.deletedAt === 'string' ? item.deletedAt : nowIso(),
        }))
    : [];

const normalizeSettings = (settings) => {
  const themeMode =
    settings && ['system', 'dark', 'light'].includes(settings.themeMode) ? settings.themeMode : defaultSettings.themeMode;
  return {
    defaultSleepTimerMinutes: 0,
    themeMode,
  };
};

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

const createEmptySyncStore = () => ({
  favoriteIds: [],
  historyIds: [],
  sleepLogs: [],
  sleepLogUpdatedAtById: {},
  settings: defaultSettings,
  settingsUpdatedAt: new Date(0).toISOString(),
  syncedAt: new Date(0).toISOString(),
});

const mergeSyncStore = (store, body) => {
  const local = body.local && typeof body.local === 'object' ? body.local : {};
  const localUpdatedAt = typeof body.clientSyncedAt === 'string' ? body.clientSyncedAt : nowIso();
  const deletedFavorites = normalizeDeleted(body.deletedFavorites);
  const deletedSleepLogs = normalizeDeleted(body.deletedSleepLogs);
  const deletedFavoriteIds = new Set(deletedFavorites.map((item) => item.id));

  const favoriteSet = new Set([...normalizeStringArray(store.favoriteIds), ...normalizeStringArray(local.favoriteIds)]);
  for (const id of deletedFavoriteIds) {
    favoriteSet.delete(id);
  }

  const historyIds = uniqueLatestFirst([
    ...normalizeStringArray(local.historyIds),
    ...normalizeStringArray(store.historyIds),
  ]).slice(0, 12);

  const sleepLogsById = new Map();
  for (const log of Array.isArray(store.sleepLogs) ? store.sleepLogs : []) {
    if (log && typeof log.id === 'string') {
      sleepLogsById.set(log.id, {
        kind: 'active',
        log,
        updatedAt: store.sleepLogUpdatedAtById[log.id] || store.syncedAt,
      });
    }
  }

  for (const log of Array.isArray(local.sleepLogs) ? local.sleepLogs : []) {
    if (!log || typeof log.id !== 'string') {
      continue;
    }
    const current = sleepLogsById.get(log.id);
    if (!current || isIsoAfterOrEqual(localUpdatedAt, current.updatedAt)) {
      sleepLogsById.set(log.id, { kind: 'active', log, updatedAt: localUpdatedAt });
    }
  }

  for (const tombstone of deletedSleepLogs) {
    const current = sleepLogsById.get(tombstone.id);
    if (!current || isIsoAfterOrEqual(tombstone.deletedAt, current.updatedAt)) {
      sleepLogsById.set(tombstone.id, { kind: 'deleted', updatedAt: tombstone.deletedAt });
    }
  }

  const activeSleepLogEntries = [...sleepLogsById.entries()].filter(([, entry]) => entry.kind === 'active');
  const shouldUseLocalSettings =
    local.settings &&
    typeof local.settings === 'object' &&
    isIsoAfterOrEqual(localUpdatedAt, store.settingsUpdatedAt || new Date(0).toISOString());
  const syncedAt = nowIso();

  return {
    favoriteIds: [...favoriteSet],
    historyIds,
    sleepLogs: activeSleepLogEntries.map(([, entry]) => entry.log),
    sleepLogUpdatedAtById: Object.fromEntries(activeSleepLogEntries.map(([id, entry]) => [id, entry.updatedAt])),
    settings: shouldUseLocalSettings ? normalizeSettings(local.settings) : normalizeSettings(store.settings),
    settingsUpdatedAt: shouldUseLocalSettings ? localUpdatedAt : store.settingsUpdatedAt,
    syncedAt,
  };
};

const createMemoryAdapter = () => {
  const usersByPhone = new Map();
  const sessionsByAccessTokenHash = new Map();
  const smsCodesByPhone = new Map();
  const syncStoresByUserId = new Map();

  return {
    async countRecentSmsCodes(phone, sinceIso) {
      return (smsCodesByPhone.get(phone) || []).filter((code) => code.createdAt >= sinceIso).length;
    },
    async latestSmsCode(phone) {
      return (smsCodesByPhone.get(phone) || [])[0] || null;
    },
    async saveSmsCode({ phone, codeHash, requestId, expiresAt, createdAt }) {
      const rows = smsCodesByPhone.get(phone) || [];
      smsCodesByPhone.set(phone, [{ phone, codeHash, requestId, expiresAt, createdAt, consumedAt: null }, ...rows]);
    },
    async consumeSmsCode(phone, codeHash) {
      const row = (smsCodesByPhone.get(phone) || []).find(
        (code) => !code.consumedAt && code.codeHash === codeHash && new Date(code.expiresAt).getTime() > Date.now(),
      );
      if (!row) {
        return false;
      }
      row.consumedAt = nowIso();
      return true;
    },
    async upsertUserByPhone(phone) {
      const existing = usersByPhone.get(phone);
      if (existing) {
        return existing;
      }
      const user = { id: crypto.randomUUID(), phone };
      usersByPhone.set(phone, user);
      syncStoresByUserId.set(user.id, createEmptySyncStore());
      return user;
    },
    async saveSession(session) {
      sessionsByAccessTokenHash.set(session.accessTokenHash, session);
    },
    async findSession(accessTokenHash) {
      const session = sessionsByAccessTokenHash.get(accessTokenHash);
      if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= Date.now()) {
        return null;
      }
      return session;
    },
    async findSessionByRefreshToken(refreshTokenHash) {
      const session = [...sessionsByAccessTokenHash.values()].find(
        (item) =>
          item.refreshTokenHash === refreshTokenHash &&
          !item.revokedAt &&
          new Date(item.expiresAt).getTime() > Date.now(),
      );
      return session || null;
    },
    async revokeSession(accessTokenHash) {
      const session = sessionsByAccessTokenHash.get(accessTokenHash);
      if (session) {
        session.revokedAt = nowIso();
      }
    },
    async mergeSync(userId, body) {
      const current = syncStoresByUserId.get(userId) || createEmptySyncStore();
      const next = mergeSyncStore(current, body);
      syncStoresByUserId.set(userId, next);
      return {
        favoriteIds: next.favoriteIds,
        historyIds: next.historyIds,
        sleepLogs: next.sleepLogs,
        settings: next.settings,
        syncedAt: next.syncedAt,
      };
    },
  };
};

const createMockSmsAdapter = () => ({
  async sendCode({ phone, code }) {
    if (!isProduction) {
      console.log(`[aliyun-functions] verification code for ${phone}: ${code}`);
    }
    return { requestId: `local-sms-${crypto.randomUUID()}` };
  },
});

const getBearerToken = (headers) => {
  const authorization = headers.authorization || headers.Authorization || '';
  const match = String(authorization).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
};

const parseBody = (event) => {
  if (!event.body) {
    return {};
  }

  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  return JSON.parse(raw);
};

const normalizeEvent = (event) => {
  if (Buffer.isBuffer(event)) {
    return normalizeEvent(event.toString('utf8'));
  }

  if (typeof event === 'string') {
    try {
      return JSON.parse(event);
    } catch {
      return {};
    }
  }

  return event && typeof event === 'object' ? event : {};
};

const response = (statusCode, body) => ({
  statusCode,
  headers: jsonHeaders,
  body: body === undefined ? '' : JSON.stringify(body),
});

const noContent = () => ({
  statusCode: 204,
  headers: jsonHeaders,
  body: '',
});

const errorResponse = (statusCode, message, code) => response(statusCode, { message, code });

const createSessionPayload = async (adapter, user) => {
  const accessToken = randomToken('access');
  const refreshToken = randomToken('refresh');
  const expiresAt = addSecondsIso(defaultSessionTtlSeconds);
  const session = {
    user,
    accessTokenHash: hashValue(accessToken),
    refreshTokenHash: hashValue(refreshToken),
    expiresAt,
    revokedAt: null,
    createdAt: nowIso(),
  };
  await adapter.saveSession(session);
  return { user, accessToken, refreshToken, expiresAt };
};

const requireSession = async (adapter, headers) => {
  const token = getBearerToken(headers);
  if (!token) {
    return null;
  }
  const session = await adapter.findSession(hashValue(token));
  return session ? { ...session, accessToken: token } : null;
};

const createApp = ({ adapter = createMemoryAdapter(), sms = createMockSmsAdapter() } = {}) => {
  const sendCode = async (body) => {
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return errorResponse(400, 'Phone is required.', 'PHONE_REQUIRED');
    }

    const latest = await adapter.latestSmsCode(phone);
    if (latest && Date.now() - new Date(latest.createdAt).getTime() < defaultSmsCooldownSeconds * 1000) {
      return errorResponse(429, 'Please wait before requesting another code.', 'SMS_COOLDOWN');
    }

    const hourlyCount = await adapter.countRecentSmsCodes(phone, new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if (hourlyCount >= defaultSmsHourlyLimit) {
      return errorResponse(429, 'Too many verification codes requested.', 'SMS_HOURLY_LIMIT');
    }

    const fixedCode =
      process.env.SMS_PROVIDER === 'local' ? process.env.LOCAL_SMS_FIXED_CODE : !isProduction && process.env.LOCAL_SMS_FIXED_CODE;
    const code = fixedCode || String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const { requestId } = await sms.sendCode({ phone, code });
    await adapter.saveSmsCode({
      phone,
      codeHash: hashValue(code),
      requestId,
      expiresAt: addSecondsIso(defaultSmsCodeTtlSeconds),
      createdAt: nowIso(),
    });
    return response(200, { requestId });
  };

  const verifyCode = async (body) => {
    const phone = normalizePhone(body.phone);
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!phone) {
      return errorResponse(400, 'Phone is required.', 'PHONE_REQUIRED');
    }
    if (!/^\d{6}$/.test(code)) {
      return errorResponse(400, 'Verification code is required.', 'CODE_REQUIRED');
    }

    const consumed = await adapter.consumeSmsCode(phone, hashValue(code));
    if (!consumed) {
      return errorResponse(401, 'Invalid or expired verification code.', 'INVALID_CODE');
    }

    const user = await adapter.upsertUserByPhone(phone);
    const session = await createSessionPayload(adapter, user);
    return response(200, { session });
  };

  const refreshSession = async (body) => {
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';
    if (!refreshToken) {
      return errorResponse(400, 'Refresh token is required.', 'REFRESH_TOKEN_REQUIRED');
    }

    const currentSession = await adapter.findSessionByRefreshToken(hashValue(refreshToken));
    if (!currentSession) {
      return errorResponse(401, 'Please sign in again.', 'INVALID_REFRESH_TOKEN');
    }

    await adapter.revokeSession(currentSession.accessTokenHash);
    const nextSession = await createSessionPayload(adapter, currentSession.user);
    return response(200, { session: nextSession });
  };

  const getSession = async (headers) => {
    const session = await requireSession(adapter, headers);
    if (!session) {
      return errorResponse(401, 'Please sign in before syncing.', 'AUTH_REQUIRED');
    }
    return response(200, {
      session: {
        user: session.user,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
      },
    });
  };

  const logout = async (headers) => {
    const token = getBearerToken(headers);
    if (token) {
      await adapter.revokeSession(hashValue(token));
    }
    return noContent();
  };

  const syncMerge = async (headers, body) => {
    const session = await requireSession(adapter, headers);
    if (!session) {
      return errorResponse(401, 'Please sign in before syncing.', 'AUTH_REQUIRED');
    }
    const data = await adapter.mergeSync(session.user.id, body);
    return response(200, { data });
  };

  const handle = async (rawEvent = {}) => {
    const event = normalizeEvent(rawEvent);
    const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
    const path = event.path || event.rawPath || event.requestContext?.http?.path || '/';
    const headers = event.headers || {};

    if (method === 'OPTIONS') {
      return noContent();
    }

    let body = {};
    try {
      body = parseBody(event);
    } catch {
      return errorResponse(400, 'Request body must be valid JSON.', 'INVALID_JSON');
    }

    if (method === 'POST' && path === '/auth/send-code') {
      return sendCode(body);
    }
    if (method === 'POST' && path === '/auth/verify-code') {
      return verifyCode(body);
    }
    if (method === 'POST' && path === '/auth/refresh') {
      return refreshSession(body);
    }
    if (method === 'GET' && path === '/auth/session') {
      return getSession(headers);
    }
    if (method === 'POST' && path === '/auth/logout') {
      return logout(headers);
    }
    if (method === 'POST' && path === '/sync/merge') {
      return syncMerge(headers, body);
    }

    return errorResponse(404, `No route for ${method} ${path}.`, 'NOT_FOUND');
  };

  return { handle };
};

const defaultApp = createApp();

exports.createApp = createApp;
exports.createMemoryAdapter = createMemoryAdapter;
exports.handler = (event) => defaultApp.handle(event);

const assert = require('assert/strict');

const baseUrl = (process.env.ALIYUN_FUNCTION_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
const phone = process.env.ALIYUN_SMOKE_PHONE || '';
const code = process.env.ALIYUN_SMOKE_CODE || '';

const request = async (path, { method = 'GET', body, token } = {}) => {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, ok: response.ok, data };
};

const requireEnv = () => {
  const missing = [];
  if (!baseUrl) {
    missing.push('ALIYUN_FUNCTION_BASE_URL or EXPO_PUBLIC_API_BASE_URL');
  }
  if (!phone) {
    missing.push('ALIYUN_SMOKE_PHONE');
  }
  if (missing.length > 0) {
    throw new Error(`Missing required smoke environment: ${missing.join(', ')}`);
  }
};

const run = async () => {
  requireEnv();

  const send = await request('/auth/send-code', {
    method: 'POST',
    body: { phone },
  });
  assert.equal(send.status, 200, `send-code failed: ${JSON.stringify(send.data)}`);
  assert.ok(send.data.requestId, 'send-code should return requestId');
  console.log(`Cloud send-code passed: requestId=${send.data.requestId}`);

  if (!code) {
    console.log('Set ALIYUN_SMOKE_CODE to continue verify/session/sync/logout after receiving the SMS code.');
    return;
  }

  const verify = await request('/auth/verify-code', {
    method: 'POST',
    body: { phone, code },
  });
  assert.equal(verify.status, 200, `verify-code failed: ${JSON.stringify(verify.data)}`);
  assert.equal(verify.data.session.user.phone, phone);
  assert.ok(verify.data.session.accessToken, 'verify-code should return accessToken');
  assert.ok(verify.data.session.refreshToken, 'verify-code should return refreshToken');
  const token = verify.data.session.accessToken;
  console.log(`Cloud verify-code passed: userId=${verify.data.session.user.id}`);

  const session = await request('/auth/session', { token });
  assert.equal(session.status, 200, `session failed: ${JSON.stringify(session.data)}`);
  assert.equal(session.data.session.user.phone, phone);
  console.log('Cloud session passed.');

  const refresh = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: verify.data.session.refreshToken },
  });
  assert.equal(refresh.status, 200, `refresh failed: ${JSON.stringify(refresh.data)}`);
  assert.equal(refresh.data.session.user.phone, phone);
  assert.ok(refresh.data.session.accessToken, 'refresh should return accessToken');
  assert.ok(refresh.data.session.refreshToken, 'refresh should return refreshToken');
  assert.notEqual(refresh.data.session.accessToken, token, 'refresh should rotate accessToken');
  assert.notEqual(
    refresh.data.session.refreshToken,
    verify.data.session.refreshToken,
    'refresh should rotate refreshToken',
  );
  console.log('Cloud refresh passed.');

  const oldSession = await request('/auth/session', { token });
  assert.equal(oldSession.status, 401, 'old access token should return 401 after refresh');
  const activeToken = refresh.data.session.accessToken;

  const sync = await request('/sync/merge', {
    method: 'POST',
    token: activeToken,
    body: {
      local: {
        favoriteIds: ['rain-window'],
        historyIds: ['rain-window', 'forest-night'],
        sleepLogs: [
          {
            id: `cloud-smoke-${Date.now()}`,
            sleepAt: '2026-06-02T00:00:00.000Z',
            wakeAt: '2026-06-02T07:00:00.000Z',
            durationMinutes: 420,
            rating: 4,
          },
        ],
        settings: { defaultSleepTimerMinutes: 0, themeMode: 'light' },
      },
      deletedFavorites: [],
      deletedSleepLogs: [],
      clientSyncedAt: new Date().toISOString(),
    },
  });
  assert.equal(sync.status, 200, `sync failed: ${JSON.stringify(sync.data)}`);
  assert.ok(sync.data.data.favoriteIds.includes('rain-window'));
  assert.equal(sync.data.data.settings.themeMode, 'light');
  assert.ok(sync.data.data.syncedAt, 'sync should return syncedAt');
  console.log(`Cloud sync passed: syncedAt=${sync.data.data.syncedAt}`);

  const logout = await request('/auth/logout', { method: 'POST', token: activeToken });
  assert.equal(logout.status, 204, `logout failed: ${JSON.stringify(logout.data)}`);
  console.log('Cloud logout passed.');

  const afterLogout = await request('/auth/session', { token: activeToken });
  assert.equal(afterLogout.status, 401, 'session should return 401 after logout');
  console.log('Cloud post-logout 401 passed.');
};

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

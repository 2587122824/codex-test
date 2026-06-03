const assert = require('assert/strict');

process.env.LOCAL_SMS_FIXED_CODE = '123456';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'codex-sleep-smoke-secret';

const { createApp } = require('../server/aliyun-functions/handler');

const app = createApp();

const invoke = async ({ method, path, body, token }) => {
  const response = await app.handle({
    httpMethod: method,
    path,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null,
  };
};

const run = async () => {
  const phone = '+8613800000000';

  const send = await invoke({
    method: 'POST',
    path: '/auth/send-code',
    body: { phone },
  });
  assert.equal(send.statusCode, 200);
  assert.match(send.json.requestId, /^local-sms-/);

  const verify = await invoke({
    method: 'POST',
    path: '/auth/verify-code',
    body: { phone, code: '123456' },
  });
  assert.equal(verify.statusCode, 200);
  assert.equal(verify.json.session.user.phone, phone);
  assert.ok(verify.json.session.accessToken);
  assert.ok(verify.json.session.refreshToken);

  const token = verify.json.session.accessToken;
  const session = await invoke({ method: 'GET', path: '/auth/session', token });
  assert.equal(session.statusCode, 200);
  assert.equal(session.json.session.user.phone, phone);

  const httpV2Session = await app.handle({
    requestContext: { http: { method: 'GET', path: '/auth/session' } },
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(httpV2Session.statusCode, 200);

  const sync = await invoke({
    method: 'POST',
    path: '/sync/merge',
    token,
    body: {
      local: {
        favoriteIds: ['rain-window'],
        historyIds: ['rain-window'],
        sleepLogs: [
          {
            id: 'client-fallback-id-1',
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
      clientSyncedAt: '2026-06-03T08:00:00.000Z',
    },
  });
  assert.equal(sync.statusCode, 200);
  assert.deepEqual(sync.json.data.favoriteIds, ['rain-window']);
  assert.deepEqual(sync.json.data.historyIds, ['rain-window']);
  assert.equal(sync.json.data.sleepLogs[0].id, 'client-fallback-id-1');
  assert.equal(sync.json.data.settings.themeMode, 'light');
  assert.equal(sync.json.data.settings.defaultSleepTimerMinutes, 0);

  const logout = await invoke({ method: 'POST', path: '/auth/logout', token });
  assert.equal(logout.statusCode, 204);

  const afterLogout = await invoke({ method: 'GET', path: '/auth/session', token });
  assert.equal(afterLogout.statusCode, 401);
};

run()
  .then(() => {
    console.log('Aliyun Function handler smoke passed: auth, session, sync, logout.');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

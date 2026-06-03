const defaultSettings = { defaultSleepTimerMinutes: 0, themeMode: 'system' };

const nowIso = () => new Date().toISOString();

const normalizeSettings = (settings) => ({
  defaultSleepTimerMinutes: 0,
  themeMode: settings && ['system', 'dark', 'light'].includes(settings.themeMode) ? settings.themeMode : 'system',
});

const tryLoadPg = () => {
  try {
    return require('pg');
  } catch (error) {
    throw new Error('PostgreSQL adapter requires the `pg` package in the Function Compute deployment bundle.');
  }
};

const createPoolFromEnv = () => {
  const { Pool } = tryLoadPg();
  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
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

const readSyncSnapshot = async (client, userId) => {
  const [favorites, history, sleepLogs, settings] = await Promise.all([
    client.query(
      `select track_id from user_favorites
       where user_id = $1 and deleted_at is null
       order by updated_at desc`,
      [userId],
    ),
    client.query(
      `select track_id from play_history
       where user_id = $1 and deleted_at is null
       order by last_played_at desc
       limit 12`,
      [userId],
    ),
    client.query(
      `select id, sleep_at, wake_at, duration_minutes, rating, note
       from sleep_logs
       where user_id = $1 and deleted_at is null
       order by coalesce(wake_at, sleep_at) desc nulls last`,
      [userId],
    ),
    client.query(
      `select default_sleep_timer_minutes, theme_mode
       from user_settings
       where user_id = $1 and deleted_at is null`,
      [userId],
    ),
  ]);

  return {
    favoriteIds: favorites.rows.map((row) => row.track_id),
    historyIds: history.rows.map((row) => row.track_id),
    sleepLogs: sleepLogs.rows.map((row) => ({
      id: row.id,
      sleepAt: row.sleep_at ? new Date(row.sleep_at).toISOString() : '',
      wakeAt: row.wake_at ? new Date(row.wake_at).toISOString() : '',
      durationMinutes: row.duration_minutes || 0,
      rating: row.rating || 3,
      note: row.note || undefined,
    })),
    settings:
      settings.rows.length > 0
        ? {
            defaultSleepTimerMinutes: settings.rows[0].default_sleep_timer_minutes,
            themeMode: settings.rows[0].theme_mode,
          }
        : defaultSettings,
    syncedAt: nowIso(),
  };
};

const createPostgresAdapter = ({ pool = createPoolFromEnv() } = {}) => ({
  async countRecentSmsCodes(phone, sinceIso) {
    const result = await pool.query(
      `select count(*)::int as count
       from auth_sms_codes
       where phone = $1 and created_at >= $2`,
      [phone, sinceIso],
    );
    return result.rows[0]?.count || 0;
  },

  async latestSmsCode(phone) {
    const result = await pool.query(
      `select phone, code_hash as "codeHash", request_id as "requestId",
              expires_at as "expiresAt", consumed_at as "consumedAt",
              created_at as "createdAt"
       from auth_sms_codes
       where phone = $1
       order by created_at desc
       limit 1`,
      [phone],
    );
    return result.rows[0] || null;
  },

  async saveSmsCode({ phone, codeHash, requestId, expiresAt, createdAt }) {
    await pool.query(
      `insert into auth_sms_codes (phone, code_hash, request_id, expires_at, created_at)
       values ($1, $2, $3, $4, $5)`,
      [phone, codeHash, requestId, expiresAt, createdAt],
    );
  },

  async consumeSmsCode(phone, codeHash) {
    const result = await pool.query(
      `update auth_sms_codes
       set consumed_at = now()
       where id = (
         select id from auth_sms_codes
         where phone = $1 and code_hash = $2 and consumed_at is null and expires_at > now()
         order by created_at desc
         limit 1
       )
       returning id`,
      [phone, codeHash],
    );
    return result.rowCount > 0;
  },

  async upsertUserByPhone(phone) {
    const result = await pool.query(
      `insert into profiles (phone)
       values ($1)
       on conflict (phone)
       do update set updated_at = now(), deleted_at = null
       returning id, phone, nickname, avatar_url as "avatarUrl"`,
      [phone],
    );
    return result.rows[0];
  },

  async saveSession(session) {
    await pool.query(
      `insert into auth_sessions
       (user_id, access_token_hash, refresh_token_hash, expires_at, revoked_at, created_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        session.user.id,
        session.accessTokenHash,
        session.refreshTokenHash,
        session.expiresAt,
        session.revokedAt,
        session.createdAt,
      ],
    );
  },

  async findSession(accessTokenHash) {
    const result = await pool.query(
      `select s.access_token_hash as "accessTokenHash",
              s.refresh_token_hash as "refreshTokenHash",
              s.expires_at as "expiresAt",
              s.revoked_at as "revokedAt",
              s.created_at as "createdAt",
              p.id, p.phone, p.nickname, p.avatar_url as "avatarUrl"
       from auth_sessions s
       join profiles p on p.id = s.user_id
       where s.access_token_hash = $1
         and s.revoked_at is null
         and s.expires_at > now()
         and p.deleted_at is null
       limit 1`,
      [accessTokenHash],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      accessTokenHash: row.accessTokenHash,
      refreshTokenHash: row.refreshTokenHash,
      expiresAt: new Date(row.expiresAt).toISOString(),
      revokedAt: row.revokedAt ? new Date(row.revokedAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
      user: {
        id: row.id,
        phone: row.phone,
        nickname: row.nickname,
        avatarUrl: row.avatarUrl,
      },
    };
  },

  async revokeSession(accessTokenHash) {
    await pool.query(
      `update auth_sessions
       set revoked_at = now()
       where access_token_hash = $1 and revoked_at is null`,
      [accessTokenHash],
    );
  },

  async mergeSync(userId, body) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const local = body.local && typeof body.local === 'object' ? body.local : {};
      const localUpdatedAt = typeof body.clientSyncedAt === 'string' ? body.clientSyncedAt : nowIso();

      for (const trackId of normalizeStringArray(local.favoriteIds)) {
        await client.query(
          `insert into user_favorites (user_id, track_id, updated_at, deleted_at)
           values ($1, $2, $3, null)
           on conflict (user_id, track_id)
           do update set updated_at = excluded.updated_at, deleted_at = null
           where user_favorites.updated_at <= excluded.updated_at`,
          [userId, trackId, localUpdatedAt],
        );
      }

      for (const tombstone of normalizeDeleted(body.deletedFavorites)) {
        await client.query(
          `insert into user_favorites (user_id, track_id, updated_at, deleted_at)
           values ($1, $2, $3, $3)
           on conflict (user_id, track_id)
           do update set updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
           where user_favorites.updated_at <= excluded.updated_at`,
          [userId, tombstone.id, tombstone.deletedAt],
        );
      }

      const historyIds = uniqueLatestFirst(normalizeStringArray(local.historyIds));
      for (let index = 0; index < historyIds.length; index += 1) {
        const trackId = historyIds[index];
        const playedAt = new Date(new Date(localUpdatedAt).getTime() - index).toISOString();
        await client.query(
          `insert into play_history (user_id, track_id, last_played_at, play_count, updated_at, deleted_at)
           values ($1, $2, $3, 1, $4, null)
           on conflict (user_id, track_id)
           do update set
             last_played_at = greatest(play_history.last_played_at, excluded.last_played_at),
             play_count = play_history.play_count + 1,
             updated_at = excluded.updated_at,
             deleted_at = null`,
          [userId, trackId, playedAt, localUpdatedAt],
        );
      }

      for (const log of Array.isArray(local.sleepLogs) ? local.sleepLogs : []) {
        if (!log || typeof log.id !== 'string') {
          continue;
        }
        await client.query(
          `insert into sleep_logs
           (id, user_id, sleep_at, wake_at, duration_minutes, rating, note, updated_at, deleted_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, null)
           on conflict (user_id, id)
           do update set
             sleep_at = excluded.sleep_at,
             wake_at = excluded.wake_at,
             duration_minutes = excluded.duration_minutes,
             rating = excluded.rating,
             note = excluded.note,
             updated_at = excluded.updated_at,
             deleted_at = null
           where sleep_logs.user_id = excluded.user_id and sleep_logs.updated_at <= excluded.updated_at`,
          [
            log.id,
            userId,
            log.sleepAt || null,
            log.wakeAt || null,
            Number.isFinite(log.durationMinutes) ? log.durationMinutes : null,
            Number.isFinite(log.rating) ? log.rating : null,
            log.note || null,
            localUpdatedAt,
          ],
        );
      }

      for (const tombstone of normalizeDeleted(body.deletedSleepLogs)) {
        await client.query(
          `update sleep_logs
           set updated_at = $3, deleted_at = $3
           where user_id = $1 and id = $2 and updated_at <= $3`,
          [userId, tombstone.id, tombstone.deletedAt],
        );
      }

      if (local.settings && typeof local.settings === 'object') {
        const settings = normalizeSettings(local.settings);
        await client.query(
          `insert into user_settings
           (user_id, default_sleep_timer_minutes, theme_mode, updated_at, deleted_at)
           values ($1, $2, $3, $4, null)
           on conflict (user_id)
           do update set
             default_sleep_timer_minutes = excluded.default_sleep_timer_minutes,
             theme_mode = excluded.theme_mode,
             updated_at = excluded.updated_at,
             deleted_at = null
           where user_settings.updated_at <= excluded.updated_at`,
          [userId, settings.defaultSleepTimerMinutes, settings.themeMode, localUpdatedAt],
        );
      }

      const snapshot = await readSyncSnapshot(client, userId);
      await client.query('commit');
      return snapshot;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  },
});

module.exports = {
  createPostgresAdapter,
};

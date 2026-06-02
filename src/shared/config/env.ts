const truthy = (value: string | undefined, fallback = true) => {
  if (value == null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

export const appConfig = {
  appName: process.env.EXPO_PUBLIC_APP_NAME || 'Codex Sleep',
  appEnv: process.env.EXPO_PUBLIC_APP_ENV || 'development',
  audioSource: process.env.EXPO_PUBLIC_AUDIO_SOURCE || 'local',
  audioCdnBaseUrl: process.env.EXPO_PUBLIC_AUDIO_CDN_BASE_URL || '',
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || '',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  authRedirectUrl: process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || 'codexsleep://auth/callback',
  flags: {
    musicSleep: truthy(process.env.EXPO_PUBLIC_ENABLE_MUSIC_SLEEP),
    storySleep: truthy(process.env.EXPO_PUBLIC_ENABLE_STORY_SLEEP),
    noiseSleep: truthy(process.env.EXPO_PUBLIC_ENABLE_NOISE_SLEEP),
    sleepTimer: truthy(process.env.EXPO_PUBLIC_ENABLE_SLEEP_TIMER),
    favorites: truthy(process.env.EXPO_PUBLIC_ENABLE_FAVORITES),
    sleepLog: truthy(process.env.EXPO_PUBLIC_ENABLE_SLEEP_LOG),
    notifications: truthy(process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS, false),
  },
};

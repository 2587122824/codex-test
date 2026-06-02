# Supabase Setup

This project uses Supabase for optional account login and cloud sync. Guest mode
continues to work when Supabase is not configured.

## 1. Create Project

1. Open <https://supabase.com/dashboard/projects>.
2. Create a new project named `codex-sleep`.
3. Choose a nearby region for testers, for example Singapore or Tokyo for China-adjacent testing.
4. Save the database password in a password manager.

## 2. Apply Database Schema

1. Open the project dashboard.
2. Go to SQL Editor.
3. Paste the contents of `supabase/schema.sql`.
4. Run the SQL and confirm all five user tables exist.

The schema enables RLS on:

- `profiles`
- `user_settings`
- `user_favorites`
- `play_history`
- `sleep_logs`

## 3. Configure App Environment

Copy `.env.example` to `.env`, then set:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
EXPO_PUBLIC_AUTH_REDIRECT_URL=codexsleep://auth/callback
```

Restart Expo after editing `.env`.

## 4. Configure Auth

In Supabase Auth settings:

1. Enable phone provider and configure an SMS provider before testing phone OTP.
2. Add `codexsleep://auth/callback` as an allowed redirect URL.
3. Configure Apple/Google OAuth providers only after the app package and store identifiers are stable.
4. Treat WeChat login as a later native integration through WeChat Open Platform.

## 5. Validate

Run:

```sh
npm.cmd run check
```

Then start the app and open Settings > Account & Sync.

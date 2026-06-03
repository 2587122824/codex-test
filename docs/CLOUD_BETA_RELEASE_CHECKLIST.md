# Cloud Beta Release Checklist

Use this checklist after the beta UI/backend checkpoint is merged and before
sharing 古德眠 with real testers.

## Cloud Resources

- Create an Alibaba Cloud RDS PostgreSQL instance.
- Run `server/aliyun-functions/rds-schema.sql` against a clean database.
- Create an Alibaba Cloud SMS signature and verification-code template.
- Create a Function Compute HTTP function with `server/aliyun-functions/index.js`
  as `index.handler`.
- Configure Function Compute environment variables from
  `server/aliyun-functions/.env.example`.
- Set the Expo app variable `EXPO_PUBLIC_API_BASE_URL` to the Function Compute
  HTTP domain.

## Deployment Package

```bash
cd server/aliyun-functions
npm.cmd install
npm.cmd run check
```

Deploy the `server/aliyun-functions` folder as the Function Compute bundle.

## Cloud HTTP Smoke

First send a real SMS code:

```bash
$env:ALIYUN_FUNCTION_BASE_URL="https://your-function-domain.example.com"
$env:ALIYUN_SMOKE_PHONE="+8613800000000"
npm.cmd run smoke:aliyun-cloud
```

After receiving the SMS code, continue the full smoke:

```bash
$env:ALIYUN_SMOKE_CODE="123456"
npm.cmd run smoke:aliyun-cloud
```

Expected result:

- `/auth/send-code` returns `requestId`.
- `/auth/verify-code` returns `session`.
- `/auth/session` succeeds with the bearer token.
- `/auth/refresh` rotates access and refresh tokens, and the old access token
  returns 401.
- `/sync/merge` returns favorites, history, settings, and `syncedAt`.
- `/auth/logout` returns 204.
- `/auth/session` returns 401 after logout.

## App End-To-End

- Open the app with `EXPO_PUBLIC_API_BASE_URL` pointing at the cloud function.
- Sign in with a real phone code.
- Favorite one track, play two tracks, and switch the theme.
- Trigger sync or navigate until account sync finishes.
- Clear local app storage or reinstall.
- Sign in again and confirm favorites, recent plays, and theme return.
- Confirm guest mode still works when `EXPO_PUBLIC_API_BASE_URL` is empty.

## Final Local Gates

```bash
npm.cmd run check
npx.cmd expo install --check
git diff --check
cd server/aliyun-functions
npm.cmd run check
```

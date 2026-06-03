# Alibaba Cloud Backend

Codex Sleep now targets an Alibaba Cloud backend:

- Alibaba Cloud Function Compute: HTTP API for auth and sync.
- Alibaba Cloud SMS: phone verification code delivery.
- Alibaba Cloud RDS PostgreSQL: account and sync data.
- Alibaba Cloud OSS: optional future audio or image hosting.

The app does not import Alibaba SDKs directly. It only calls
`EXPO_PUBLIC_API_BASE_URL`, so SMS credentials and database credentials stay on
the server.

## First Deployment Checklist

1. Create an Alibaba Cloud RDS PostgreSQL instance.
2. Run `rds-schema.sql`.
3. Enable Alibaba Cloud SMS and create a signature/template for verification
   codes.
4. Install dependencies in this folder and deploy `index.handler` as the
   Function Compute HTTP entrypoint.
5. Store these values as Function Compute environment variables:
   - `DB_HOST`
   - `DB_PORT`
   - `DB_NAME`
   - `DB_USER`
   - `DB_PASSWORD`
   - `ALIYUN_ACCESS_KEY_ID`
   - `ALIYUN_ACCESS_KEY_SECRET`
   - `ALIYUN_SMS_SIGN_NAME`
   - `ALIYUN_SMS_TEMPLATE_CODE`
   - `SESSION_SECRET`
6. Set the Expo app variable:
   - `EXPO_PUBLIC_API_BASE_URL=https://your-function-domain.example.com`

Use `.env.example` as the source checklist for Function Compute environment
variables. Do not commit real secrets.

## Implementation Direction

Use `IMPLEMENTATION_PLAN.md` as the build order for the first real beta
handler. Current decisions:

- PostgreSQL driver: `pg`, maintained by the open-source node-postgres project.
- Tokens: opaque random tokens stored as server-side hashes, not JWTs for the
  first beta.
- Alibaba SMS SDK: Alibaba Cloud official SDK.
- Validation: hand-written validators until the route surface grows.

The repo still uses `scripts/mock-aliyun-api.js` for local account testing until
the Function Compute handler is added.

## Current Handler

`handler.js` now contains the first real HTTP route implementation with an
in-memory adapter for local smoke tests. The handler exports:

- `handler(event)`: Function Compute-compatible entrypoint.
- `createApp({ adapter, sms })`: test/deployment factory for injecting RDS and
  SMS adapters.
- `createMemoryAdapter()`: local-only storage used by
  `npm.cmd run smoke:aliyun-handler`.

Before production deployment, replace the memory adapter with a PostgreSQL
adapter that implements the same methods and wire `sms.sendCode` to Alibaba
Cloud SMS.

`postgres-adapter.js` contains the first PostgreSQL implementation of that
adapter contract. It loads `pg` only when instantiated, so local app checks do
not need backend dependencies installed in the Expo project.

`aliyun-sms-adapter.js` contains the Alibaba Cloud SMS adapter scaffold. It
loads the official Alibaba SDK packages only when instantiated by the deployment
bundle.

For early internal cloud smoke before the SMS signature/template qualification is
approved, deploy with:

```bash
SMS_PROVIDER=local
LOCAL_SMS_FIXED_CODE=123456
```

This keeps the RDS-backed auth/session/sync flow active while bypassing the real
SMS provider. Switch `SMS_PROVIDER` back to `aliyun` or leave it unset after the
real Alibaba Cloud SMS signature and template are approved.

Production wiring should create the app like this:

```js
const { createApp } = require('./handler');
const { createPostgresAdapter } = require('./postgres-adapter');
const { createAliyunSmsAdapter } = require('./aliyun-sms-adapter');

const app = createApp({
  adapter: createPostgresAdapter(),
  sms: createAliyunSmsAdapter(),
});

exports.handler = (event) => app.handle(event);
```

`index.js` already contains this production wiring for the deployment bundle.

Local handler smoke:

```bash
npm.cmd run smoke:aliyun-handler
```

The local smoke covers SMS code verification, refresh-token rotation, session
lookup, sync merge, logout, and post-logout rejection.

Cloud HTTP smoke after deployment:

```bash
$env:ALIYUN_FUNCTION_BASE_URL="https://your-function-domain.example.com"
$env:ALIYUN_SMOKE_PHONE="+8613800000000"
npm.cmd run smoke:aliyun-cloud
$env:ALIYUN_SMOKE_CODE="123456"
npm.cmd run smoke:aliyun-cloud
```

With `SMS_PROVIDER=local`, the first command records a fixed local code and the
second command should use `ALIYUN_SMOKE_CODE=123456`. With the Aliyun SMS
provider, the first command sends a real SMS code and the second command
completes verify/refresh/session/sync/logout after the code is available.

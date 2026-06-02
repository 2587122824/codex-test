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
4. Create Function Compute HTTP routes from `api-contract.md`.
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

## Pending Implementation Choices

The real Function Compute handler will need database, token, and input
validation libraries. Before adding those technologies to this repo, confirm the
vendors and packages:

- PostgreSQL driver: `pg`, maintained by the open-source node-postgres project.
- Token library: `jose` or `jsonwebtoken`, open-source JWT tooling.
- Alibaba SMS SDK: Alibaba Cloud official SDK.
- Validation: `zod` or hand-written validation.

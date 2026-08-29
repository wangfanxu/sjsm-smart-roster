# Deployment Runbook

## Selected environment

| Component | Selection |
| --- | --- |
| Web and API | Firebase App Hosting |
| Application region | `asia-southeast1` (Singapore) |
| Live branch | `main` |
| PostgreSQL | Neon, Singapore region |
| Runtime database connection | Pooled TLS connection string |
| Secrets | Google Cloud Secret Manager through App Hosting |
| Public checks | `/en` and `/api/health` |

The architecture decision and cost comparison are recorded in [ADR 0002](adr/0002-use-firebase-app-hosting-and-neon.md).

## One-time setup

These steps change cloud resources and may enable billing. Perform them from the Firebase and Neon accounts owned by the project author.

1. Create a Neon project in the Singapore region without real member data.
2. Copy both connection strings: use the pooled URL for the application and the direct URL only for migrations.
3. Upgrade the intended Firebase project to Blaze, attach a billing account, and configure a conservative billing alert before deployment.
4. In Firebase App Hosting, create a backend with:
   - repository: `wangfanxu/sjsm-smart-roster`;
   - root directory: `/`;
   - live branch: `main`;
   - region: `asia-southeast1`;
   - automatic rollouts: enabled;
   - runtime: the currently recommended supported Node.js runtime.
5. Add the pooled Neon URL to Cloud Secret Manager without printing it into shell history:

   ```bash
   firebase apphosting:secrets:set sjsm-smart-roster-database-url
   ```

6. Confirm that the backend has access to the secret and that `DATABASE_URL` appears as a secret reference—not a plaintext value—in the rollout configuration.
7. Apply migrations from an authorized operator environment using the direct Neon URL:

   ```bash
   DATABASE_URL='<direct-neon-url>' npm run db:migrate
   ```

8. Add the conversational assistant's runtime secrets the same way (see
   [ADR 0003](adr/0003-use-gemini-flash-lite-for-assistant-classification.md)
   before putting real member data through the assistant — the free Gemini
   tier is demo-only):

   ```bash
   firebase apphosting:secrets:set sjsm-smart-roster-gemini-api-key
   firebase apphosting:secrets:set sjsm-smart-roster-assistant-confirmation-secret
   ```

   Use a Gemini API key from Google AI Studio for the first, and a long
   random value (e.g. `openssl rand -base64 32`) for the second — it signs
   confirmation tokens for conversational availability writes, not an
   external credential. `ASSISTANT_MODEL` is not sensitive and is set as a
   plain value in `apphosting.yaml`.
9. Trigger or wait for the `main` rollout. Record the URL, commit SHA, rollout result, and verification output in the deployment evidence section below.

Firebase App Hosting automatically supplies Firebase project configuration and Google Application Default Credentials. Do not create or upload a service-account key for the application.

## Local pre-deployment verification

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run db:check
npm run build
```

For a database-backed smoke test, create `.env.local` from `.env.example`, use a synthetic development database, run `npm run db:migrate`, and then `npm run dev`.

## Post-deployment verification

Replace `<base-url>` with the `hosted.app` URL:

```bash
curl --fail --silent --show-error https://<base-url>/api/health
curl --fail --silent --show-error --output /dev/null https://<base-url>/en
```

Expected health response:

```json
{"service":"sjsm-smart-roster","status":"ok"}
```

Do not use a protected API as the public health check because it intentionally requires a Firebase ID token and database user mapping.

## Rollback

1. Open Firebase Console → App Hosting → the SmartRoster backend → **Rollouts**.
2. For an urgent application regression, select a known-good rollout and choose **Roll back to this build**. This restores the existing image and its original environment configuration without rebuilding.
3. If code must be reverted while retaining the latest secret/configuration versions, create a rollout from the earlier Git commit instead.
4. Re-run both post-deployment checks and record the restored commit and rollout.
5. Database migrations are forward-only by default. Do not roll back a schema destructively; deploy a tested corrective migration unless an explicit, reviewed recovery plan exists.

## Deployment evidence

| Evidence | Value |
| --- | --- |
| Public URL | [smart-roster--sjsm-smart-roster.asia-southeast1.hosted.app](https://smart-roster--sjsm-smart-roster.asia-southeast1.hosted.app/en) |
| First deployed commit | `8362d4f23d3447fd56aace2f03a68f287ca95283` |
| App Hosting rollout | `fah-sjsm-smart-roster-smart-roster-rollout-2026-08-28-001` — success |
| `/en` result | HTTP 200 |
| `/api/health` result | HTTP 200 — `{"service":"sjsm-smart-roster","status":"ok"}` |
| Verification timestamp | `2026-08-28T14:09:38Z` |

This evidence satisfies the deployment acceptance criteria in Issue #14.

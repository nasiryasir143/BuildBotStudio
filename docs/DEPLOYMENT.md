# Deployment checklist — separate service only

This repository is configured for a new Cloudflare Worker named `buildbot-studio-api`. It is separate from the existing `100days` Worker.

## Before pressing Deploy

1. Open the Cloudflare account and choose the intended account.
2. Create or connect a NEW Worker for this repository. Do not select or overwrite `100days`.
3. Confirm the deployment configuration reads this repository's `wrangler.toml` and the Worker name is exactly `buildbot-studio-api`.
4. Confirm the Workers AI binding named `AI` is enabled for this new Worker. The binding in the existing `100days` Worker is not shared automatically.
5. In this new Worker, open **Settings → Variables and Secrets** and add a secret named exactly `APP_ACCESS_KEY`. Use a long, unique password-like value and keep it private. Do not put it in `wrangler.toml`, GitHub, or chat.
6. Save the secret before testing generation. The API intentionally refuses AI requests until this secret exists.

## Deploy

After the above checks, press Deploy in the Cloudflare deployment screen. If Cloudflare shows a Worker name other than `buildbot-studio-api`, stop and correct it before deploying.

If using a local development environment instead:

```sh
npm install
npm run typecheck
npx wrangler deploy
```

## First use

1. Open the new Worker URL.
2. Enter the same `APP_ACCESS_KEY` value in the Owner access key field. It is held in browser session storage only.
3. Open `/api/health` to confirm the service responds and reports AI configuration.
4. Try a small planning request before asking it to generate an app.

The health route reports configuration presence; it does not guarantee that the selected model will answer successfully.

## Current scope and important limits

- App projects and snapshots are stored in the current browser's local storage only. They are not cloud-synced and are not user accounts. Export JSON backups before clearing browser data.
- Generated projects are static HTML/CSS/JavaScript. The workspace can preview them in a sandboxed browser frame and download the source files.
- The API does not execute generated code, install packages, run arbitrary builds, or publish generated apps.
- `APP_ACCESS_KEY` is a single shared owner key, not a multi-user authentication system. Do not share it publicly.
- Add Cloudflare rate limiting and stronger user authentication before inviting other people or publishing the service broadly.
- AI usage is subject to current Workers AI model availability, account limits, and pricing. Free usage is not unlimited or guaranteed.

## Deployment status

No Cloudflare deployment has been performed by these repository changes. The existing `100days` Worker has not been changed.

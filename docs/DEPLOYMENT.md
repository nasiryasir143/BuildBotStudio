# Deployment checklist — separate service only

This guide is for the new `buildbot-studio-api` Worker defined in this repository.

## Before deploying

1. Confirm the Cloudflare account and project you intend to use.
2. Keep the existing `100days` Worker and its settings untouched.
3. Review `wrangler.toml`; its Worker name must remain `buildbot-studio-api`.
4. Confirm the AI binding is available to this new Worker in your Cloudflare account.
5. Install dependencies and run the TypeScript check locally.

## Deploy from this repository

From the repository root on a computer or compatible development environment:

```sh
npm install
npm run typecheck
npx wrangler login
npx wrangler deploy
```

Wrangler should create/update the Worker named `buildbot-studio-api`, not the existing `100days` service. Stop if Wrangler shows a different Worker name or unexpected account.

## Verify after deployment

Open the new Worker URL:

- `/api/health` — configuration status.
- `/` — workspace UI (the static asset fallback should serve `index.html`).
- Use the workspace to request a plan and a static starter project.

The health endpoint only confirms that the binding and model setting are present; it does not prove the model can successfully answer.

## Important safety and cost notes

The current generation API has no user authentication or per-user quota. Do not publish it as an unrestricted public service. Add authentication, rate limiting, abuse protection, and usage limits first.

Generated project files are returned as text for review and download. They are not run by the Worker. A future build/test feature must use a separate isolated sandbox.

Cloudflare AI usage is subject to current account quotas, model availability, and platform terms. Free usage is not unlimited or guaranteed.

## Current deployment status

Deployment has **not** been performed from this repository. No Cloudflare Worker or existing service has been changed by these GitHub commits.

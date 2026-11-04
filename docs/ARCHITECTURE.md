# BuildBot Studio — Architecture

## Implemented foundation

- `public/index.html`: mobile-first workspace with plan, generation, revision, sandbox preview, and local project library UI.
- `public/access.js`: session-only owner key prompt and API request header.
- `src/worker/index.ts`: bounded request parsing, owner-key protection, security headers, API routes, and static asset fallback.
- `src/worker/agent/planner.ts`: provider selection and agent orchestration.
- `src/worker/providers/provider.ts`: provider-neutral plan and generation contract.
- `src/worker/providers/cloudflare-ai.ts`: first AI adapter, bounded plan generation, and bounded static starter-file generation.
- `src/worker/types.ts`: shared contracts.
- `wrangler.toml`: separate Worker configuration with AI and static assets bindings.

## API

### `GET /api/health`

Returns service name, stage, and whether the AI binding/model are configured. This is a configuration check, not a live model health test.

### `POST /api/plan`

Request:

```json
{ "instruction": "Create a simple task manager" }
```

Returns a structured project plan.

### `POST /api/generate`

Accepts the same request shape and returns a bounded static web starter with `index.html`, `styles.css`, and `app.js`. Generated files are returned as source text and can be downloaded from the workspace.

### `POST /api/edit`

Accepts an edit instruction plus the current allowlisted starter files. It returns complete replacement contents for the required HTML, CSS, and JavaScript files. This is an iterative edit workflow; project state currently lives in the browser session and is not saved to a user account or database.

The current generator is deliberately limited to static browser files. It does not generate server code, install packages, execute generated code, run builds, save projects to a database, or deploy applications.

## Provider replacement

All model calls go through `BuildPlanProvider`. Add another adapter implementing `createPlan`, `generateProject`, and `reviseProject`, then change provider selection in `getPlanProvider`. Do not put provider-specific calls in route handlers or UI code.

## Security boundaries

- Generated code is treated as untrusted text. The workspace displays and downloads it but never executes it.
- The generator only accepts a small allowlist of file paths and applies per-file and total-size limits.
- AI routes require the `APP_ACCESS_KEY` Worker secret. The key is sent in a request header and kept in browser session storage by the UI.
- The current key is a single shared owner key, not multi-user authentication. Apply rate limits before broad public access.
- Never execute generated code inside the API Worker.
- Build and test only in a separately isolated sandbox with resource limits and no ambient secrets.
- Never expose provider credentials to the browser.
- Before public deployment, add authentication, rate limiting, per-user quotas, abuse controls, and persistent project ownership.
- Do not expose an unauthenticated generation endpoint to the public internet without those controls.

## Planned modules

1. Cloud project storage, multi-user accounts, and server-side version history (the current project library is browser-local only).
2. User authentication and access controls.
3. Safe isolated build/test runner.
4. Iterative edit agent that modifies an existing project using explicit file diffs.
5. Export and deployment workflows.
6. Website and game development modes.

## Cost and availability

Free-tier AI providers have quotas, model availability restrictions, and changing limits. Unlimited free generation is not promised. Provider and model identifiers must remain configurable.

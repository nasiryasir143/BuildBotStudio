# BuildBot Studio — Architecture

## Current foundation

The repository now contains a static landing page and a small Cloudflare Worker API foundation.

- `src/worker/index.ts`: HTTP routes and request validation.
- `src/worker/agent/planner.ts`: provider selection and planning orchestration.
- `src/worker/providers/provider.ts`: provider-neutral contract.
- `src/worker/providers/cloudflare-ai.ts`: first provider adapter.
- `src/worker/types.ts`: shared types.

## First API routes

- `GET /api/health` reports service status and whether an AI binding/model is configured.
- `POST /api/plan` accepts `{ "instruction": "..." }` and returns a structured app plan.

The plan route does not generate or execute application code yet. It is the first agent workflow only.

## Planned next modules

1. Project workspace and versioned file storage.
2. Code-generation agent that creates files from an approved plan.
3. Build/test adapter running in a separate, isolated sandbox.
4. Project export and deployment workflow.
5. Website and game development modes.

## Provider replacement

All model calls must go through `BuildPlanProvider`. Add a new adapter implementing that interface and change provider selection in `getPlanProvider`; do not put provider-specific calls in route handlers or UI code.

## Security requirements

- Never execute generated code inside the API Worker.
- Run builds and tests only in a separately isolated sandbox with resource limits.
- Never expose provider credentials to the browser.
- Validate request sizes and all generated structured output.
- Add authentication, rate limiting, quotas, and abuse protection before public launch.
- Do not store user projects in process memory; use a persistent database/object store with per-user access controls.

## Cost and availability

A free-tier provider may have quotas, model availability restrictions, and changing limits. Do not promise unlimited free generation. Configure provider and model identifiers outside application logic.

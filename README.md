# BuildBot Studio

An independent, mobile-first AI development workspace for turning natural-language instructions into starter web applications.

## Current milestone: deployable early preview

- Mobile-first workspace with planning, generation, and revision actions.
- Cloudflare Workers AI adapter using a configurable code-focused model.
- Provider interface isolates model calls so another provider can replace it later.
- Static starter generation for HTML, CSS, and browser JavaScript.
- Iterative natural-language revisions of the current starter.
- Sandboxed browser preview with an opaque-origin iframe and restrictive content policy.
- Browser-local project library, short session version history, JSON backup import/export.
- Owner-key protection for AI API routes.
- Request-size limits, file allowlists, security headers, and CI checks.

## Honest scope

This is an early App Developer release, not yet a full autonomous app builder. It currently generates static web starter projects. It does not provide multi-user accounts, cloud-synced project storage, arbitrary package installation, general-purpose server code generation, automated builds, or one-click publishing of the generated apps.

The project library is stored in the current browser only. Use JSON export to back up projects before clearing browser data. The single `APP_ACCESS_KEY` secret protects AI routes but is not a multi-user identity system. Add platform rate limits and proper user authentication before inviting other users.

## Product phases

1. **App Developer** — create and iteratively improve starter applications.
2. **Website Developer** — build and refine websites.
3. **Game Developer** — add 2D and 3D game project workflows.
4. **Advanced AI** — configurable model providers and more capable agent workflows.

## Development

Requirements: Node.js 22+ and a Cloudflare account.

```sh
npm install
npm run check
npm run dev
```

Deployment instructions are in `docs/DEPLOYMENT.md`.

The included `wrangler.toml` defines a separate Worker named `buildbot-studio-api`. It must not be used to alter or replace the existing `100days` Worker.

## AI model and cost

The default model is configurable in `wrangler.toml`. The current setting uses Cloudflare's Qwen2.5-Coder 32B Workers AI model. Model availability and pricing can change. Workers AI usage is subject to account quotas and charges beyond any included allowance; unlimited free use is not promised.

## Documentation

- `docs/ARCHITECTURE.md` — system modules, API, provider adapter, and security boundaries.
- `docs/DEPLOYMENT.md` — separate Worker setup and secure first deployment.

## License

To be decided before public distribution.

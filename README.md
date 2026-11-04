# BuildBot Studio

An independent, mobile-first AI development workspace for creating applications from natural-language instructions.

## Current status

The first foundation is now in the repository:

- A responsive landing page at `/index.html`.
- An interactive planning workspace at `/index.html` served from `public/` when deployed with the included Worker configuration.
- A Worker API with `GET /api/health` and `POST /api/plan`.
- A provider adapter boundary so the AI model integration can be replaced later.
- Architecture and setup notes in `docs/`.

**Important:** this is an early foundation, not a finished autonomous app builder. It can request a structured app plan once the AI binding is configured. It does not yet generate complete application source files, run builds, save user projects, or publish apps.

## Product phases

1. **App Developer** — create and iteratively improve applications.
2. **Website Developer** — build and refine websites.
3. **Game Developer** — create 2D and 3D game projects.
4. **Advanced AI** — add configurable model providers and advanced agent workflows.

## Principles

- Natural-language instructions should drive planning, implementation, testing, and iteration.
- Users should retain control of project files and source code.
- Keep model providers behind replaceable adapters.
- Isolate code execution and testing in a secure sandbox.
- Design for mobile browsers as well as desktop.
- Prefer open-source components and free tiers where practical; clearly disclose quotas and service limits.
- Keep this project separate from the existing `100days` project.

## Development

Requirements: Node.js and a Cloudflare account for Worker deployment.

```sh
npm install
npm run typecheck
npm run dev
```

Deploy only as a new Worker after reviewing the configuration:

```sh
npx wrangler deploy
```

The included `wrangler.toml` defines a separate Worker named `buildbot-studio-api`; it is not a configuration for the existing `100days` Worker. Do not change or reuse that existing service.

## Security and limits

Before public launch, add authentication, per-user project access controls, rate limiting, quotas, persistent storage, and an isolated build/test sandbox. Never execute generated code inside the API Worker or expose provider credentials to the browser.

Free AI providers have usage limits and availability constraints. Unlimited free generation is not promised.

## License

To be decided before public distribution.

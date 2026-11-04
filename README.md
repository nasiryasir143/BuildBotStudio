# BuildBot Studio

An independent, mobile-first AI development workspace for creating applications from natural-language instructions.

## Current status

The repository now includes an early App Developer foundation:

- Responsive landing page and interactive workspace.
- `POST /api/plan` for structured app planning.
- `POST /api/generate` for a bounded static web starter containing HTML, CSS, and browser JavaScript.
- `POST /api/edit` to revise the current starter with another natural-language instruction.
- Source preview and per-file download in the workspace.
- Provider adapter boundary for future model replacement.
- Separate Cloudflare Worker configuration and static asset serving.

**This is not yet a complete autonomous app builder.** It does not yet provide user accounts, persistent project storage, edit history, package installation, code execution, automated build/test, or publishing.

## Product phases

1. **App Developer** — create and iteratively improve applications.
2. **Website Developer** — build and refine websites.
3. **Game Developer** — create 2D and 3D game projects.
4. **Advanced AI** — add configurable model providers and advanced agent workflows.

## Development

Requirements: Node.js and a Cloudflare account.

```sh
npm install
npm run typecheck
npm run dev
```

Deploy only as a new Worker after reviewing `docs/DEPLOYMENT.md`:

```sh
npx wrangler deploy
```

The included `wrangler.toml` defines a separate Worker named `buildbot-studio-api`. It must not be used to alter or replace the existing `100days` Worker.

## Security and cost

Generated files are displayed and downloaded as source text; they are not executed. Before public launch, add authentication, per-user access controls, rate limiting, quotas, persistent storage, and an isolated build/test sandbox.

Free AI providers have usage limits and availability constraints. Unlimited free generation is not promised.

## Project documentation

- `docs/ARCHITECTURE.md` — modules, API, provider design, and security boundaries.
- `docs/DEPLOYMENT.md` — isolated deployment checklist.

## License

To be decided before public distribution.

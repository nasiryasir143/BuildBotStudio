# BuildBot Studio

An independent, mobile-first AI development workspace for creating applications from natural-language instructions.

## Product direction

BuildBot Studio is being developed in phases:

1. **App Developer** — create and iteratively improve applications.
2. **Website Developer** — build and refine websites.
3. **Game Developer** — create 2D and 3D game projects.
4. **Advanced AI** — add configurable model providers and advanced agent workflows.

## Core principles

- Natural-language instructions should drive planning, implementation, testing, and iteration.
- Users should retain control of their project files and source code.
- Keep model providers behind replaceable adapters.
- Isolate execution and testing in a secure sandbox.
- Design for mobile browsers as well as desktop.
- Prefer open-source components and free tiers where practical; clearly disclose quotas and service limits.
- Do not interfere with the separate `100days` project.

## Initial architecture

- `apps/web` — mobile-first user interface.
- `services/agent` — task planning and tool orchestration.
- `services/providers` — replaceable AI model adapters.
- `services/projects` — project files, revisions, and export.
- `services/sandbox` — isolated build and test execution.
- `docs` — architecture, setup, and product decisions.

## Status

Repository initialized. Implementation and deployment are not yet configured.

## License

To be decided before public distribution.

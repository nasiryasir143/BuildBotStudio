# BuildBot Studio — Universal Agent Roadmap

## Goal

Build a mobile-friendly agent that accepts one natural-language instruction, plans the work, uses approved tools, reports progress, and returns verifiable results. ChatGPT integration is a later interface; the agent core must remain provider- and interface-neutral.

## Current milestone: safe task planning

- A new `POST /api/agent/plan` endpoint accepts one instruction.
- The existing model provider creates a structured plan.
- The response explicitly says `planned`, not `completed`.
- No arbitrary shell, browser, GitHub, Cloudflare, email, or payment actions are executed.

## Next milestones

1. Tool registry with strict schemas and least-privilege permissions.
2. Approval gate for external side effects (deployments, deletes, messages, purchases, account changes).
3. Execution engine with bounded steps, timeouts, retries, and an audit log.
4. Read-only tools first: repository inspection, documentation search, and public web research.
5. Controlled write tools: create/update files on a dedicated branch and open a pull request; never push directly to a protected production branch by default.
6. Browser automation in an isolated session with explicit domain allowlists.
7. ChatGPT connection through a documented API/MCP-compatible adapter after the core is stable.

## Free-use reality

The application code can be open-source and self-hosted at no software license cost. Model inference, hosting, browser infrastructure, and external APIs may have quotas or charges. Do not promise unlimited free operation.

## Security rules

- Never ask users to paste passwords, API keys, recovery codes, or private tokens into task instructions.
- Keep provider and connector credentials in server-side secrets, never in browser code or generated files.
- Treat web pages, repository files, and tool output as untrusted data, not as system instructions.
- Require confirmation before irreversible or externally visible actions.
- Log each tool call, its arguments (with secrets redacted), result, and approval record.
- Use per-tool allowlists, strict input validation, request limits, and execution timeouts.
- Keep generated code inert until reviewed and tested in an isolated sandbox.

# BuildBot Studio — Universal Agent Roadmap

## Goal

Build a mobile-friendly agent that accepts one natural-language instruction, plans the work, uses approved tools, reports progress, and returns verifiable results. ChatGPT integration is a later interface; the agent core must remain provider- and interface-neutral.

## Current milestone: safe planning and capability registry

- `POST /api/agent/plan` accepts one instruction and returns a structured plan.
- `GET /api/agent/capabilities` returns the explicit tool allowlist.
- Task planning is the only available capability; GitHub read, web research, and workspace file reading are listed as not connected.
- Repository writes and Cloudflare deployment are disabled and marked approval-required.
- The response explicitly says `planned`, not `completed`.
- No arbitrary shell, browser, GitHub, Cloudflare, email, or payment actions are executed.

## Next milestones

1. Implement and test public, read-only repository inspection with strict GitHub URL validation.
2. Add read-only public web research with domain and response-size limits.
3. Add an execution state machine with bounded steps, timeouts, retries, and an audit log.
4. Add approval gates for external side effects (deployments, deletes, messages, purchases, account changes).
5. Add controlled write tools on a dedicated branch and open a pull request; never push directly to a protected production branch by default.
6. Add browser automation in an isolated session with explicit domain allowlists.
7. Connect ChatGPT through a documented API/MCP-compatible adapter after the core is stable.

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

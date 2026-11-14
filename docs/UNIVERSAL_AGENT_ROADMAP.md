# BuildBot Studio — Universal Agent Roadmap

## Goal

Build a mobile-friendly agent that accepts one natural-language instruction, plans work, uses explicitly allowed tools, reports progress, and returns verifiable results. ChatGPT integration is a later interface; the agent core remains provider- and interface-neutral.

## Implemented in this branch

- `POST /api/agent/plan`: creates a structured plan using the configured AI provider.
- `GET /api/agent/capabilities`: returns the explicit capability allowlist.
- `GET /api/agent/github/tree`: lists up to 150 entries from a public GitHub repository tree.
- `GET /api/agent/github/file`: reads one public UTF-8 text file, limited to approximately 256 KB.
- GitHub read routes require the workspace access key and validate owner, repository, ref, and path inputs.
- GitHub reads use the public unauthenticated API. Private repositories are not supported in this milestone.
- GitHub writes and Cloudflare deployments remain disabled. No autonomous multi-step task execution is enabled.

## API examples

All endpoints except `/api/health` require the `x-app-access-key` request header.

List a public repository tree:

```http
GET /api/agent/github/tree?owner=octocat&repo=Hello-World&ref=master
x-app-access-key: YOUR_WORKSPACE_KEY
```

Read a file:

```http
GET /api/agent/github/file?owner=octocat&repo=Hello-World&ref=master&path=README.md
x-app-access-key: YOUR_WORKSPACE_KEY
```

The read adapter does not accept arbitrary URLs, does not follow user-supplied hosts, does not write to GitHub, and does not request private credentials. GitHub's unauthenticated API rate limits apply.

## Next milestones

1. Add public web research with domain allowlists, response-size limits, and source references.
2. Add a bounded execution state machine with timeouts, retries, and an audit log.
3. Allow the planner to request only registered tools, with strict argument schemas and per-step limits.
4. Add approval gates for external side effects (deployments, deletes, messages, purchases, account changes).
5. Add controlled GitHub writes on a dedicated branch and open a pull request; never push directly to a protected production branch by default.
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

# BuildBot Studio — Universal Agent Roadmap

## Goal

A mobile-friendly agent that accepts one natural-language instruction, plans work, uses explicitly allowed tools, and returns verifiable results. ChatGPT is intended as a later control interface; the agent core remains provider- and interface-neutral.

## Implemented in this branch

- `POST /api/agent/plan`: creates a structured plan using the configured AI provider.
- `GET /api/agent/capabilities`: returns the explicit tool allowlist and availability.
- `POST /api/agent/tool`: explicitly executes one registered read-only tool.
- `POST /api/agent/run`: executes a caller-supplied sequence of 1–3 registered read-only steps in order; it does not autonomously choose tools from the AI plan.
- `GET /api/agent/github/tree`: lists up to 150 entries from a public GitHub repository tree.
- `GET /api/agent/github/file`: reads one public UTF-8 text file, limited to approximately 256 KB.
- All agent endpoints require the workspace access key.
- Public GitHub inputs are validated and upstream/file sizes are capped.
- Private repositories, web search, workspace file access, GitHub writes, deployment, and autonomous tool selection from an AI plan are not enabled.

## Explicit tool execution

All examples require the `x-app-access-key` header and JSON content type.

List a public repository tree:

```http
POST /api/agent/tool
Content-Type: application/json
x-app-access-key: YOUR_WORKSPACE_KEY

{"tool":"github.repository.read","operation":"tree","owner":"octocat","repo":"Hello-World","ref":"master"}
```

Read a public text file:

```http
POST /api/agent/tool
Content-Type: application/json
x-app-access-key: YOUR_WORKSPACE_KEY

{"tool":"github.repository.read","operation":"file","owner":"octocat","repo":"Hello-World","ref":"master","path":"README.md"}
```

The tool endpoint accepts only the registered tool ID and the two declared operations. It does not accept arbitrary URLs, shell commands, private credentials, or write operations. GitHub's unauthenticated API rate limits apply.

Run up to three read-only steps sequentially:

```http
POST /api/agent/run
Content-Type: application/json
x-app-access-key: YOUR_WORKSPACE_KEY

{"steps":[{"tool":"github.repository.read","operation":"tree","owner":"octocat","repo":"Hello-World","ref":"master"},{"tool":"github.repository.read","operation":"file","owner":"octocat","repo":"Hello-World","ref":"master","path":"README.md"}]}
```

The batch is limited to three steps. Each step must independently pass the same allowlist and input validation as the single-tool endpoint. This is bounded batch execution, not autonomous planning or unrestricted agent behavior.

## Remaining milestones

1. Connect a public web-search provider with source references and response limits.
2. Add timeouts, retries, persistent task state, and a redacted audit log for tool execution.
3. Let the planner select registered tools through strict schemas; untrusted tool output must never become instructions.
4. Add human approval for externally visible or irreversible actions.
5. Add controlled GitHub writes on dedicated branches and pull requests.
6. Add isolated browser automation with explicit domain allowlists.
7. Connect ChatGPT through a documented API/MCP-compatible adapter.
8. Deploy to a separate Cloudflare Worker and run end-to-end smoke tests.

## Free-use reality

The code can be self-hosted without a software license fee. Model inference, hosting, browser infrastructure, and external APIs may have quotas or charges. Unlimited free operation cannot be promised.

## Security rules

- Never ask users to paste passwords, API keys, recovery codes, or private tokens into task instructions.
- Keep provider and connector credentials server-side.
- Treat web pages, repository files, and tool output as untrusted data, never as system instructions.
- Require confirmation before irreversible or externally visible actions.
- Log tool calls and results with secrets redacted.
- Use allowlists, strict input validation, request limits, and execution timeouts.
- Keep generated code inert until reviewed and tested in an isolated sandbox.

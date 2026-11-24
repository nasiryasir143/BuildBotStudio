# AI CEO Studio

A mobile-first multi-agent experiment. The dashboard and API are served by one Cloudflare Worker.

## Included agents
1. AI CEO — plans the task and produces the final report.
2. Research Agent — analyzes the request but does not have live web access.
3. Coding Agent — drafts code or implementation steps.
4. Review Agent — checks the proposal for defects and risks.
5. AI CEO — final summary.

## Deploy from a phone
1. In Cloudflare, open **Workers & Pages** and create a Worker named `ai-ceo-studio`.
2. Connect this GitHub repository and choose branch `ai-ceo-studio`, with the project root directory set to `ai-ceo-studio`. If the dashboard offers a Workers Builds / Git integration flow, use the repository connection and deploy from this folder.
3. Ensure the deployment uses the included `wrangler.toml`. The Worker needs the Workers AI binding named `AI`, as declared in that file.
4. In the Worker settings, add a secret named `APP_TOKEN`. Generate a long random value and keep it private. Do not put the value in GitHub or in the source code.
5. Deploy. Open the Worker URL. Paste the same secret into **Private access token** and press **Save token**.
6. Enter a test task and press **Start team**.

If Cloudflare's Git integration does not allow selecting this subfolder as the Worker root, use the Cloudflare dashboard's supported upload/deploy flow for this folder, or create a separate repository containing this folder. Do not deploy the whole BuildBotStudio repository as this Worker.

## Configuration
- Worker name: `ai-ceo-studio`
- Workers AI binding: `AI`
- Secret: `APP_TOKEN`
- Model variable: `AI_MODEL` (default is `@cf/meta/llama-3.1-8b-instruct`; change it to a model currently available in your Cloudflare account if needed)
- API: same-origin `/api/run`
- Health check: authenticated `/api/health`

## Important limits
- The five agent stages run sequentially in one web request. Keep the page open until the reports arrive.
- This is **not** a persistent background agent and will not continue a task after the request ends or your phone disconnects.
- Research has no live web browsing in this starter.
- It drafts code but does not run shell commands, edit GitHub files, test code, or deploy generated code.
- Workers AI model access, request limits, and free quotas depend on Cloudflare's current account terms. Free and unlimited usage is not guaranteed.
- Treat outputs as drafts. Review code and factual claims before using them.
- Never submit passwords, API keys, or private personal data as task content.

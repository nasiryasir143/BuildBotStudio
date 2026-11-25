# AI CEO Studio

A mobile-first multi-agent experiment. The dashboard and API are served by one Cloudflare Worker.

## Included agents
1. AI CEO — plans the task and produces the final report.
2. Research Agent — searches the public web for relevant pages and summarizes source links.
3. Coding Agent — drafts code or implementation steps.
4. Review Agent — checks the proposal for defects and risks.
5. AI CEO — final summary.

## Automatic deployment from GitHub
The repository includes `.github/workflows/deploy-ai-ceo-studio.yml`. It deploys this subfolder to Cloudflare when code is pushed to branch `ai-ceo-studio`, or when manually started from GitHub Actions.

Before the first deployment, add these three **GitHub Actions repository secrets** under **Settings → Secrets and variables → Actions → New repository secret**:

- `CLOUDFLARE_API_TOKEN` — a Cloudflare API token with permission to edit/deploy Workers.
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
- `APP_TOKEN` — a long random private access token used by the app itself.

Keep all three values private. Do not paste them into chat, commit them to the repository, or put them in source code. The workflow securely passes `APP_TOKEN` to the Worker as a Worker secret.

After adding the secrets:
1. Open the repository's **Actions** tab.
2. Select **Deploy AI CEO Studio**.
3. Press **Run workflow** and select branch `ai-ceo-studio`.
4. Wait for the run to finish successfully. The Cloudflare Worker URL will be shown in the deployment logs / Cloudflare dashboard.
5. Open that Worker URL, enter the same `APP_TOKEN` in **Private access token**, and press **Save token**.

Future changes pushed to `ai-ceo-studio` will deploy automatically.

## Configuration
- Worker name: `ai-ceo-studio`
- Workers AI binding: `AI`
- Secret: `APP_TOKEN` (injected by the GitHub Actions workflow)
- Model variable: `AI_MODEL` (default is `@cf/zai-org/glm-4.7-flash`).
- API: same-origin `/api/run`
- Health check: authenticated `/api/health`

## Important limits
- The five agent stages run sequentially in one web request. Keep the page open until the reports arrive.
- This is **not** a persistent background agent and will not continue a task after the request ends or your phone disconnects.
- Research Agent uses Cloudflare's Web Search API through the Workers AI binding. The provider is configurable as `ceramic`, `exa`, or `linkup`; the default is `ceramic`. Search is deliberately disabled by default (`WEB_SEARCH_ENABLED = "false"`) to prevent unexpected usage charges. To enable it, first confirm AI Gateway credits or a provider key are configured and that the account owner approves the applicable provider pricing, then set `WEB_SEARCH_ENABLED = "true"` in `wrangler.toml` or the Worker environment. Search requests are billed through AI Gateway credits or the configured provider key; this is not guaranteed to be free. `WEB_SEARCH_PROVIDER` selects the provider.
- Coding Agent drafts complete deliverables; Review Agent checks the draft but does not execute tests. The app does not run shell commands, edit GitHub files, or deploy generated project code.
- Workers AI model access, request limits, and free quotas depend on Cloudflare's current account terms. Free and unlimited usage is not guaranteed. Cloudflare Web Search is a separately billed beta service; check current provider pricing before enabling it.
- Treat outputs as drafts. Review code and factual claims before using them.
- Never submit passwords, API keys, or private personal data as task content.

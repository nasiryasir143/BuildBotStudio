# AI CEO Studio (mobile-first starter)

This is a test multi-agent workspace designed to be edited from a phone.

## Agents
- AI CEO: creates a plan and final report.
- Research Agent: analyzes the request without pretending to browse.
- Coding Agent: drafts code or implementation steps; does not execute/deploy.
- Review Agent: checks for defects, security risks, and missing requirements.

## Deploy
1. Create a Cloudflare Worker and add a Workers AI binding named AI.
2. Use worker.js as the Worker entry point.
3. Set AI_MODEL to a model currently available in your Cloudflare account.
4. Deploy the public/ folder as a Cloudflare Pages site.
5. Edit public/app.js and set API_URL to your Worker URL.

Workers AI quotas and model availability can change. This app does not promise unlimited free use.

## Safety and current limits
- This version runs the agent sequence during a single request; it is not a durable background job queue.
- It does not run shell commands, modify GitHub repositories, or deploy generated code.
- Review all generated code before using it.
- Do not submit passwords, API keys, or private data.
- Before public launch, add authentication, rate limits, and stricter CORS.

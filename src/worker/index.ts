import type { Env } from "./types";
import { createBuildPlan } from "./agent/planner";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "BuildBot Studio API",
        stage: "foundation",
        ai_configured: Boolean(env.AI && env.AI_MODEL)
      });
    }

    if (request.method === "POST" && url.pathname === "/api/plan") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Request body must be valid JSON." }, 400);
      }

      const instruction =
        typeof body === "object" && body !== null && "instruction" in body
          ? (body as { instruction?: unknown }).instruction
          : undefined;

      if (typeof instruction !== "string" || !instruction.trim()) {
        return json({ error: "Please provide an app instruction." }, 400);
      }
      if (instruction.length > 4000) {
        return json({ error: "Instruction must be 4,000 characters or fewer." }, 413);
      }

      try {
        const plan = await createBuildPlan(env, instruction.trim());
        return json({ ok: true, plan });
      } catch (error) {
        const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        if (code === "AI_PROVIDER_NOT_CONFIGURED" || code === "AI_MODEL_NOT_CONFIGURED") {
          return json({
            error: "The AI provider is not configured yet. The planning API is scaffolded, but AI generation is not active."
          }, 503);
        }
        return json({
          error: "The planning request could not be completed.",
          code
        }, 502);
      }
    }

    return json({ error: "Not found." }, 404);
  }
};

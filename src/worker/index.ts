import type { Env } from "./types";
import { createBuildPlan, generateStarterProject } from "./agent/planner";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function readInstruction(request: Request): Promise<string | Response> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return json({ error: "Request body must be valid JSON." }, 400); }

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
  return instruction.trim();
}

function providerError(error: unknown): Response {
  const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  if (code === "AI_PROVIDER_NOT_CONFIGURED" || code === "AI_MODEL_NOT_CONFIGURED") {
    return json({ error: "AI provider is not configured yet. Connect and configure the AI binding before using generation." }, 503);
  }
  if (code.startsWith("AI_")) {
    return json({ error: "The AI returned an invalid or oversized project response.", code }, 502);
  }
  return json({ error: "The AI request could not be completed.", code }, 502);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({
        ok: true,
        service: "BuildBot Studio API",
        stage: "starter-project-generation",
        ai_configured: Boolean(env.AI && env.AI_MODEL)
      });
    }

    if (request.method === "POST" && (url.pathname === "/api/plan" || url.pathname === "/api/generate")) {
      const instruction = await readInstruction(request);
      if (instruction instanceof Response) return instruction;

      try {
        if (url.pathname === "/api/plan") {
          const plan = await createBuildPlan(env, instruction);
          return json({ ok: true, plan });
        }
        const project = await generateStarterProject(env, instruction);
        return json({ ok: true, project });
      } catch (error) {
        return providerError(error);
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: "Not found." }, 404);
  }
};

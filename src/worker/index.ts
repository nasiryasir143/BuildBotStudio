import type { Env } from "./types";
import { createBuildPlan, generateStarterProject, reviseStarterProject } from "./agent/planner";

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

    if (request.method === "POST" && url.pathname === "/api/edit") {
      const contentLength = Number(request.headers.get("content-length") ?? 0);
      if (contentLength > 35000) return json({ error: "Project payload is too large." }, 413);
      let body: unknown;
      try { body = await request.json(); }
      catch { return json({ error: "Request body must be valid JSON." }, 400); }

      const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      const instruction = record.instruction;
      const files = record.files;
      if (typeof instruction !== "string" || !instruction.trim() || instruction.length > 4000) {
        return json({ error: "Provide an edit instruction of up to 4,000 characters." }, 400);
      }
      if (!Array.isArray(files) || files.length < 3 || files.length > 5) {
        return json({ error: "Provide the current starter project files." }, 400);
      }
      const allowed = new Set(["index.html", "styles.css", "app.js", "README.txt", "assets/notes.txt"]);
      let total = 0;
      const safeFiles: Array<{ path: string; content: string }> = [];
      for (const item of files) {
        if (typeof item !== "object" || item === null) return json({ error: "Invalid project file." }, 400);
        const file = item as Record<string, unknown>;
        if (typeof file.path !== "string" || !allowed.has(file.path) || typeof file.content !== "string" || file.content.length > 12000) {
          return json({ error: "Project contains an unsupported file or oversized content." }, 400);
        }
        total += file.content.length;
        safeFiles.push({ path: file.path, content: file.content });
      }
      if (total > 30000 || !["index.html", "styles.css", "app.js"].every(path => safeFiles.some(file => file.path === path))) {
        return json({ error: "Project files are incomplete or too large." }, 400);
      }
      try {
        const project = await reviseStarterProject(env, instruction.trim(), safeFiles);
        return json({ ok: true, project });
      } catch (error) {
        return providerError(error);
      }
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

import type { Env } from "./types";
import { createBuildPlan, generateStarterProject, reviseStarterProject } from "./agent/planner";

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function readJsonBody(request: Request, maxBytes: number): Promise<unknown | Response> {
  if (!request.body) return json({ error: "Request body is required." }, 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return json({ error: "Request body is too large." }, 413);
      }
      chunks.push(value);
    }
  } catch {
    return json({ error: "Could not read request body." }, 400);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return json({ error: "Request body must be valid JSON." }, 400);
  }
}

async function readInstruction(request: Request): Promise<string | Response> {
  const body = await readJsonBody(request, 12000);
  if (body instanceof Response) return body;
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
    return json({ error: "AI provider is not configured yet. Configure the AI binding before using generation." }, 503);
  }
  if (code.startsWith("AI_") || error instanceof SyntaxError) {
    return json({ error: "The AI returned an invalid or oversized response. Please try a shorter or simpler request." }, 502);
  }
  return json({ error: "The AI request could not be completed. Please try again later." }, 502);
}

async function hasValidAccessKey(request: Request, env: Env): Promise<boolean> {
  const expected = env.APP_ACCESS_KEY;
  const supplied = request.headers.get("x-app-access-key") ?? "";
  if (!expected || !supplied || expected.length > 256 || supplied.length > 256) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(supplied))
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0 && expected === supplied;
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("x-frame-options", "DENY");
  headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;

    if (request.method === "GET" && url.pathname === "/api/health") {
      response = json({
        ok: true,
        service: "BuildBot Studio API",
        stage: "local-project-workspace",
        ai_configured: Boolean(env.AI && env.AI_MODEL)
      });
      return withSecurityHeaders(response);
    }

    if (request.method === "POST" && ["/api/edit", "/api/plan", "/api/generate"].includes(url.pathname)) {
      if (!env.APP_ACCESS_KEY) {
        return withSecurityHeaders(json({ error: "Workspace is locked until the owner configures the APP_ACCESS_KEY secret in Worker settings." }, 503));
      }
      if (!(await hasValidAccessKey(request, env))) {
        return withSecurityHeaders(json({ error: "Access key required or incorrect." }, 401));
      }
    }

    if (request.method === "POST" && url.pathname === "/api/edit") {
      const body = await readJsonBody(request, 35000);
      if (body instanceof Response) return withSecurityHeaders(body);
      const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      const instruction = record.instruction;
      const files = record.files;
      if (typeof instruction !== "string" || !instruction.trim() || instruction.length > 4000) {
        return withSecurityHeaders(json({ error: "Provide an edit instruction of up to 4,000 characters." }, 400));
      }
      if (!Array.isArray(files) || files.length < 3 || files.length > 5) {
        return withSecurityHeaders(json({ error: "Provide the current starter project files." }, 400));
      }
      const allowed = new Set(["index.html", "styles.css", "app.js", "README.txt", "assets/notes.txt"]);
      let total = 0;
      const safeFiles: Array<{ path: string; content: string }> = [];
      for (const item of files) {
        if (typeof item !== "object" || item === null) return withSecurityHeaders(json({ error: "Invalid project file." }, 400));
        const file = item as Record<string, unknown>;
        if (typeof file.path !== "string" || !allowed.has(file.path) || typeof file.content !== "string" || file.content.length > 12000) {
          return withSecurityHeaders(json({ error: "Project contains an unsupported file or oversized content." }, 400));
        }
        total += file.content.length;
        safeFiles.push({ path: file.path, content: file.content });
      }
      if (total > 30000 || !["index.html", "styles.css", "app.js"].every(path => safeFiles.some(file => file.path === path))) {
        return withSecurityHeaders(json({ error: "Project files are incomplete or too large." }, 400));
      }
      try {
        const project = await reviseStarterProject(env, instruction.trim(), safeFiles);
        return withSecurityHeaders(json({ ok: true, project }));
      } catch (error) {
        return withSecurityHeaders(providerError(error));
      }
    }

    if (request.method === "POST" && (url.pathname === "/api/plan" || url.pathname === "/api/generate")) {
      const instruction = await readInstruction(request);
      if (instruction instanceof Response) return withSecurityHeaders(instruction);
      try {
        if (url.pathname === "/api/plan") {
          const plan = await createBuildPlan(env, instruction);
          return withSecurityHeaders(json({ ok: true, plan }));
        }
        const project = await generateStarterProject(env, instruction);
        return withSecurityHeaders(json({ ok: true, project }));
      } catch (error) {
        return withSecurityHeaders(providerError(error));
      }
    }

    if (env.ASSETS) {
      response = await env.ASSETS.fetch(request);
    } else {
      response = json({ error: "Not found." }, 404);
    }
    return withSecurityHeaders(response);
  }
};

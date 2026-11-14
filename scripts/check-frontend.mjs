import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync("public/index.html", "utf8");
const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (inlineScripts.length !== 1) {
  throw new Error(\`Expected one inline workspace script, found \${inlineScripts.length}.\`);
}
new Script(inlineScripts[0][1], { filename: "public/index.html:inline-script" });
new Script(readFileSync("public/access.js", "utf8"), { filename: "public/access.js" });

if (!html.includes('<script src="/access.js" defer></script>')) {
  throw new Error("Workspace is missing the access-key helper.");
}
const provider = readFileSync("src/worker/providers/cloudflare-ai.ts", "utf8");
if (!provider.includes("MUST link to styles.css") || !provider.includes("relative deferred script tag")) {
  throw new Error("Generated starter prompt is missing required asset links.");
}

const worker = readFileSync("src/worker/index.ts", "utf8");
const registry = readFileSync("src/worker/agent/tool-registry.ts", "utf8");
const runner = readFileSync("src/worker/agent/task-runner.ts", "utf8");
const github = readFileSync("src/worker/agent/github-read.ts", "utf8");
if (!worker.includes("/api/agent/capabilities") || !worker.includes("getAgentCapabilities")) {
  throw new Error("Agent capabilities endpoint is not wired.");
}
for (const route of ["/api/agent/github/tree", "/api/agent/github/file"]) {
  if (!worker.includes(route)) throw new Error(\`Missing protected GitHub read endpoint: \${route}\`);
}
if (!worker.includes('"/api/agent/github/tree", "/api/agent/github/file"')) {
  throw new Error("GitHub read endpoints are not protected by the workspace access key.");
}
if (!registry.includes('executionEnabled: false') || !registry.includes('status: "disabled"')) {
  throw new Error("Agent write capabilities must remain disabled.");
}
if (!registry.includes('id: "github.repository.read"') || !registry.includes('status: "available"')) {
  throw new Error("Public GitHub read-only capability is not marked available.");
}
if (!runner.includes("execution_enabled: false") || !runner.includes("getAgentCapabilities()")) {
  throw new Error("Agent task runner must remain bounded and report capabilities.");
}
for (const safetyRule of ["validOwner", "validRepo", "validRef", "validFilePath", "GITHUB_FILE_TOO_LARGE", "TextDecoder"]) {
  if (!github.includes(safetyRule)) throw new Error(\`Missing GitHub adapter safety rule: \${safetyRule}\`);
}
if (github.includes("Authorization:")) {
  throw new Error("Public read-only adapter must not contain a hard-coded credential.");
}
console.log("Frontend syntax, GitHub read-only adapter, and agent safety checks passed.");

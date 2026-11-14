import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync("public/index.html", "utf8");
const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (inlineScripts.length !== 1) throw new Error("Expected one inline workspace script.");
new Script(inlineScripts[0][1], { filename: "public/index.html:inline-script" });
new Script(readFileSync("public/access.js", "utf8"), { filename: "public/access.js" });
if (!html.includes('<script src="/access.js" defer></script>')) throw new Error("Missing access-key helper.");

const provider = readFileSync("src/worker/providers/cloudflare-ai.ts", "utf8");
if (!provider.includes("MUST link to styles.css") || !provider.includes("relative deferred script tag")) throw new Error("Starter prompt missing asset links.");

const worker = readFileSync("src/worker/index.ts", "utf8");
const registry = readFileSync("src/worker/agent/tool-registry.ts", "utf8");
const runner = readFileSync("src/worker/agent/task-runner.ts", "utf8");
const github = readFileSync("src/worker/agent/github-read.ts", "utf8");
if (!worker.includes("/api/agent/capabilities") || !worker.includes("getAgentCapabilities")) throw new Error("Capabilities endpoint missing.");
if (!worker.includes("/api/agent/tool") || !worker.includes("runAgentTool(body)")) throw new Error("Explicit tool execution endpoint missing.");
if (!worker.includes('"/api/agent/tool"')) throw new Error("Tool execution route is not access-key protected.");
if (!registry.includes('id: "github.repository.read"') || !registry.includes('status: "available"')) throw new Error("Public GitHub read tool missing.");
for (const disabledTool of ['id: "github.repository.write"', 'id: "cloudflare.deploy"']) {
  if (!registry.includes(disabledTool)) throw new Error("Missing write capability declaration: " + disabledTool);
}
if (!registry.includes('status: "disabled"') || !registry.includes("autonomousPlanningExecution: false")) throw new Error("Write or autonomous execution safety gate missing.");
if (!runner.includes('record.tool !== "github.repository.read"') || !runner.includes('operation !== "tree" && operation !== "file"')) throw new Error("Tool allowlist validation missing.");
for (const safetyRule of ["validOwner", "validRepo", "validRef", "validFilePath", "GITHUB_FILE_TOO_LARGE", "TextDecoder"]) {
  if (!github.includes(safetyRule)) throw new Error("Missing GitHub adapter safety rule: " + safetyRule);
}
if (github.includes("Authorization:")) throw new Error("Public GitHub reader must not contain credentials.");
console.log("Frontend syntax, explicit tool execution, and agent safety checks passed.");

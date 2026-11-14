import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync("public/index.html", "utf8");
const inlineScripts = [...html.matchAll(/<script\\b(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi)];
if (inlineScripts.length !== 1) {
  throw new Error(`Expected one inline workspace script, found ${inlineScripts.length}.`);
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
if (!worker.includes("/api/agent/capabilities") || !worker.includes("getAgentCapabilities")) {
  throw new Error("Agent capabilities endpoint is not wired.");
}
if (!registry.includes('executionEnabled: false') || !registry.includes('status: "disabled"')) {
  throw new Error("Agent write capabilities must remain disabled.");
}
if (!runner.includes("execution_enabled: false") || !runner.includes("getAgentCapabilities()")) {
  throw new Error("Agent task runner must remain plan-only and report capabilities.");
}
console.log("Frontend syntax, workspace integration, and agent safety checks passed.");

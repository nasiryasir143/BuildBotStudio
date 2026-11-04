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
console.log("Frontend JavaScript syntax and workspace integration checks passed.");

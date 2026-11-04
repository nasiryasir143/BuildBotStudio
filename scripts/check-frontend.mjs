import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync("public/index.html", "utf8");
const inlineScripts = [...html.matchAll(/<script\\b(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi)];
if (inlineScripts.length !== 1) {
  throw new Error(`Expected one inline workspace script, found ${inlineScripts.length}.`);
}
new Script(inlineScripts[0][1], { filename: "public/index.html:inline-script" });
new Script(readFileSync("public/access.js", "utf8"), { filename: "public/access.js" });

for (const required of ["index.html", "styles.css", "app.js"]) {
  if (!html.includes("BuildBot Studio")) throw new Error("Workspace HTML is missing its title.");
}
console.log("Frontend JavaScript syntax checks passed.");

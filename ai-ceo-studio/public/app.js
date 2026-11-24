// After deploying the Worker, paste its HTTPS URL below.
const API_URL = "PASTE_YOUR_WORKER_URL_HERE";
const runButton = document.querySelector("#run");
const taskInput = document.querySelector("#task");
const statusLine = document.querySelector("#status");
const outputs = document.querySelector("#outputs");

function markDone(name) {
  const card = [...document.querySelectorAll(".agent")].find(x => x.dataset.agent === name);
  if (card) { card.classList.add("done"); card.querySelector("i").textContent = "Complete"; }
}
function showReport(name, text) {
  const article = document.createElement("article"); article.className = "report";
  const h = document.createElement("h4"); h.textContent = name;
  const pre = document.createElement("pre"); pre.textContent = text || "";
  article.append(h, pre); outputs.append(article);
}
runButton.addEventListener("click", async () => {
  const task = taskInput.value.trim();
  if (!task) { statusLine.textContent = "Please enter a task."; return; }
  if (!API_URL.startsWith("https://")) { statusLine.textContent = "Setup needed: add your deployed Worker URL in public/app.js."; return; }
  runButton.disabled = true; runButton.textContent = "Team working…";
  statusLine.textContent = "Working. Keep this page open until the reports arrive.";
  outputs.replaceChildren();
  document.querySelectorAll(".agent").forEach(x => { x.classList.remove("done"); x.querySelector("i").textContent = "Ready"; });
  try {
    const response = await fetch(API_URL, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({task})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Worker request failed.");
    for (const report of data.reports || []) { markDone(report.agent); showReport(report.agent, report.output); }
    statusLine.textContent = "Finished with " + data.model + ". Review all suggestions before using them.";
  } catch (e) {
    statusLine.textContent = "Could not finish: " + e.message;
    outputs.innerHTML = '<div class="empty">No reports received. Check the Worker URL, AI binding, and quota.</div>';
  } finally { runButton.disabled = false; runButton.textContent = "Start team"; }
});

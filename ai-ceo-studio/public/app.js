const API_URL = "/api/run";
const runButton = document.querySelector("#run");
const taskInput = document.querySelector("#task");
const statusLine = document.querySelector("#status");
const outputs = document.querySelector("#outputs");
const tokenInput = document.querySelector("#access-token");
const saveTokenButton = document.querySelector("#save-token");

tokenInput.value = sessionStorage.getItem("ai_ceo_token") || "";

saveTokenButton.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  if (!token) {
    sessionStorage.removeItem("ai_ceo_token");
    statusLine.textContent = "Access token cleared from this tab.";
    return;
  }
  sessionStorage.setItem("ai_ceo_token", token);
  statusLine.textContent = "Token saved for this browser tab. You can now start a task.";
});

function markDone(name) {
  const card = [...document.querySelectorAll(".agent")].find(x => x.dataset.agent === name);
  if (card) {
    card.classList.add("done");
    card.querySelector("i").textContent = "Complete";
  }
}

function showReport(name, text) {
  const article = document.createElement("article");
  article.className = "report";
  const h = document.createElement("h4");
  h.textContent = name;
  const pre = document.createElement("pre");
  pre.textContent = text || "";
  article.append(h, pre);
  outputs.append(article);
}

runButton.addEventListener("click", async () => {
  const task = taskInput.value.trim();
  const token = sessionStorage.getItem("ai_ceo_token") || tokenInput.value.trim();
  if (!token) {
    statusLine.textContent = "Enter your Cloudflare APP_TOKEN and press Save token first.";
    tokenInput.focus();
    return;
  }
  if (!task) {
    statusLine.textContent = "Please enter a task.";
    return;
  }

  runButton.disabled = true;
  runButton.textContent = "Team working…";
  statusLine.textContent = "Working. Keep this page open until the reports arrive.";
  outputs.replaceChildren();
  document.querySelectorAll(".agent").forEach(x => {
    x.classList.remove("done");
    x.querySelector("i").textContent = "Ready";
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      },
      body: JSON.stringify({ task })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Worker request failed.");
    for (const report of data.reports || []) {
      markDone(report.agent);
      showReport(report.agent, report.output);
    }
    statusLine.textContent = "Finished with " + data.model + ". Web research: " + (data.liveResearch?.sourceCount ?? 0) + " sources. Review suggestions before using them.";
  } catch (error) {
    statusLine.textContent = "Could not finish: " + error.message;
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No reports received. Check the token, AI binding, model availability, and quota.";
    outputs.replaceChildren(empty);
  } finally {
    runButton.disabled = false;
    runButton.textContent = "Start team";
  }
});

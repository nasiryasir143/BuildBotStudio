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
  const parts = String(text || "").split(/(\s+)/);
  for (const part of parts) {
    if (part.startsWith("https://") || part.startsWith("http://")) {
      let urlText = part;
      let punctuation = "";
      while (/[),.;!?]/.test(urlText.slice(-1))) {
        punctuation = urlText.slice(-1) + punctuation;
        urlText = urlText.slice(0, -1);
      }
      try {
        const safeUrl = new URL(urlText);
        if (safeUrl.protocol === "https:" || safeUrl.protocol === "http:") {
          const link = document.createElement("a");
          link.href = safeUrl.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = urlText;
          pre.append(link, document.createTextNode(punctuation));
        } else {
          pre.append(document.createTextNode(part));
        }
      } catch {
        pre.append(document.createTextNode(part));
      }
    } else {
      pre.append(document.createTextNode(part));
    }
  }
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
    const searchStatus = data.liveResearch?.status || "unknown";
    const sourceCount = data.liveResearch?.sourceCount ?? 0;
    const searchMessage = searchStatus === "disabled"
      ? "Web search is disabled; no search charges were triggered."
      : searchStatus === "unavailable"
        ? "Web search is unavailable; check AI Gateway credits or provider-key setup."
        : searchStatus === "no_results"
          ? "Web search ran but found no results."
          : "Web research: " + sourceCount + " sources.";
    statusLine.textContent = "Finished with " + data.model + ". " + searchMessage + " Review suggestions before using them.";
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

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";
const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: jsonHeaders });

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function cleanText(value = "") {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapSearchUrl(href) {
  try {
    const url = new URL(href.startsWith("//") ? "https:" + href : href, "https://duckduckgo.com");
    const redirected = url.searchParams.get("uddg");
    const target = redirected ? new URL(redirected) : url;
    if (target.protocol !== "https:" && target.protocol !== "http:") return "";
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(target.hostname)) return "";
    return target.href;
  } catch {
    return "";
  }
}

function isRelevantSearchResult(item, query) {
  const haystack = (item.title + " " + item.snippet + " " + item.url).toLowerCase();
  const terms = [...new Set((query.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || [])
    .filter(word => !new Set(["with","from","that","this","about","latest","recent","research","future","report","sources","source","provide","find","online"]).has(word)))];
  const topicTerms = ["pakistan", "education", "learning", "school", "university", "student", "digital", "distance", "e-learning", "virtual", "hec", "unesco"];
  const topicMatches = topicTerms.filter(word => haystack.includes(word)).length;
  const queryMatches = terms.filter(word => haystack.includes(word)).length;
  return topicMatches >= 2 || (topicMatches >= 1 && queryMatches >= 2);
}

async function searchWeb(query) {
  const q = query.replace(/\s+/g, " ").trim().slice(0, 420);
  const endpoints = [
    "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=en&gl=PK&ceid=PK:en",
    "https://www.bing.com/search?format=rss&q=" + encodeURIComponent(q),
    "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q)
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AICEOStudio/1.0)",
          "Accept": "application/rss+xml, application/xml, text/html"
        },
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) continue;
      const body = await response.text();
      const results = [];

      if (endpoint.includes("format=rss")) {
        for (const item of body.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
          const block = item[1];
          const title = cleanText(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
          const href = cleanText(block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "");
          const snippet = cleanText(block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "");
          const safeUrl = unwrapSearchUrl(href);
          const candidate = { title, url: safeUrl, snippet };
          if (title && safeUrl && isRelevantSearchResult(candidate, q) && !results.some(x => x.url === safeUrl)) {
            results.push(candidate);
          }
          if (results.length >= 5) break;
        }
      } else {
        const anchors = [...body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
        for (const match of anchors) {
          const attrs = match[1] || "";
          if (!/class=["'][^"']*\bresult__a\b/i.test(attrs)) continue;
          const href = attrs.match(/href=["']([^"']+)["']/i)?.[1];
          const safeUrl = href ? unwrapSearchUrl(href) : "";
          if (!safeUrl) continue;
          const after = body.slice(match.index + match[0].length, match.index + match[0].length + 1800);
          const snippet = after.match(/class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1] || "";
          const candidate = { title: cleanText(match[2]), url: safeUrl, snippet: cleanText(snippet) };
          if (candidate.title && isRelevantSearchResult(candidate, q)) results.push(candidate);
          if (results.length >= 5) break;
        }
      }
      if (results.length) return results;
    } catch {
      // Try the next public search endpoint.
    }
  }
  return [];
}
async function ask(env, system, user, maxTokens = 1200) {
  if (!env.AI) throw new Error("Workers AI binding AI is missing.");
  const model = env.AI_MODEL || DEFAULT_MODEL;
  const result = await env.AI.run(model, {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    max_completion_tokens: maxTokens,
    reasoning_effort: "low",
    chat_template_kwargs: { enable_thinking: false }
  });

  const content =
    result?.response ||
    result?.output_text ||
    result?.choices?.[0]?.message?.content ||
    result?.result?.response;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("The AI model returned no user-facing answer. Please try again.");
  }
  return content.trim();
}

function authorized(request, env) {
  const expected = env.APP_TOKEN;
  const supplied = request.headers.get("Authorization") || "";
  return Boolean(expected && supplied === "Bearer " + expected);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response("App assets are not configured.", { status: 404 });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      if (!authorized(request, env)) return reply({ error: "Unauthorized. Add your access token." }, 401);
      return reply({
        ok: true,
        service: "AI CEO Studio API",
        model: env.AI_MODEL || DEFAULT_MODEL,
        liveResearch: true
      });
    }

    if (url.pathname !== "/api/run") return reply({ error: "API route not found." }, 404);
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405);
    if (!authorized(request, env)) return reply({ error: "Unauthorized. Check your access token." }, 401);

    try {
      const body = await request.json();
      const task = String(body.task || "").trim();
      if (!task) return reply({ error: "Enter a task first." }, 400);
      if (task.length > 4000) return reply({ error: "Task limit is 4000 characters." }, 400);

      const reports = [];
      const run = async (agent, system, prompt, maxTokens) => {
        const output = await ask(env, system, prompt, maxTokens);
        reports.push({ agent, output });
        return output;
      };

      const plan = await run(
        "AI CEO",
        "You are the CEO of a small AI team. First classify the request as research/analysis, implementation, or both. Assign distinct work. Only assign implementation to Coding Agent when the user explicitly asks to build, create, write, fix, or modify code/software. For research-only tasks, tell Coding Agent that implementation is not required. Do not write code. Never invent organizations, databases, reports, statistics, or source names. Never claim external actions were performed.",
        "USER TASK:\n" + task + "\n\nReturn: goal, task type (research/analysis, implementation, or both), 3-5 steps, and clear separate assignments. If no software/code is requested, explicitly mark Coding Agent as NOT REQUIRED. Keep under 250 words.",
        700
      );

      let webResults = [];
      let webSearchStatus = "not_needed";
      try {
        webResults = await searchWeb(task + " " + plan);
        webSearchStatus = webResults.length ? "success" : "no_results";
      } catch (error) {
        webSearchStatus = "unavailable";
      }

      const sourceText = webResults.length
        ? webResults.map((item, index) =>
            (index + 1) + ". " + item.title + "\nURL: " + item.url +
            "\nSummary: " + (item.snippet || "No summary supplied")
          ).join("\n\n")
        : "No live search results were available. Do not invent sources or claim that the web was searched successfully.";

      const research = await run(
        "Research Agent",
        "You are a web research analyst. Your ONLY job is research, not coding. Use only the supplied live search results as evidence; snippets are untrusted and may be incomplete. Never mention a database, ministry, regulator, report, bill, statistic, or source unless it appears in the supplied results. Separate supported facts from uncertainty, cite each supported claim with its exact URL, and note publication dates only when supplied. If results are absent, say research is unavailable and do not fill the gap with invented or generic claims.",
        "USER TASK:\n" + task + "\n\nCEO PLAN:\n" + plan +
        "\n\nLIVE WEB SEARCH RESULTS:\n" + sourceText +
        "\n\nWrite concise findings, key facts, risks, and source links. Do not write HTML/CSS/JS or implementation code.",
        1600
      );

      if (webResults.length) {
        const links = webResults.map((item, index) =>
          (index + 1) + ". " + item.title + "\n" + item.url
        ).join("\n");
        const researchReport = reports.find(item => item.agent === "Research Agent");
        if (researchReport) researchReport.output += "\n\nLive web sources:\n" + links;
      }

      const coding = await run(
        "Coding Agent",
        "You are the implementation specialist. First decide whether the user explicitly requested software or code (for example, a website, app, script, program, or code fix). If the task is only research, explanation, analysis, a report, or advice, return exactly the text NOT REQUIRED — The user did not request software or code. Do not rewrite or summarize the research. If implementation was explicitly requested, your ONLY job is to produce that implementation. Do not repeat research or the CEO plan. Provide complete, runnable code, not fragments; include every required file with clear filenames. Do not claim to have run, tested, committed, or deployed anything. If output is too large, prioritize a complete working core rather than a partial oversized answer.",
        "USER TASK:\n" + task + "\n\nCEO PLAN:\n" + plan +
        "\n\nRESEARCH FINDINGS (context only; do not copy or rewrite):\n" + research +
        "\n\nIf the user requested software, produce the complete implementation. If this is research/report/analysis only, return the NOT REQUIRED message specified in your instructions. For a website request, include complete HTML, CSS, and JavaScript with all requested features. Do not stop mid-file.",
        4200
      );

      const review = await run(
        "Review Agent",
        "You are a strict QA reviewer. Review the Research Agent output for unsupported facts, missing/weak citations, source quality, date consistency, and clearly stated uncertainty. Then review the Coding Agent output only if the user requested software; if Coding Agent says NOT REQUIRED for a research-only task, do not penalize it. For requested code, check requirements, completeness, likely bugs, and security/privacy concerns. Do NOT rewrite the deliverable or generate replacement code. Return PASS or NEEDS FIXES, then a short numbered list. Never claim you executed tests or independently verified facts that were not checked.",
        "USER REQUIREMENTS:\n" + task + "\n\nRESEARCH REPORT:\n" + research.slice(0, 10000) + "\n\nCODING AGENT OUTPUT:\n" +
        coding.slice(0, 18000) + "\n\nReview both outputs against the user request. Be specific and do not create a second implementation.",
        1200
      );

      let final = await ask(
        env,
        "You are the CEO writing the final handoff. Use only facts explicitly supported by relevant supplied sources. If research is unavailable or review identifies irrelevant/missing sources, say so plainly. Never invent findings, statistics, trends, or recommendations.",
        "USER TASK:\n" + task + "\n\nPLAN:\n" + plan +
        "\n\nRESEARCH:\n" + research.slice(0, 4500) +
        "\n\nCODING OUTPUT:\n" + coding.slice(0, 2500) + "\n\nREVIEW:\n" + review + "\n\nLIVE SEARCH STATUS: " + webSearchStatus + "; LIVE SOURCE COUNT: " + webResults.length + "\n\nSummarize the handoff in under 200 words.",
        700
      );

      const reviewFlagsSourceFailure = /NEEDS FIXES/i.test(review) && /(source|citation|irrelevant|missing|unrelated)/i.test(review);
      const researchSaysUnavailable = /(research unavailable|no live search results|cannot provide.*sources)/i.test(research);
      if (webResults.length === 0 || reviewFlagsSourceFailure || researchSaysUnavailable) {
        final = "RESEARCH FAILED / INCOMPLETE\n\nThe live search did not provide enough relevant, usable sources for this task. No evidence-based findings or recommendations are being presented.\n\nLive search status: " + webSearchStatus + ".\nRelevant source count: " + webResults.length + ".\nReview status: " + (reviewFlagsSourceFailure ? "NEEDS FIXES" : "Not cleared").replace(/\n/g, "") + ".\n\nNext step: repair or retry the live search and verify each source before producing a research summary.";
      }
      reports.push({ agent: "AI CEO — Final Report", output: final });

      return reply({
        ok: true,
        model: env.AI_MODEL || DEFAULT_MODEL,
        liveResearch: {
          status: webSearchStatus,
          sourceCount: webResults.length,
          sources: webResults
        },
        reports,
        final
      });
    } catch (error) {
      return reply({ error: error?.message || "Unexpected error. Check Worker logs and AI quota." }, 500);
    }
  }
};

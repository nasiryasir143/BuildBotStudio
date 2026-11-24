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

async function searchWeb(query) {
  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query.slice(0, 300));
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AICEOStudio/1.0)",
      "Accept": "text/html"
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Web search returned HTTP " + response.status);
  const html = await response.text();
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const results = [];

  for (const match of anchors) {
    const attributes = match[1] || "";
    if (!/class=["'][^"']*\bresult__a\b/i.test(attributes)) continue;
    const hrefMatch = attributes.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;
    const resultUrl = unwrapSearchUrl(hrefMatch[1]);
    if (!resultUrl) continue;

    const after = html.slice(match.index + match[0].length, match.index + match[0].length + 1800);
    const snippetMatch = after.match(/class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    results.push({
      title: cleanText(match[2]),
      url: resultUrl,
      snippet: cleanText(snippetMatch?.[1] || "")
    });
    if (results.length >= 5) break;
  }
  return results;
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
        "You are the CEO of a small AI team. Make a concise plan and assign distinct work. Do not write code. Never claim external actions were performed.",
        "USER TASK:\n" + task + "\n\nReturn: goal, 3-5 steps, and clear assignments for Research, Coding, and Review. Keep under 250 words.",
        700
      );

      let webResults = [];
      let webSearchStatus = "not_needed";
      try {
        webResults = await searchWeb(task);
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
        "You are a web research analyst. Your ONLY job is research, not coding. Use the supplied live search results. Separate verified facts from assumptions, compare relevant sources, note dates when available, and cite source URLs inline. Never invent facts or sources. If results are absent, say so clearly and give research questions that still need checking.",
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
        "You are the implementation specialist. Your ONLY job is to produce the requested deliverable. Do not repeat research or the CEO plan. If code is requested, provide complete, runnable code, not fragments; include every required file with clear filenames. Do not claim to have run, tested, committed, or deployed anything. If output is too large, prioritize a complete working core rather than a partial oversized answer.",
        "USER TASK:\n" + task + "\n\nCEO PLAN:\n" + plan +
        "\n\nRESEARCH FINDINGS:\n" + research +
        "\n\nNow produce the actual deliverable. For a website request, include complete HTML, CSS, and JavaScript with all requested features. Do not stop mid-file.",
        4200
      );

      const review = await run(
        "Review Agent",
        "You are a strict QA reviewer. Do NOT rewrite the deliverable and do NOT generate replacement code. Check only whether the Coding Agent fulfilled the user's requirements, identify concrete bugs, security/privacy concerns, missing features, and unverified claims. Return PASS or NEEDS FIXES, then a short numbered list. Never claim you executed tests.",
        "USER REQUIREMENTS:\n" + task + "\n\nPROPOSED DELIVERABLE:\n" +
        coding.slice(0, 18000) + "\n\nReview against the requirements. Be specific and do not create a second implementation.",
        1200
      );

      const final = await run(
        "AI CEO — Final Report",
        "You are the CEO writing the final handoff. Do not reproduce the code or repeat every agent report. State what the team produced, the review status, limitations, and one next step. Clearly distinguish generated output from anything actually tested or deployed.",
        "USER TASK:\n" + task + "\n\nPLAN:\n" + plan +
        "\n\nRESEARCH:\n" + research.slice(0, 4500) +
        "\n\nREVIEW:\n" + review + "\n\nSummarize the handoff in under 200 words.",
        700
      );

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

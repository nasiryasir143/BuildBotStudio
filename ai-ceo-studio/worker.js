import { searchWeb } from "./worker/agent/web-search.js";

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
    .replace(/&#(\d+);/g, (_, n) => {
      const point = Number(n);
      return point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : " ";
    });
}

function cleanText(value = "") {
  return decodeHtml(value
    .replace(/^<!\[CDATA\[/i, "")
    .replace(/\]\]>$/i, "")
    .replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function taskLanguage(task = "") {
  return /[\u0600-\u06FF]/.test(task) ? "Urdu" : "English";
}
function isSafePublicUrl(raw) {
  try {
    const u = new URL(raw), h = u.hostname.toLowerCase();
    if (!["https:","http:"].includes(u.protocol) || u.username || u.password) return false;
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return false;
    // Do not request literal IP addresses or IPv6 hosts from untrusted search results.
    if (h.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(h) || !h.includes(".")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(h)) return false;
    return true;
  } catch { return false; }
}
async function readLimitedText(response, maxBytes = 120000) {
  if (!response.body) return "";
  const reader=response.body.getReader(), decoder=new TextDecoder();
  let output="", total=0;
  while(total<maxBytes) {
    const {value,done}=await reader.read(); if(done) break;
    const chunk=value.slice(0,Math.max(0,maxBytes-total)); total+=chunk.byteLength;
    output+=decoder.decode(chunk,{stream:true});
    if(total>=maxBytes){await reader.cancel();break;}
  }
  return output+decoder.decode();
}
async function inspectSource(item) {
  const checked={...item,linkStatus:"not_checked",httpStatus:null,finalUrl:item.url,pageTitle:"",publishedDate:item.publishedDate || ""};
  if(!isSafePublicUrl(item.url)){checked.linkStatus="unsafe_or_invalid_url";return checked;}
  try {
    const response=await fetch(item.url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; AICEOStudio/1.0)","Accept":"text/html,application/pdf,application/xml,text/plain,*/*"},redirect:"manual",signal:AbortSignal.timeout(10000)});
    checked.httpStatus=response.status; checked.finalUrl=response.url||item.url;
    if (response.status >= 300 && response.status < 400) {
      checked.linkStatus = "redirect_not_followed";
      return checked;
    }
    checked.linkStatus=response.ok?"working":"broken";
    const type=response.headers.get("content-type")||"";
    if(response.ok&&/(text\/html|application\/xml|text\/xml|text\/plain)/i.test(type)){
      const html=await readLimitedText(response);
      checked.pageTitle=cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
      const dm=html.match(/(?:article:published_time|datePublished|citation_publication_date|DC\.date)\s*["'=:\s]+([0-9]{4}-[0-9]{2}-[0-9]{2}(?:T[0-9:.+Z-]+)?)/i)||html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
      if(dm) checked.publishedDate=dm[1].slice(0,40);
    }
  } catch {checked.linkStatus="unreachable";}
  return checked;
}

function buildSearchQueries(task, baseQuery) {
  const query = String(baseQuery || "").replace(/\s+/g, " ").trim().slice(0, 420);
  return query ? [query] : [];
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
        liveResearch: { enabled: env.WEB_SEARCH_ENABLED === "true", provider: env.WEB_SEARCH_PROVIDER || "ceramic" }
      });
    }

    if (url.pathname !== "/api/run") return reply({ error: "API route not found." }, 404);
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405);
    if (!authorized(request, env)) return reply({ error: "Unauthorized. Check your access token." }, 401);

    try {
      let body;
      try {
        body = await request.json();
      } catch {
        return reply({ error: "Request body must be valid JSON." }, 400);
      }
      const task = String(body.task || "").trim();
      if (!task) return reply({ error: "Enter a task first." }, 400);
      if (task.length > 4000) return reply({ error: "Task limit is 4000 characters." }, 400);

      const reports = [];
      const run = async (agent, system, prompt, maxTokens) => {
        const output = await ask(env, system, prompt, maxTokens);
        reports.push({ agent, output });
        return output;
      };

      const language = taskLanguage(task);
      const plan = await run(
        "AI CEO",
        "You are the AI CEO coordinating the team. Reply in natural Pakistani Urdu script when the task is Urdu, otherwise English. Preserve the user's exact goal, scope, named entities, dates, language, and requested deliverables. Do not expand the task or invent requirements, organizations, people, tools, websites, meetings, documents, statistics, or actions. Use only these exact role names: AI CEO, Research Agent, Coding Agent, Review Agent, AI CEO Final Report. Give a concise, grammatically correct plan. Research Agent researches only what the user asked. Coding Agent works only when software/code is explicitly requested; otherwise state NOT REQUIRED. Review Agent checks only explicit user requirements and evidence. The final report must answer the user's task, not merely repeat the plan.",
        "USER TASK:\n" + task + "\n\nReturn goal, task type, 3-5 steps, and separate assignments. Preserve named requirements such as HEC or UNSC if present. Write in " + language + " and keep under 250 words.",
        700
      );

      let webResults = [];
      let webSearchStatus = env.WEB_SEARCH_ENABLED === "true" ? "unavailable" : "disabled";
      let webSearchError = "";
      if (env.WEB_SEARCH_ENABLED === "true") {
        try {
          const searchBrief = await ask(
            env,
            "Convert the user's request into one concise English web search query. Preserve the exact country, subject, named institutions, and requested date range. Do not answer the request. Output only the search query, with no quotes or explanation.",
            task,
            180
          );
          const queries = buildSearchQueries(task, searchBrief.replace(/^["']|["']$/g, "").trim().slice(0, 420));
          const attempts = await Promise.allSettled(
            queries.map(query => searchWeb(env, query, { provider: env.WEB_SEARCH_PROVIDER || "ceramic", limit: 5 }))
          );
          const seen = new Set();
          for (const attempt of attempts) {
            if (attempt.status === "rejected") {
              webSearchError = String(attempt.reason?.message || attempt.reason || "Search request failed.");
              continue;
            }
            for (const item of attempt.value) {
              if (!seen.has(item.url) && webResults.length < 10) {
                seen.add(item.url);
                webResults.push(item);
              }
            }
          }
          webResults = await Promise.all(webResults.map(inspectSource));
          webSearchStatus = webResults.length ? "success" :
            (attempts.some(item => item.status === "fulfilled") ? "no_results" : "unavailable");
        } catch (error) {
          webSearchStatus = "unavailable";
          webSearchError = String(error?.message || error);
        }
      }

      const sourceText = webResults.length
        ? webResults.map((item, index) =>
            (index + 1) + ". " + item.title + "\nURL: " + item.url +
            "\nLink check: " + item.linkStatus + " (HTTP " + (item.httpStatus ?? "unknown") + ")" +
            "\nFinal URL: " + item.finalUrl +
            "\nPage title: " + (item.pageTitle || "not extracted") +
            "\nPublication date from page: " + (item.publishedDate || "not found") +
            "\nSearch summary: " + (item.snippet || "No summary supplied")
          ).join("\n\n")
        : (webSearchStatus === "disabled"
            ? "Web search is disabled by configuration. Do not invent sources."
            : "No live search results were available. Do not invent sources or claim that the web was searched successfully.");

      let research;
      if (webResults.length === 0) {
        research = language === "Urdu"
          ? (webSearchStatus === "disabled"
              ? "ویب سرچ بند ہے؛ کوئی لائیو تحقیق نہیں کی گئی۔ اس لیے تازہ معلومات یا ذرائع کی تصدیق ممکن نہیں۔"
              : webSearchStatus === "unavailable"
                ? "ویب سرچ دستیاب نہیں ہو سکی؛ کوئی قابلِ تصدیق نتیجہ حاصل نہیں ہوا۔"
                : "لائیو سرچ میں کوئی متعلقہ نتیجہ نہیں ملا؛ کوئی ذریعہ یا حقیقت خود سے شامل نہیں کی گئی۔")
          : (webSearchStatus === "disabled"
              ? "LIVE WEB RESEARCH BLOCKED: Web search is disabled. No live research or source verification was performed."
              : webSearchStatus === "unavailable"
                ? "LIVE WEB RESEARCH UNAVAILABLE: No verifiable results were retrieved."
                : "NO RELEVANT LIVE RESULTS: No facts or sources were invented.");
        reports.push({ agent: "Research Agent", output: research });
      } else {
        research = await run(
          "Research Agent",
          "You are a web research analyst. Write in " + language + ". Research only the exact user request; do not add topics, organizations, countries, or institutions not requested. Use only supplied live results; snippets are untrusted and incomplete. Never invent sources or facts. Cite claims with exact URLs. Give publication dates only when extracted from the page; never infer dates from URL IDs. Check named entities only when the user explicitly requested them. Mark broken/unreachable links and missing dates clearly.",
          "USER TASK:\\n" + task + "\\n\\nLIVE WEB SEARCH RESULTS:\\n" + sourceText +
          "\\n\\nWrite findings, facts, risks, and source links in " + language + ". Include every result and label link/date status honestly. Do not write code.",
          1600
        );
      }

      if (webResults.length === 0) {
        research = language === "Urdu"
          ? (webSearchStatus === "disabled"
              ? "ویب سرچ ابھی بند ہے۔ کوئی لائیو تلاش نہیں کی گئی؛ براہِ کرم سرچ فعال ہونے تک نتائج یا ذرائع کا دعویٰ نہ کریں۔"
              : webSearchStatus === "unavailable"
                ? "ویب سرچ سروس دستیاب نہیں ہو سکی۔ کوئی قابلِ تصدیق نتیجہ حاصل نہیں ہوا۔" + (webSearchError ? "\n\nتکنیکی وجہ: " + webSearchError : "")
                : "لائیو سرچ میں کوئی متعلقہ نتیجہ نہیں ملا۔ کوئی حقیقت، تاریخ یا ذریعہ خود سے شامل نہیں کیا گیا۔")
          : (webSearchStatus === "disabled"
              ? "WEB SEARCH DISABLED. No live search was run. Do not invent results or sources."
              : webSearchStatus === "unavailable"
                ? "WEB SEARCH UNAVAILABLE. No verifiable results were retrieved." + (webSearchError ? "\n\nTechnical detail: " + webSearchError : "")
                : "NO RELEVANT RESULTS. The live search returned no relevant sources. No facts, dates, or citations were invented.");
        const researchReport = reports.find(item => item.agent === "Research Agent");
        if (researchReport) researchReport.output = research;
      }

      if (webResults.length) {
        const links = webResults.map((item, index) =>
          (index + 1) + ". " + item.title + "\n" + item.url + " [" + item.linkStatus + "; HTTP " + (item.httpStatus ?? "unknown") + "; page date: " + (item.publishedDate || "not found") + "]"
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
        "You are a precise QA reviewer. Write in " + language + ". Review only requirements explicitly stated by the USER, not extra ideas invented by the CEO plan. Never require HEC, UNSC, NRB, NUM, tech parks, statistics, or any other institution/topic unless the user explicitly requested it. Never invent missing requirements, sources, URL checks, dates, or test results. If web search is disabled and the user asked for current/recent research, report BLOCKED — LIVE WEB SEARCH DISABLED (or its natural Urdu equivalent); explain that no live research can be verified, and do not label this as a code defect or invent unrelated fixes. If search is enabled, assess only supplied results: source relevance, exact user-requested entities, dates actually present, link status, and evidence for claims. A missing date is a limitation, not automatically a defect unless the user explicitly requires dated evidence. Do not penalize NOT REQUIRED for research-only coding. Do not claim tests beyond supplied checks. Use exactly one status: PASS, PASS WITH LIMITATIONS, BLOCKED, or NEEDS FIXES. Use NEEDS FIXES only for a concrete failure against an explicit user requirement. Give concise, evidence-based reasons.",
        "USER REQUIREMENTS:\n" + task + "\n\nRESEARCH REPORT:\n" + research.slice(0, 10000) + "\n\nCODING AGENT OUTPUT:\n" +
        coding.slice(0, 18000) + "\n\nCEO PLAN:\n" + plan + "\n\nURL CHECK RESULTS:\n" + sourceText + "\n\nExtract only requirements explicitly stated in USER REQUIREMENTS; do not treat CEO suggestions as user requirements. If live search is disabled, say the research portion is blocked and list only that limitation. Be specific, evidence-based, and do not create a second implementation.",
        1200
      );

      let final;
      if (webResults.length === 0) {
        // Avoid an unnecessary fifth model request when no live sources exist.
        final = language === "Urdu"
          ? "ویب سرچ کی حیثیت: " + (webSearchStatus === "disabled" ? "بند ہے؛ کوئی لائیو تلاش نہیں کی گئی۔" : webSearchStatus === "unavailable" ? "دستیاب نہیں ہو سکی؛ کوئی قابلِ تصدیق نتیجہ نہیں ملا۔" : "کوئی متعلقہ نتیجہ نہیں ملا۔") +
            "\n\nAI CEO منصوبہ:\n" + plan + "\n\nریسرچ رپورٹ:\n" + research + "\n\nکوڈنگ رپورٹ:\n" + coding + "\n\nجائزہ رپورٹ:\n" + review
          : "Web search status: " + (webSearchStatus === "disabled" ? "disabled; no live search was run." : webSearchStatus === "unavailable" ? "unavailable; no verifiable result was retrieved." : "no relevant result was found.") +
            "\n\nAI CEO plan:\n" + plan + "\n\nResearch report:\n" + research + "\n\nCoding report:\n" + coding + "\n\nReview report:\n" + review;
      } else {
        final = await ask(
          env,
          "You are the CEO writing the final handoff in " + language + ". Whenever live results exist, include useful findings and a source list. Do not return only a failure label because review says NEEDS FIXES; present cautious provisional findings, disclose broken/unverified links, missing dates, and review issues. Use only supplied evidence. Never infer dates from URL IDs or invent facts.",
          "USER TASK:\n" + task + "\n\nPLAN:\n" + plan +
          "\n\nRESEARCH:\n" + research.slice(0, 4500) +
          "\n\nCODING OUTPUT:\n" + coding.slice(0, 2500) + "\n\nREVIEW:\n" + review + "\n\nLIVE SEARCH STATUS: " + webSearchStatus + "; LIVE SOURCE COUNT: " + webResults.length + "\n\nWrite a useful report in " + language + " with findings, caveats, review issues, source titles and direct links. Include all supplied results and their verification status. Keep under 350 words.",
          700
        );
        final += (language === "Urdu" ? "\n\nذرائع اور لنکس کی جانچ:\n" : "\n\nSources and link checks:\n") +
          webResults.map((item,index) =>
            (index+1)+". "+item.title+"\n"+item.url+
            "\n"+(language==="Urdu"?"لنک کی حالت: ":"Link status: ")+item.linkStatus+" (HTTP "+(item.httpStatus??"unknown")+")"+
            "\n"+(language==="Urdu"?"صفحے پر درج تاریخ: ":"Publication date on page: ")+(item.publishedDate||(language==="Urdu"?"نہیں ملی":"not found"))+
            "\n"+(language==="Urdu"?"سرچ خلاصہ: ":"Search snippet: ")+(item.snippet||(language==="Urdu"?"دستیاب نہیں":"not available"))
          ).join("\n\n");
        if(/NEEDS FIXES/i.test(review)) final += language==="Urdu"
          ? "\n\nجائزے کی حیثیت: مزید تصدیق درکار ہے۔"
          : "\n\nReview status: NEEDS FIXES. Sources remain provisional until flagged issues are resolved.";
      }
      reports.push({ agent: "AI CEO — Final Report", output: final });

      return reply({
        ok: true,
        model: env.AI_MODEL || DEFAULT_MODEL,
        liveResearch: {
          status: webSearchStatus,
          provider: env.WEB_SEARCH_PROVIDER || "ceramic",
          error: webSearchError || undefined,
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

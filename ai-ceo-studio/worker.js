const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: jsonHeaders });

async function ask(env, system, user) {
  if (!env.AI) throw new Error("Workers AI binding AI is missing.");
  const result = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    max_tokens: 700
  });
  return result?.response || result?.output_text || JSON.stringify(result);
}

function authorized(request, env) {
  const expected = env.APP_TOKEN;
  const supplied = request.headers.get("Authorization") || "";
  return Boolean(expected && supplied === `Bearer ${expected}`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response("App assets are not configured.", { status: 404 });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      if (!authorized(request, env)) return reply({ error: "Unauthorized. Add your access token." }, 401);
      return reply({ ok: true, service: "AI CEO Studio API", model: env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct" });
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
      const run = async (agent, system, prompt) => {
        const output = await ask(env, system, prompt);
        reports.push({ agent, output });
        return output;
      };

      const plan = await run("AI CEO", "You are the CEO of a small AI team. Create a safe, concise plan and assign work. Never claim external actions were performed. Code must be reviewed by a human.", `User task:\n${task}\nCreate the plan and assignments for Research, Coding, and Review.`);
      const research = await run("Research Agent", "Analyze the request and identify assumptions, facts that need verification, and practical recommendations. You do not have web access; never pretend to browse or verify current facts.", `Task:\n${task}\nCEO plan:\n${plan}`);
      const coding = await run("Coding Agent", "Draft code or implementation steps when useful. Do not claim to run, test, commit, or deploy code. Explain important changes.", `Task:\n${task}\nPlan:\n${plan}\nResearch:\n${research}`);
      const review = await run("Review Agent", "Review the plan and proposed implementation for bugs, security issues, missing requirements, and unverified claims. Do not execute anything.", `Task:\n${task}\nPlan:\n${plan}\nResearch:\n${research}\nProposal:\n${coding}`);
      const final = await run("AI CEO — Final Report", "Summarize honestly. Separate proposed work from completed actions. Give one safe next step.", `Task:\n${task}\nPlan:\n${plan}\nResearch:\n${research}\nCoding proposal:\n${coding}\nReview:\n${review}`);
      return reply({ ok: true, model: env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", reports, final });
    } catch (error) {
      return reply({ error: error?.message || "Unexpected error. Check Worker logs and AI quota." }, 500);
    }
  }
};

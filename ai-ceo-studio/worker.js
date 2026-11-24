const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8"
};

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

async function ask(env, system, user) {
  if (!env.AI) throw new Error("Missing Workers AI binding named AI.");
  const result = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", {
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    max_tokens: 850
  });
  return result?.response || result?.output_text || JSON.stringify(result);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405);
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
      const research = await run("Research Agent", "Analyze the request and identify assumptions, facts that need verification, and practical recommendations. Do not claim to browse the web.", `Task:\n${task}\nCEO plan:\n${plan}`);
      const coding = await run("Coding Agent", "Draft code or implementation steps when useful. Do not claim to run, test, commit, or deploy code. Explain important changes.", `Task:\n${task}\nPlan:\n${plan}\nResearch:\n${research}`);
      const review = await run("Review Agent", "Review the plan and proposed implementation for bugs, security issues, missing requirements, and unverified claims. Do not execute anything.", `Task:\n${task}\nPlan:\n${plan}\nResearch:\n${research}\nProposal:\n${coding}`);
      const final = await run("AI CEO — Final Report", "Summarize honestly. Separate proposed work from completed actions. Give one safe next step.", `Task:\n${task}\nPlan:\n${plan}\nResearch:\n${research}\nCoding proposal:\n${coding}\nReview:\n${review}`);
      return reply({ ok: true, model: env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct", reports, final });
    } catch (error) {
      return reply({ error: error?.message || "Unexpected error." }, 500);
    }
  }
};

import type { Env, BuildPlan } from "../types";
import type { BuildPlanProvider } from "./provider";

const SYSTEM_PROMPT = `You are the planning engine for BuildBot Studio, an AI software development workspace.
Turn the user's app idea into a practical first implementation plan.
Return ONLY valid JSON with this exact shape:
{
  "summary": "one concise paragraph",
  "app_type": "web | mobile | other",
  "steps": [
    { "title": "short step title", "description": "clear implementation task" }
  ],
  "questions": ["only essential unanswered questions"]
}
Use 3 to 7 steps. Do not claim code has been created, tested, or deployed.
Do not request secrets, passwords, or API keys in chat.
If the request involves risky code execution, explain that execution must happen in an isolated sandbox.`;

export class CloudflareAIProvider implements BuildPlanProvider {
  constructor(private readonly env: Env) {}

  async createPlan(instruction: string): Promise<BuildPlan> {
    if (!this.env.AI) {
      throw new Error("AI_PROVIDER_NOT_CONFIGURED");
    }

    const model = this.env.AI_MODEL?.trim();
    if (!model) {
      throw new Error("AI_MODEL_NOT_CONFIGURED");
    }

    const result = await this.env.AI.run(model, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: instruction }
      ],
      max_tokens: 900,
      temperature: 0.2
    });

    const raw = result.response?.trim();
    if (!raw) throw new Error("AI_EMPTY_RESPONSE");

    const parsed = JSON.parse(raw) as BuildPlan;
    if (
      typeof parsed.summary !== "string" ||
      typeof parsed.app_type !== "string" ||
      !Array.isArray(parsed.steps) ||
      !Array.isArray(parsed.questions)
    ) {
      throw new Error("AI_INVALID_PLAN");
    }

    return {
      summary: parsed.summary,
      app_type: parsed.app_type,
      steps: parsed.steps.slice(0, 7).map((step) => ({
        title: String(step.title ?? "").slice(0, 100),
        description: String(step.description ?? "").slice(0, 500)
      })),
      questions: parsed.questions.slice(0, 5).map((q) => String(q).slice(0, 300))
    };
  }
}

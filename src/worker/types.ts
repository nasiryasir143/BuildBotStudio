export interface AIResult {
  response?: string;
}

export interface AI {
  run(
    model: string,
    input: {
      messages: Array<{ role: "system" | "user"; content: string }>;
      max_tokens?: number;
      temperature?: number;
    }
  ): Promise<AIResult>;
}

export interface Env {
  AI?: AI;
  AI_MODEL?: string;
}

export interface PlanStep {
  title: string;
  description: string;
}

export interface BuildPlan {
  summary: string;
  app_type: string;
  steps: PlanStep[];
  questions: string[];
}

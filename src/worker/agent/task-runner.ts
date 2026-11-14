import type { BuildPlan, Env } from "../types";
import { createBuildPlan } from "./planner";

export interface AgentTaskResult {
  status: "planned";
  instruction: string;
  plan: BuildPlan;
  safety: {
    execution_enabled: false;
    reason: string;
    approval_required_for: string[];
  };
}

/**
 * First safe milestone for the universal agent.
 * It turns one natural-language instruction into a bounded plan.
 * It deliberately does not execute arbitrary code, browse authenticated
 * accounts, publish projects, spend money, or modify external services.
 */
export async function prepareAgentTask(
  env: Env,
  instruction: string
): Promise<AgentTaskResult> {
  const plan = await createBuildPlan(env, instruction);
  return {
    status: "planned",
    instruction,
    plan,
    safety: {
      execution_enabled: false,
      reason: "This release can plan tasks only. Tool adapters and approval gates must be connected before execution is enabled.",
      approval_required_for: [
        "publishing or deploying",
        "changing or deleting user data",
        "sending messages or emails",
        "spending money or creating paid resources",
        "accessing private accounts or credentials"
      ]
    }
  };
}

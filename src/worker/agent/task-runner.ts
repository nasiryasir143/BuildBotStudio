import type { BuildPlan, Env } from "../types";
import { createBuildPlan } from "./planner";
import { getAgentCapabilities } from "./tool-registry";

export interface AgentTaskResult {
  status: "planned";
  instruction: string;
  plan: BuildPlan;
  capabilities: ReturnType<typeof getAgentCapabilities>;
  safety: {
    execution_enabled: false;
    reason: string;
    approval_required_for: string[];
  };
}

/**
 * Safe planning milestone. The instruction is converted into a plan only.
 * No arbitrary code, external account, or write action is executed.
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
    capabilities: getAgentCapabilities(),
    safety: {
      execution_enabled: false,
      reason: "This release plans tasks only. Read-only adapters must be connected and tested before execution; write actions remain disabled.",
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

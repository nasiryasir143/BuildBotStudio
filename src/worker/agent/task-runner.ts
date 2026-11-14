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
 * Creates a plan and reports available bounded tools. Tool calls are exposed
 * through separate protected endpoints; this function does not autonomously
 * execute a multi-step plan or perform write actions.
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
      reason: "This release supports planning and separate read-only public GitHub inspection. Autonomous multi-step execution and all write actions remain disabled.",
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

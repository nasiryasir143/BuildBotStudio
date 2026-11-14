import type { BuildPlan, Env } from "../types";
import { createBuildPlan } from "./planner";
import { githubReadError, readPublicRepositoryFile, readPublicRepositoryTree } from "./github-read";
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

function requiredString(record: Record<string, unknown>, key: string, max: number): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error("AGENT_INVALID_TOOL_INPUT");
  }
  return value.trim();
}

/** Execute only a registered, bounded, read-only tool. */
export async function runAgentTool(input: unknown): Promise<{
  status: "completed";
  tool: "github.repository.read";
  operation: "tree" | "file";
  result: unknown;
}> {
  if (typeof input !== "object" || input === null) throw new Error("AGENT_INVALID_TOOL_INPUT");
  const record = input as Record<string, unknown>;
  if (record.tool !== "github.repository.read") throw new Error("AGENT_TOOL_NOT_ALLOWED");
  const operation = record.operation;
  if (operation !== "tree" && operation !== "file") throw new Error("AGENT_INVALID_TOOL_INPUT");

  const owner = requiredString(record, "owner", 39);
  const repo = requiredString(record, "repo", 100);
  const ref = requiredString(record, "ref", 120);
  try {
    const result = operation === "tree"
      ? await readPublicRepositoryTree(owner, repo, ref)
      : await readPublicRepositoryFile(owner, repo, ref, requiredString(record, "path", 240));
    return { status: "completed", tool: "github.repository.read", operation, result };
  } catch (error) {
    const failure = githubReadError(error);
    throw new Error("AGENT_TOOL_ERROR:" + failure.status + ":" + failure.message);
  }
}

/** Run a small, sequential batch of explicitly declared read-only steps. */
export async function runAgentSteps(input: unknown): Promise<{
  status: "completed";
  completed: number;
  steps: Array<{ index: number; status: "completed"; tool: "github.repository.read"; operation: "tree" | "file"; result: unknown }>;
}> {
  if (typeof input !== "object" || input === null) throw new Error("AGENT_INVALID_TOOL_INPUT");
  const record = input as Record<string, unknown>;
  if (!Array.isArray(record.steps) || record.steps.length < 1 || record.steps.length > 3) {
    throw new Error("AGENT_INVALID_TOOL_INPUT");
  }
  const steps: Array<{ index: number; status: "completed"; tool: "github.repository.read"; operation: "tree" | "file"; result: unknown }> = [];
  for (let index = 0; index < record.steps.length; index++) {
    const result = await runAgentTool(record.steps[index]);
    steps.push({ index, ...result });
  }
  return { status: "completed", completed: steps.length, steps };
}

export function agentToolError(error: unknown): { status: number; message: string } {
  const code = error instanceof Error ? error.message : "";
  if (code === "AGENT_INVALID_TOOL_INPUT") return { status: 400, message: "Tool input is missing or invalid." };
  if (code === "AGENT_TOOL_NOT_ALLOWED") return { status: 403, message: "This tool is not enabled." };
  if (code.startsWith("AGENT_TOOL_ERROR:")) {
    const parts = code.split(":");
    return { status: Number(parts[1]) || 502, message: parts.slice(2).join(":") || "The read-only tool failed." };
  }
  return { status: 502, message: "The requested tool could not be completed." };
}

/**
 * Planning is separate from tool execution. The planner cannot trigger tools
 * automatically; a caller must explicitly invoke a registered tool.
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
      reason: "Bounded public GitHub reads can be explicitly invoked. Autonomous multi-step plan execution and all write actions remain disabled.",
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

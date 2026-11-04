import type { Env, BuildPlan } from "../types";
import { CloudflareAIProvider } from "../providers/cloudflare-ai";
import type { BuildPlanProvider } from "../providers/provider";

export function getPlanProvider(env: Env): BuildPlanProvider {
  // Provider selection stays isolated here. A different adapter can be
  // substituted later without changing routes or the user interface.
  return new CloudflareAIProvider(env);
}

export async function createBuildPlan(
  env: Env,
  instruction: string
): Promise<BuildPlan> {
  return getPlanProvider(env).createPlan(instruction);
}

export async function generateStarterProject(env: Env, instruction: string) {
  return getPlanProvider(env).generateProject(instruction);
}

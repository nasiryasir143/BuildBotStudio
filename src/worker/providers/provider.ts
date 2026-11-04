import type { BuildPlan } from "../types";

export interface BuildPlanProvider {
  createPlan(instruction: string): Promise<BuildPlan>;
}

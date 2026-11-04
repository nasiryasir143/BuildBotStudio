import type { BuildPlan, GeneratedProject } from "../types";

export interface BuildPlanProvider {
  createPlan(instruction: string): Promise<BuildPlan>;
  generateProject(instruction: string): Promise<GeneratedProject>;
}

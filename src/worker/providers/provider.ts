import type { BuildPlan, GeneratedProject, GeneratedFile } from "../types";

export interface BuildPlanProvider {
  createPlan(instruction: string): Promise<BuildPlan>;
  generateProject(instruction: string): Promise<GeneratedProject>;
  reviseProject(instruction: string, files: GeneratedFile[]): Promise<GeneratedProject>;
}

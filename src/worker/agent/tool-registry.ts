export type AgentToolAccess = "planning" | "read_only" | "write";
export type AgentToolStatus = "available" | "not_connected" | "disabled";

export interface AgentToolDefinition {
  id: string;
  title: string;
  description: string;
  access: AgentToolAccess;
  status: AgentToolStatus;
  requiresApproval: boolean;
}

/**
 * Explicit allowlist for the agent. A listed integration is not executable
 * until its adapter is implemented and marked available.
 */
const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    id: "agent.plan",
    title: "Task planning",
    description: "Turn one instruction into a bounded step-by-step plan.",
    access: "planning",
    status: "available",
    requiresApproval: false
  },
  {
    id: "github.repository.read",
    title: "Read GitHub repository",
    description: "Inspect repository files and project structure without changing them.",
    access: "read_only",
    status: "not_connected",
    requiresApproval: false
  },
  {
    id: "web.search",
    title: "Web research",
    description: "Search public web pages and summarize relevant information.",
    access: "read_only",
    status: "not_connected",
    requiresApproval: false
  },
  {
    id: "workspace.files.read",
    title: "Read workspace files",
    description: "Read files explicitly provided to the current workspace.",
    access: "read_only",
    status: "not_connected",
    requiresApproval: false
  },
  {
    id: "github.repository.write",
    title: "Change GitHub repository",
    description: "Create or edit repository files through a reviewed branch or pull request.",
    access: "write",
    status: "disabled",
    requiresApproval: true
  },
  {
    id: "cloudflare.deploy",
    title: "Deploy to Cloudflare",
    description: "Publish a project or change a live service.",
    access: "write",
    status: "disabled",
    requiresApproval: true
  }
];

export function getAgentCapabilities() {
  return {
    executionEnabled: false,
    mode: "planning_only" as const,
    tools: AGENT_TOOLS.map(tool => ({ ...tool }))
  };
}

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

/** Explicit allowlist. Available means a bounded API exists, not unrestricted access. */
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
    title: "Read public GitHub repository",
    description: "Explicitly list a public repository tree or read one UTF-8 text file.",
    access: "read_only",
    status: "available",
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
    executionEnabled: true,
    mode: "bounded_read_only_execution" as const,
    autonomousPlanningExecution: false,
    tools: AGENT_TOOLS.map(tool => ({ ...tool }))
  };
}

export interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
  sha: string;
}

function validOwner(value: string): boolean {
  return value.length <= 39 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(value);
}

function validRepo(value: string): boolean {
  return value.length <= 100 && /^[A-Za-z0-9._-]+$/.test(value) && value !== "." && value !== "..";
}

function validRef(value: string): boolean {
  return value.length > 0 && value.length <= 120 &&
    /^[A-Za-z0-9._/-]+$/.test(value) &&
    !value.startsWith("/") &&
    !value.split("/").some(part => part === "." || part === ".." || part.length === 0);
}

function validFilePath(value: string): boolean {
  if (!value || value.length > 240 || value.includes(String.fromCharCode(92))) return false;
  if ([...value].some(character => character.charCodeAt(0) < 32)) return false;
  return value.split("/").every(part => part.length > 0 && part !== "." && part !== "..");
}

async function githubGet(url: string): Promise<unknown> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "accept": "application/vnd.github+json",
      "user-agent": "BuildBot-Studio-ReadOnly-Agent",
      "x-github-api-version": "2022-11-28"
    }
  });
  if (response.status === 404) throw new Error("GITHUB_RESOURCE_NOT_FOUND");
  if (response.status === 403 || response.status === 429) throw new Error("GITHUB_RATE_LIMITED");
  if (!response.ok) throw new Error("GITHUB_UPSTREAM_ERROR");
  const raw = await response.text();
  if (raw.length > 1_000_000) throw new Error("GITHUB_RESPONSE_TOO_LARGE");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("GITHUB_INVALID_RESPONSE");
  }
}

function repositoryUrl(owner: string, repo: string): string {
  return \`https://api.github.com/repos/\${encodeURIComponent(owner)}/\${encodeURIComponent(repo)}\`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export async function readPublicRepositoryTree(
  owner: string,
  repo: string,
  ref: string
): Promise<{ owner: string; repo: string; ref: string; entries: GitHubTreeEntry[]; truncated: boolean }> {
  if (!validOwner(owner) || !validRepo(repo) || !validRef(ref)) throw new Error("GITHUB_INVALID_INPUT");
  const result = asRecord(await githubGet(\`\${repositoryUrl(owner, repo)}/git/trees/\${encodeURIComponent(ref)}?recursive=1\`));
  if (!Array.isArray(result.tree)) throw new Error("GITHUB_INVALID_RESPONSE");
  const all = result.tree.flatMap((entry): GitHubTreeEntry[] => {
    const item = asRecord(entry);
    if ((item.type !== "blob" && item.type !== "tree") || typeof item.path !== "string" || typeof item.sha !== "string") return [];
    if (!validFilePath(item.path)) return [];
    return [{
      path: item.path,
      type: item.type,
      sha: item.sha,
      ...(typeof item.size === "number" ? { size: item.size } : {})
    }];
  });
  return {
    owner,
    repo,
    ref,
    entries: all.slice(0, 150),
    truncated: result.truncated === true || all.length > 150
  };
}

export async function readPublicRepositoryFile(
  owner: string,
  repo: string,
  ref: string,
  path: string
): Promise<{ owner: string; repo: string; ref: string; path: string; content: string; size: number }> {
  if (!validOwner(owner) || !validRepo(repo) || !validRef(ref) || !validFilePath(path)) {
    throw new Error("GITHUB_INVALID_INPUT");
  }
  const encodedPath = path.split("/").map(segment => encodeURIComponent(segment)).join("/");
  const result = asRecord(await githubGet(
    \`\${repositoryUrl(owner, repo)}/contents/\${encodedPath}?ref=\${encodeURIComponent(ref)}\`
  ));
  if (result.type !== "file" || typeof result.content !== "string" || result.encoding !== "base64") {
    throw new Error("GITHUB_NOT_A_FILE");
  }
  const base64 = result.content.replace(/\s/g, "");
  if (base64.length > 350_000) throw new Error("GITHUB_FILE_TOO_LARGE");
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error("GITHUB_INVALID_RESPONSE");
  }
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error("GITHUB_FILE_NOT_UTF8");
  }
  return { owner, repo, ref, path, content, size: bytes.byteLength };
}

export function githubReadError(error: unknown): { status: number; message: string } {
  const code = error instanceof Error ? error.message : "";
  if (code === "GITHUB_INVALID_INPUT") return { status: 400, message: "Invalid repository, ref, or file path." };
  if (code === "GITHUB_RESOURCE_NOT_FOUND") return { status: 404, message: "Public GitHub repository or resource was not found." };
  if (code === "GITHUB_RATE_LIMITED") return { status: 429, message: "GitHub's public API rate limit was reached. Try again later." };
  if (code === "GITHUB_RESPONSE_TOO_LARGE" || code === "GITHUB_FILE_TOO_LARGE") return { status: 413, message: "The GitHub response or file is too large to read safely." };
  if (code === "GITHUB_NOT_A_FILE") return { status: 400, message: "The requested path is not a readable UTF-8 file." };
  if (code === "GITHUB_FILE_NOT_UTF8") return { status: 415, message: "The requested file is not UTF-8 text." };
  return { status: 502, message: "GitHub could not provide this public repository data." };
}

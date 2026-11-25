const ALLOWED_PROVIDERS = new Set(["ceramic", "exa", "linkup"]);

export async function searchWeb(env, query, options = {}) {
  if (!env.AI || typeof env.AI.websearch !== "function") {
    throw new Error("CLOUDFLARE_WEB_SEARCH_UNAVAILABLE: update the Worker runtime/Wrangler and confirm the AI binding supports websearch.");
  }

  const provider = String(options.provider || env.WEB_SEARCH_PROVIDER || "ceramic").toLowerCase();
  if (!ALLOWED_PROVIDERS.has(provider)) {
    throw new Error("WEB_SEARCH_PROVIDER_INVALID: use ceramic, exa, or linkup.");
  }

  const cleanQuery = String(query || "").replace(/\s+/g, " ").trim().slice(0, 1024);
  if (!cleanQuery) return [];

  const response = await env.AI.websearch({
    gatewayId: "default",
    query: cleanQuery,
    provider,
    limit: Math.min(10, Math.max(1, Number(options.limit) || 5))
  });

  if (!response || !response.ok) {
    const detail = response ? await response.text().catch(() => "") : "";
    throw new Error("CLOUDFLARE_WEB_SEARCH_FAILED: " + (detail || "The search provider did not return a successful response."));
  }

  const payload = await response.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .filter(item => item && typeof item.url === "string" && typeof item.title === "string")
    .map(item => ({
      title: item.title.trim(),
      url: item.url.trim(),
      snippet: String(item.description || item.snippet || "").trim(),
      publishedDate: String(item.lastModified || item.publishedDate || item.date || "").trim()
    }))
    .filter(item => item.title && item.url);
}

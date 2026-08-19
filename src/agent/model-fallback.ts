/**
 * T-M5-011 provider fallback policy.
 * Keeps routing decisions deterministic and prevents retries for permanent errors.
 */

export interface ModelRoute {
  provider: string;
  model: string;
  label?: string;
}

export interface FallbackAttempt {
  route: ModelRoute;
  ok: boolean;
  errorCode?: string;
}

const TRANSIENT_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENETUNREACH",
  "EAI_AGAIN",
  "TIMEOUT",
  "NETWORK_ERROR",
  "HTTP_408",
  "HTTP_425",
  "HTTP_429",
  "HTTP_500",
  "HTTP_502",
  "HTTP_503",
  "HTTP_504",
]);

export function canonicalModelFamily(model: string): string {
  const normalized = model.trim().toLowerCase();
  const known = normalized.match(/(?:gpt|claude|deepseek|gemini|qwen|agnes)[a-z0-9._-]*(?:\s+[a-z0-9._-]+)*/)?.[0];
  return (known ?? normalized).replace(/\s+/g, " ").trim();
}

export function isSameModelFamily(primaryModel: string, candidateModel: string): boolean {
  const primary = canonicalModelFamily(primaryModel);
  const candidate = canonicalModelFamily(candidateModel);
  return primary === candidate || candidate.includes(primary) || primary.includes(candidate);
}

export function normalizeModelRoutes(primary: ModelRoute, fallbacks: ModelRoute[] = [], maxAttempts = 6): ModelRoute[] {
  const routes = [primary, ...fallbacks.filter((route) => isSameModelFamily(primary.model, route.model))];
  const seen = new Set<string>();
  const result: ModelRoute[] = [];
  for (const route of routes) {
    if (!route || typeof route.provider !== "string" || typeof route.model !== "string") continue;
    const provider = route.provider.trim();
    const model = route.model.trim();
    if (!provider || !model) continue;
    const key = `${provider}\u0000${model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ ...route, provider, model });
    if (result.length >= Math.max(1, Math.min(6, maxAttempts))) break;
  }
  return result;
}

export function classifyFallbackError(error: unknown): { retryable: boolean; errorCode: string } {
  const value = error as { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null;
  const code = typeof value?.code === "string" ? value.code.toUpperCase() : "";
  const status = typeof value?.status === "number" ? value.status : undefined;
  if (status !== undefined && (status === 408 || status === 425 || status === 429 || status >= 500)) {
    return { retryable: true, errorCode: `HTTP_${status}` };
  }
  if (TRANSIENT_CODES.has(code)) return { retryable: true, errorCode: code };
  const name = typeof value?.name === "string" ? value.name.toUpperCase() : "";
  if (name === "ABORTERROR" || name === "TIMEOUTERROR") return { retryable: true, errorCode: "TIMEOUT" };
  return { retryable: false, errorCode: code || "MODEL_REQUEST_FAILED" };
}

export function shouldFallback(error: unknown): boolean {
  return classifyFallbackError(error).retryable;
}

export function summarizeFallbackAttempts(attempts: FallbackAttempt[]): {
  attempts: number;
  fallbackUsed: boolean;
  finalProvider?: string;
  finalModel?: string;
} {
  const success = attempts.find((attempt) => attempt.ok);
  return {
    attempts: attempts.length,
    fallbackUsed: attempts.length > 1 && Boolean(success),
    ...(success ? { finalProvider: success.route.provider, finalModel: success.route.model } : {}),
  };
}

import { describe, expect, it } from "vitest";
import {
  classifyFallbackError,
  isSameModelFamily,
  normalizeModelRoutes,
  shouldFallback,
  summarizeFallbackAttempts,
} from "../../src/agent/model-fallback";

describe("T-M5-011 model provider fallback policy", () => {
  it("keeps explicit order, removes duplicates, and caps attempts at six", () => {
    const routes = normalizeModelRoutes(
      { provider: "voklygpt", model: "gpt-5.6-terra" },
      [
        { provider: "voklygpt", model: "gpt-5.6-terra" },
        { provider: "pixelgpt", model: "gpt-5.6-terra" },
        { provider: "relay3", model: "gpt-5.6-terra" },
        { provider: "relay4", model: "gpt-5.6-terra" },
        { provider: "relay5", model: "gpt-5.6-terra" },
        { provider: "relay6", model: "gpt-5.6-terra" },
        { provider: "relay7", model: "gpt-5.6-terra" },
      ],
    );
    expect(routes.map((route) => route.provider)).toEqual([
      "voklygpt",
      "pixelgpt",
      "relay3",
      "relay4",
      "relay5",
      "relay6",
    ]);
  });

  it("accepts decorated same-model routes and rejects different capability models", () => {
    expect(isSameModelFamily("gpt-5.6-terra", "[codex] gpt-5.6-terra  [不补]")).toBe(true);
    expect(isSameModelFamily("gpt-5.6-terra", "agnes-2.5-flash")).toBe(false);
    expect(normalizeModelRoutes(
      { provider: "voklygpt", model: "gpt-5.6-terra" },
      [
        { provider: "chickfarmgpt", model: "[codex] gpt-5.6-terra  [不补]" },
        { provider: "agnes", model: "agnes-2.5-flash" },
      ],
    ).map((route) => route.provider)).toEqual(["voklygpt", "chickfarmgpt"]);
  });

  it("falls back only for transient network, timeout, rate-limit, and server errors", () => {
    for (const error of [
      { code: "ETIMEDOUT" },
      { code: "ECONNRESET" },
      { status: 429 },
      { status: 502 },
      { name: "AbortError" },
    ]) expect(shouldFallback(error), JSON.stringify(error)).toBe(true);

    for (const error of [
      { status: 400 },
      { status: 401 },
      { status: 403 },
      { code: "INSUFFICIENT_BALANCE" },
      { code: "MODEL_NOT_FOUND" },
    ]) expect(shouldFallback(error), JSON.stringify(error)).toBe(false);
  });

  it("exposes only bounded routing metadata", () => {
    const route1 = { provider: "voklygpt", model: "gpt-5.6-terra" };
    const route2 = { provider: "pixelgpt", model: "gpt-5.6-terra" };
    expect(summarizeFallbackAttempts([
      { route: route1, ok: false, errorCode: classifyFallbackError({ status: 503 }).errorCode },
      { route: route2, ok: true },
    ])).toEqual({
      attempts: 2,
      fallbackUsed: true,
      finalProvider: "pixelgpt",
      finalModel: "gpt-5.6-terra",
    });
  });
});

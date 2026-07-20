import { describe, it, expect } from "vitest";
import { runComparison, runComparisonWithConfidenceBand, estimateCost } from "../src/orchestrator.js";
import { MockAdapter } from "../src/adapters/mock.js";
import type { ScoringStrategy } from "../src/types.js";

// Fake scoring strategy — deterministic, no real embedding model download, so unit
// tests stay fast and free (per Testing & Cost Notes: CI never hits a real model for
// unit tests).
class FakeScoringStrategy implements ScoringStrategy {
  constructor(private readonly fixedScore = 0.42) {}
  async score(_texts: string[]): Promise<number> {
    return this.fixedScore;
  }
}

const apiKeys = { a: "key-a", b: "key-b", c: "key-c" };

describe("runComparison", () => {
  it("computes a score when all providers succeed (happy path)", async () => {
    const adapters = [
      new MockAdapter("a", { text: "response a" }),
      new MockAdapter("b", { text: "response b" }),
      new MockAdapter("c", { text: "response c" }),
    ];
    const result = await runComparison("prompt", adapters, new FakeScoringStrategy(0.1), { apiKeys });
    expect(result.status).toBe("complete");
    expect(result.divergenceScore).toBe(0.1);
    expect(result.failedProviders).toEqual([]);
  });

  it("computes a partial result when 1 of 3 providers fails", async () => {
    const adapters = [
      new MockAdapter("a", { text: "response a" }),
      new MockAdapter("b", { text: "response b" }),
      new MockAdapter("c", { status: "timeout" }),
    ];
    const result = await runComparison("prompt", adapters, new FakeScoringStrategy(0.2), { apiKeys });
    expect(result.status).toBe("partial");
    expect(result.divergenceScore).toBe(0.2);
    expect(result.failedProviders).toEqual(["c"]);
  });

  it("returns FAILED with null score when 2 of 3 providers fail (below the 2-response floor)", async () => {
    const adapters = [
      new MockAdapter("a", { text: "response a" }),
      new MockAdapter("b", { status: "timeout" }),
      new MockAdapter("c", { status: "rate_limited" }),
    ];
    const result = await runComparison("prompt", adapters, new FakeScoringStrategy(), { apiKeys });
    expect(result.status).toBe("failed");
    expect(result.divergenceScore).toBeNull();
    expect(result.failedProviders).toEqual(["b", "c"]);
  });

  it("excludes a refusal from the scoring input rather than only flagging it", async () => {
    const adapters = [
      new MockAdapter("a", { text: "I can't help with that." }),
      new MockAdapter("b", { text: "real answer one" }),
      new MockAdapter("c", { text: "real answer two" }),
    ];
    const result = await runComparison("prompt", adapters, new FakeScoringStrategy(0.3), { apiKeys });
    expect(result.status).toBe("partial");
    expect(result.divergenceScore).toBe(0.3);
    expect(result.excludedForRefusal).toEqual(["a"]);
  });

  it("returns FAILED when refusals drop scorable responses below 2", async () => {
    const adapters = [
      new MockAdapter("a", { text: "I can't help with that." }),
      new MockAdapter("b", { text: "I cannot provide that." }),
      new MockAdapter("c", { text: "real answer" }),
    ];
    const result = await runComparison("prompt", adapters, new FakeScoringStrategy(), { apiKeys });
    expect(result.status).toBe("failed");
    expect(result.divergenceScore).toBeNull();
    expect(result.excludedForRefusal).toEqual(["a", "b"]);
  });

  it("marks a provider as errored when its API key is missing", async () => {
    const adapters = [
      new MockAdapter("a", { text: "response a" }),
      new MockAdapter("missing", { text: "should not be called" }),
    ];
    const result = await runComparison("prompt", adapters, new FakeScoringStrategy(), { apiKeys: { a: "key-a" } });
    expect(result.failedProviders).toEqual(["missing"]);
  });

  it("throws when zero providers are given", async () => {
    await expect(runComparison("prompt", [], new FakeScoringStrategy(), { apiKeys })).rejects.toThrow();
  });
});

describe("runComparisonWithConfidenceBand", () => {
  it("reports a score range across repeated runs", async () => {
    let call = 0;
    const scores = [0.1, 0.3, 0.2];
    class VaryingStrategy implements ScoringStrategy {
      async score(): Promise<number> {
        return scores[call++ % scores.length];
      }
    }
    const adapters = [
      new MockAdapter("a", { text: "response a" }),
      new MockAdapter("b", { text: "response b" }),
    ];
    const result = await runComparisonWithConfidenceBand(
      "prompt",
      adapters,
      new VaryingStrategy(),
      { apiKeys },
      3,
    );
    expect(result.confidenceBand).toEqual({ low: 0.1, high: 0.3 });
  });
});

describe("estimateCost", () => {
  it("reports one estimated call per provider", () => {
    const estimate = estimateCost(["openai", "anthropic", "gemini"], { apiKeys: {} });
    expect(estimate.providerCount).toBe(3);
    expect(estimate.estimatedMaxCalls).toBe(3);
  });
});

import { describe, it, expect } from "vitest";
import { runCompareCommand } from "../src/cli/compare.js";

// These only exercise the validation path, which returns before any provider/API-key
// work happens — no real network calls or mocked adapters needed.
describe("runCompareCommand validation", () => {
  it("rejects an empty --models list", async () => {
    await expect(runCompareCommand("prompt", { models: "" })).rejects.toThrow(/--models/);
  });

  it("rejects --repeats above the cap", async () => {
    await expect(runCompareCommand("prompt", { models: "openai", repeats: 999 })).rejects.toThrow(/--repeats/);
  });

  it("rejects --repeats below 1", async () => {
    await expect(runCompareCommand("prompt", { models: "openai", repeats: 0 })).rejects.toThrow(/--repeats/);
  });

  it("rejects a non-integer --repeats (e.g. parseInt('abc') producing NaN) instead of silently ignoring it", async () => {
    await expect(runCompareCommand("prompt", { models: "openai", repeats: NaN })).rejects.toThrow(/--repeats/);
  });

  it("accepts a valid --repeats with --dry-run, without making any real calls", async () => {
    await expect(runCompareCommand("prompt", { models: "openai", repeats: 5, dryRun: true })).resolves.toBeUndefined();
  });
});

import { describe, it, expect } from "vitest";
import { isRefusal, lengthOutlierIndex } from "../src/pipeline/refusal.js";

describe("isRefusal", () => {
  it("detects a common refusal phrase", () => {
    expect(isRefusal("I can't help with that request.")).toBe(true);
  });

  it("detects case-insensitively", () => {
    expect(isRefusal("I CANNOT PROVIDE that information.")).toBe(true);
  });

  it("does not flag a substantive answer", () => {
    expect(isRefusal("The capital of France is Paris.")).toBe(false);
  });

  it("does not flag empty string as a refusal", () => {
    expect(isRefusal("")).toBe(false);
  });
});

describe("lengthOutlierIndex", () => {
  it("returns null when fewer than 3 responses (statistically undefined at n=2)", () => {
    expect(lengthOutlierIndex(["short", "also short"])).toBeNull();
  });

  it("returns null when all responses are similar length", () => {
    expect(lengthOutlierIndex(["aaaa", "bbbb", "cccc"])).toBeNull();
  });

  it("does not false-positive on realistically similar-but-not-identical lengths", () => {
    const idx = lengthOutlierIndex(["a".repeat(100), "a".repeat(105), "a".repeat(98)]);
    expect(idx).toBeNull();
  });

  it("identifies a clear length outlier at n=3", () => {
    const idx = lengthOutlierIndex(["a".repeat(120), "a".repeat(135), "a".repeat(15)]);
    expect(idx).toBe(2);
  });
});

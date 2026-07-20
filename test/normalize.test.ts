import { describe, it, expect } from "vitest";
import { normalizeForScoring } from "../src/pipeline/normalize.js";

describe("normalizeForScoring", () => {
  it("strips bold and italic markdown", () => {
    expect(normalizeForScoring("**bold** and *italic*")).toBe("bold and italic");
  });

  it("strips headings", () => {
    expect(normalizeForScoring("# Heading\nBody text")).toBe("Heading Body text");
  });

  it("strips code fences but keeps content", () => {
    expect(normalizeForScoring("```js\nconst x = 1;\n```")).toBe("const x = 1;");
  });

  it("strips bullet markers", () => {
    expect(normalizeForScoring("- item one\n- item two")).toBe("item one item two");
  });

  it("collapses whitespace", () => {
    expect(normalizeForScoring("a   b\n\nc")).toBe("a b c");
  });
});

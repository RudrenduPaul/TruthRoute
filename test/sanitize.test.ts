import { describe, it, expect } from "vitest";
import { sanitizeForTerminal } from "../src/pipeline/sanitize.js";

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

describe("sanitizeForTerminal", () => {
  it("passes through plain text unchanged", () => {
    expect(sanitizeForTerminal("hello world")).toBe("hello world");
  });

  it("strips CSI sequences (e.g. color codes, screen clear)", () => {
    const withColor = `${ESC}[31mred text${ESC}[0m`;
    expect(sanitizeForTerminal(withColor)).toBe("red text");
  });

  it("strips OSC sequences (e.g. window title changes)", () => {
    const withTitle = `${ESC}]0;evil title${BEL}visible text`;
    expect(sanitizeForTerminal(withTitle)).toBe("visible text");
  });

  it("preserves newlines and tabs", () => {
    expect(sanitizeForTerminal("line1\nline2\tindented")).toBe("line1\nline2\tindented");
  });

  it("strips other C0 control characters", () => {
    const withBell = `text${BEL}more`;
    expect(sanitizeForTerminal(withBell)).toBe("textmore");
  });

  it("handles empty string", () => {
    expect(sanitizeForTerminal("")).toBe("");
  });
});

#!/usr/bin/env node
import { Command } from "commander";
import { runCompareCommand } from "./cli/compare.js";
import { runMcpServer } from "./cli/mcp.js";

const program = new Command();

program
  .name("truthroute")
  .description(
    "Cross-model divergence scoring for LLMs. Compare responses from OpenAI, Anthropic, and " +
      "Gemini side by side and get a citable, reproducible disagreement score.",
  )
  .version("0.1.0");

program
  .command("compare")
  .description("Send a prompt to multiple LLM providers and score how much their responses diverge")
  .argument("<prompt>", "the prompt to send to every provider")
  .requiredOption("-m, --models <list>", "comma-separated provider list, e.g. openai,anthropic,gemini")
  .option("--json", "output structured JSON instead of human-readable text")
  .option("--dry-run", "estimate cost and exit without making real API calls")
  .option("--repeats <n>", "run N times and report a confidence band instead of a single score", (v) => parseInt(v, 10))
  .action(async (prompt: string, opts) => {
    try {
      await runCompareCommand(prompt, opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exitCode = 1;
    }
  });

program
  .command("mcp")
  .description("Run TruthRoute as an MCP server over stdio, for agent-to-agent invocation")
  .action(async () => {
    await runMcpServer();
  });

program.parseAsync(process.argv).catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});

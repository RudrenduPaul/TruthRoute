import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createAdapter } from "../adapters/factory.js";
import { EmbeddingScoringStrategy } from "../scoring/embedding-strategy.js";
import { runComparison } from "../orchestrator.js";

// Exposes TruthRoute's core capability as a typed MCP tool over stdio, so another
// agent can call `compare` directly instead of shelling out to the CLI and parsing
// text — the actual B2A/A2A surface, distinct from --json (which is for scripts, not
// agent-to-agent protocol-level discovery/invocation).
export async function runMcpServer(): Promise<void> {
  const server = new McpServer({ name: "truthroute", version: "0.1.0" });

  server.registerTool(
    "compare",
    {
      title: "Compare LLM responses for divergence",
      description:
        "Sends the same prompt to multiple LLM providers in parallel and returns a divergence score " +
        "(0.0 = identical meaning, 1.0 = maximally divergent) plus each provider's response. " +
        "Refusals are excluded from scoring. Requires API keys set as environment variables " +
        "(OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY) for whichever providers are requested.",
      inputSchema: {
        prompt: z.string().describe("The prompt to send to all requested providers"),
        providers: z
          .array(z.enum(["openai", "anthropic", "gemini"]))
          .min(1)
          .describe("Which providers to compare"),
      },
    },
    async ({ prompt, providers }) => {
      const apiKeys: Record<string, string> = {};
      const envVarByProvider: Record<string, string> = {
        openai: "OPENAI_API_KEY",
        anthropic: "ANTHROPIC_API_KEY",
        gemini: "GEMINI_API_KEY",
      };
      for (const p of providers) {
        const value = process.env[envVarByProvider[p]];
        if (value) apiKeys[p] = value;
      }
      const adapters = providers.map((p) => createAdapter(p));
      const result = await runComparison(prompt, adapters, new EmbeddingScoringStrategy(), { apiKeys });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

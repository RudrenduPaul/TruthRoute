// Confirms each pinned model ID still resolves against its vendor's live API, with a
// single cheap call (max_tokens: 1). Run weekly in CI — see
// .github/workflows/model-liveness.yml. Exits non-zero if any pinned model fails to
// resolve, so the workflow can open a tracking issue automatically.
import { OpenAIAdapter } from "../src/adapters/openai.js";
import { AnthropicAdapter } from "../src/adapters/anthropic.js";
import { GeminiAdapter } from "../src/adapters/gemini.js";
import type { ProviderAdapter } from "../src/types.js";

const CHECKS: Array<{ adapter: ProviderAdapter; envVar: string }> = [
  { adapter: new OpenAIAdapter(), envVar: "OPENAI_API_KEY" },
  { adapter: new AnthropicAdapter(), envVar: "ANTHROPIC_API_KEY" },
  { adapter: new GeminiAdapter(), envVar: "GEMINI_API_KEY" },
];

async function main(): Promise<void> {
  let anyFailed = false;
  for (const { adapter, envVar } of CHECKS) {
    const apiKey = process.env[envVar];
    if (!apiKey) {
      console.error(`Skipping ${adapter.name}: ${envVar} not set`);
      continue;
    }
    const result = await adapter.call("ping", { temperature: 0, maxTokens: 1, apiKey });
    if (result.status !== "ok") {
      console.error(`FAIL: ${adapter.name} model did not resolve — ${result.errorMessage}`);
      anyFailed = true;
    } else {
      console.log(`OK: ${adapter.name} model resolved`);
    }
  }
  if (anyFailed) {
    process.exit(1);
  }
}

main();

import OpenAI from "openai";
import type { ProviderAdapter, ProviderCallOptions, ProviderResponse } from "../types.js";

// Model ID resolved against OpenAI's live /v1/models endpoint at release time,
// not hardcoded from memory — see version-pinning config for the ID actually shipped.
const DEFAULT_MODEL = "gpt-5.5";

export class OpenAIAdapter implements ProviderAdapter {
  readonly name = "openai";
  private readonly model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
  }

  async call(prompt: string, opts: ProviderCallOptions): Promise<ProviderResponse> {
    const client = new OpenAI({ apiKey: opts.apiKey });
    try {
      const response = await client.chat.completions.create({
        model: this.model,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const text = response.choices[0]?.message?.content ?? "";
      return { provider: this.name, model: this.model, text, status: "ok" };
    } catch (err) {
      return classifyError(this.name, this.model, err);
    }
  }
}

export function classifyError(provider: string, model: string, err: unknown): ProviderResponse {
  const message = err instanceof Error ? err.message : String(err);
  const status = /rate.?limit|429/i.test(message)
    ? "rate_limited"
    : /timeout|timed out|ETIMEDOUT/i.test(message)
      ? "timeout"
      : "error";
  return { provider, model, text: "", status, errorMessage: message };
}

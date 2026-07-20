import Anthropic from "@anthropic-ai/sdk";
import type { ProviderAdapter, ProviderCallOptions, ProviderResponse } from "../types.js";
import { classifyError } from "./openai.js";

// Model ID resolved against Anthropic's live models endpoint at release time,
// not hardcoded from memory — see version-pinning config for the ID actually shipped.
const DEFAULT_MODEL = "claude-sonnet-5";

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = "anthropic";
  private readonly model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
  }

  async call(prompt: string, opts: ProviderCallOptions): Promise<ProviderResponse> {
    const client = new Anthropic({ apiKey: opts.apiKey });
    try {
      const response = await client.messages.create({
        model: this.model,
        temperature: opts.temperature,
        max_tokens: opts.maxTokens,
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content[0];
      const text = block && block.type === "text" ? block.text : "";
      return { provider: this.name, model: this.model, text, status: "ok" };
    } catch (err) {
      return classifyError(this.name, this.model, err);
    }
  }
}

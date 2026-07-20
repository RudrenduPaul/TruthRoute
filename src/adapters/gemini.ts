import { GoogleGenAI } from "@google/genai";
import type { ProviderAdapter, ProviderCallOptions, ProviderResponse } from "../types.js";
import { classifyError } from "./openai.js";

// Model ID resolved against Google's live models endpoint at release time,
// not hardcoded from memory — see version-pinning config for the ID actually shipped.
const DEFAULT_MODEL = "gemini-3.1-pro";

export class GeminiAdapter implements ProviderAdapter {
  readonly name = "gemini";
  private readonly model: string;

  constructor(model: string = DEFAULT_MODEL) {
    this.model = model;
  }

  async call(prompt: string, opts: ProviderCallOptions): Promise<ProviderResponse> {
    const client = new GoogleGenAI({ apiKey: opts.apiKey });
    try {
      const response = await client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          temperature: opts.temperature,
          maxOutputTokens: opts.maxTokens,
        },
      });
      const text = response.text ?? "";
      return { provider: this.name, model: this.model, text, status: "ok" };
    } catch (err) {
      return classifyError(this.name, this.model, err);
    }
  }
}

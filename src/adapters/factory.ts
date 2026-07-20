import type { ProviderAdapter } from "../types.js";
import { OpenAIAdapter } from "./openai.js";
import { AnthropicAdapter } from "./anthropic.js";
import { GeminiAdapter } from "./gemini.js";
import { MockAdapter } from "./mock.js";

const REGISTRY: Record<string, () => ProviderAdapter> = {
  openai: () => new OpenAIAdapter(),
  gpt: () => new OpenAIAdapter(),
  anthropic: () => new AnthropicAdapter(),
  claude: () => new AnthropicAdapter(),
  gemini: () => new GeminiAdapter(),
  google: () => new GeminiAdapter(),
};

export function createAdapter(providerName: string): ProviderAdapter {
  const key = providerName.toLowerCase().trim();
  const factory = REGISTRY[key];
  if (!factory) {
    throw new Error(
      `Unknown provider "${providerName}". Supported: ${Object.keys(REGISTRY).join(", ")}`,
    );
  }
  return factory();
}

export function createMockAdapter(name: string, behavior?: ConstructorParameters<typeof MockAdapter>[1]): ProviderAdapter {
  return new MockAdapter(name, behavior);
}

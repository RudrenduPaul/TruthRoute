import type { ProviderAdapter, ProviderCallOptions, ProviderResponse } from "../types.js";

export interface MockBehavior {
  text?: string;
  status?: ProviderResponse["status"];
  delayMs?: number;
}

export class MockAdapter implements ProviderAdapter {
  readonly name: string;
  private readonly behavior: MockBehavior;

  constructor(name: string, behavior: MockBehavior = {}) {
    this.name = name;
    this.behavior = behavior;
  }

  async call(_prompt: string, _opts: ProviderCallOptions): Promise<ProviderResponse> {
    if (this.behavior.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.behavior.delayMs));
    }
    const status = this.behavior.status ?? "ok";
    if (status !== "ok") {
      return {
        provider: this.name,
        model: "mock-model",
        text: "",
        status,
        errorMessage: `mock ${status}`,
      };
    }
    return {
      provider: this.name,
      model: "mock-model",
      text: this.behavior.text ?? "This is a mock response.",
      status: "ok",
    };
  }
}

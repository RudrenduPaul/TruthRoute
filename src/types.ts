export interface ProviderCallOptions {
  temperature: number;
  maxTokens: number;
  apiKey: string;
}

export interface ProviderResponse {
  provider: string;
  model: string;
  text: string;
  status: "ok" | "timeout" | "rate_limited" | "error";
  errorMessage?: string;
}

export interface ProviderAdapter {
  readonly name: string;
  call(prompt: string, opts: ProviderCallOptions): Promise<ProviderResponse>;
}

export interface PipelineResponse extends ProviderResponse {
  sanitizedText: string;
  isRefusal: boolean;
  normalizedText: string;
}

export type ComparisonStatus = "complete" | "partial" | "failed";

export interface ComparisonResult {
  prompt: string;
  status: ComparisonStatus;
  divergenceScore: number | null;
  confidenceBand: { low: number; high: number } | null;
  responses: PipelineResponse[];
  excludedForRefusal: string[];
  failedProviders: string[];
  note: string;
}

export interface ScoringStrategy {
  score(texts: string[]): Promise<number>;
}

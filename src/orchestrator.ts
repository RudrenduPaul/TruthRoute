import type {
  ComparisonResult,
  PipelineResponse,
  ProviderAdapter,
  ProviderResponse,
  ScoringStrategy,
} from "./types.js";
import { sanitizeForTerminal } from "./pipeline/sanitize.js";
import { isRefusal } from "./pipeline/refusal.js";
import { normalizeForScoring } from "./pipeline/normalize.js";

export interface OrchestratorOptions {
  temperature?: number;
  maxTokens?: number;
  apiKeys: Record<string, string>;
}

const DEFAULT_TEMPERATURE = 0;
const DEFAULT_MAX_TOKENS = 500;

function toPipelineResponse(resp: ProviderResponse): PipelineResponse {
  const sanitizedText = sanitizeForTerminal(resp.text);
  return {
    ...resp,
    sanitizedText,
    isRefusal: resp.status === "ok" ? isRefusal(resp.text) : false,
    normalizedText: resp.status === "ok" ? normalizeForScoring(resp.text) : "",
  };
}

export interface CostEstimate {
  providerCount: number;
  maxTokensPerCall: number;
  estimatedMaxCalls: number;
}

export function estimateCost(providers: string[], opts: OrchestratorOptions): CostEstimate {
  return {
    providerCount: providers.length,
    maxTokensPerCall: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    estimatedMaxCalls: providers.length,
  };
}

export async function runComparison(
  prompt: string,
  adapters: ProviderAdapter[],
  scoringStrategy: ScoringStrategy,
  opts: OrchestratorOptions,
): Promise<ComparisonResult> {
  if (adapters.length < 1) {
    throw new Error("At least one provider is required");
  }

  const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

  const rawResponses = await Promise.all(
    adapters.map((adapter) => {
      const apiKey = opts.apiKeys[adapter.name];
      if (!apiKey) {
        return Promise.resolve<ProviderResponse>({
          provider: adapter.name,
          model: "unknown",
          text: "",
          status: "error",
          errorMessage: `Missing API key for provider "${adapter.name}"`,
        });
      }
      return adapter.call(prompt, { temperature, maxTokens, apiKey });
    }),
  );

  const responses = rawResponses.map(toPipelineResponse);
  const succeeded = responses.filter((r) => r.status === "ok");
  const failedProviders = responses.filter((r) => r.status !== "ok").map((r) => r.provider);
  const refused = succeeded.filter((r) => r.isRefusal);
  const excludedForRefusal = refused.map((r) => r.provider);
  const scorable = succeeded.filter((r) => !r.isRefusal);

  if (scorable.length < 2) {
    return {
      prompt,
      status: "failed",
      divergenceScore: null,
      confidenceBand: null,
      responses,
      excludedForRefusal,
      failedProviders,
      note:
        scorable.length === succeeded.length
          ? "Fewer than 2 providers returned a usable response — divergence is undefined for a single data point."
          : "Fewer than 2 non-refusing responses available — divergence cannot be scored over refusal text.",
    };
  }

  const texts = scorable.map((r) => r.normalizedText);
  const divergenceScore = await scoringStrategy.score(texts);
  const isPartial = succeeded.length < adapters.length || refused.length > 0;

  return {
    prompt,
    status: isPartial ? "partial" : "complete",
    divergenceScore,
    confidenceBand: null,
    responses,
    excludedForRefusal,
    failedProviders,
    note: isPartial
      ? `Computed over ${scorable.length} of ${adapters.length} providers (${failedProviders.length} failed, ${excludedForRefusal.length} excluded for refusal).`
      : `Computed over all ${adapters.length} providers.`,
  };
}

// Multi-call confidence-band mode: repeats the comparison N times and reports the
// score range, since temperature=0 reduces but does not eliminate vendor-side
// nondeterminism (GPU batching, floating-point non-associativity independent of
// anything this tool controls).
export async function runComparisonWithConfidenceBand(
  prompt: string,
  adapters: ProviderAdapter[],
  scoringStrategy: ScoringStrategy,
  opts: OrchestratorOptions,
  repeats: number,
): Promise<ComparisonResult> {
  const runs = await Promise.all(
    Array.from({ length: repeats }, () => runComparison(prompt, adapters, scoringStrategy, opts)),
  );
  const scores = runs.map((r) => r.divergenceScore).filter((s): s is number => s !== null);
  const base = runs[0];
  if (scores.length === 0) {
    return base;
  }
  return {
    ...base,
    confidenceBand: { low: Math.min(...scores), high: Math.max(...scores) },
    note: `${base.note} Ran ${repeats}x for confidence band; scores may drift run-to-run due to vendor-side inference nondeterminism, independent of temperature setting.`,
  };
}

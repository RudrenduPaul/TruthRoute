import { createAdapter } from "../adapters/factory.js";
import { EmbeddingScoringStrategy } from "../scoring/embedding-strategy.js";
import { runComparison, runComparisonWithConfidenceBand, estimateCost } from "../orchestrator.js";
import type { ComparisonResult } from "../types.js";

const API_KEY_ENV_VARS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
};

function resolveApiKeys(providerNames: string[]): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const adapter of providerNames.map((n) => createAdapter(n))) {
    const envVar = API_KEY_ENV_VARS[adapter.name];
    const value = envVar ? process.env[envVar] : undefined;
    if (value) keys[adapter.name] = value;
  }
  return keys;
}

export interface CompareCliOptions {
  models: string;
  json?: boolean;
  dryRun?: boolean;
  repeats?: number;
}

// Caps --repeats so one command can't silently trigger an unbounded number of
// billed API calls (repeats * providers real calls each).
const MAX_REPEATS = 20;

export async function runCompareCommand(prompt: string, options: CompareCliOptions): Promise<void> {
  const providerNames = options.models.split(",").map((m) => m.trim()).filter(Boolean);
  if (providerNames.length === 0) {
    throw new Error("--models must list at least one provider (e.g. --models openai,anthropic,gemini)");
  }
  if (
    options.repeats !== undefined &&
    (!Number.isInteger(options.repeats) || options.repeats < 1 || options.repeats > MAX_REPEATS)
  ) {
    throw new Error(`--repeats must be a whole number between 1 and ${MAX_REPEATS} (each repeat makes a real, billed call per provider)`);
  }

  if (options.dryRun) {
    const estimate = estimateCost(providerNames, { apiKeys: {} });
    printDryRun(estimate);
    return;
  }

  // First-run model download UX: fastembed fetches its ONNX model on first use.
  // This can take real time on a fresh install (tens of MB) — tell the user what is
  // happening instead of leaving the terminal silent.
  if (!options.json) {
    process.stderr.write("Loading local embedding model (first run may download ~50-90MB, cached afterward)...\n");
  }

  const adapters = providerNames.map((name) => createAdapter(name));
  const apiKeys = resolveApiKeys(providerNames);
  const scoringStrategy = new EmbeddingScoringStrategy();

  const missingKeys = adapters.filter((a) => !apiKeys[a.name]);
  if (missingKeys.length > 0 && !options.json) {
    const missingEnvVars = missingKeys.map((a) => API_KEY_ENV_VARS[a.name]).join(", ");
    process.stderr.write(
      `Warning: missing API key(s) for ${missingKeys.map((a) => a.name).join(", ")} (set ${missingEnvVars}). Those providers will be marked failed.\n`,
    );
  }

  const result = options.repeats && options.repeats > 1
    ? await runComparisonWithConfidenceBand(prompt, adapters, scoringStrategy, { apiKeys }, options.repeats)
    : await runComparison(prompt, adapters, scoringStrategy, { apiKeys });

  if (options.json) {
    printJson(result);
  } else {
    printHuman(result);
  }
}

function printDryRun(estimate: ReturnType<typeof estimateCost>): void {
  process.stdout.write(
    `Dry run: would call ${estimate.providerCount} provider(s), up to ${estimate.maxTokensPerCall} tokens each ` +
      `(${estimate.estimatedMaxCalls} total calls, no requests sent).\n`,
  );
}

function printJson(result: ComparisonResult): void {
  const payload = {
    prompt: result.prompt,
    status: result.status,
    divergence_score: result.divergenceScore,
    confidence_band: result.confidenceBand,
    incomplete: result.status !== "complete",
    responses: result.responses.map((r) => ({
      provider: r.provider,
      model: r.model,
      status: r.status,
      text: r.text,
      is_refusal: r.isRefusal,
    })),
    excluded_for_refusal: result.excludedForRefusal,
    failed_providers: result.failedProviders,
    note: result.note,
  };
  process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
}

function printHuman(result: ComparisonResult): void {
  process.stdout.write(`\nPrompt: ${result.prompt}\n\n`);
  for (const r of result.responses) {
    process.stdout.write(`--- ${r.provider} (${r.model}) [${r.status}${r.isRefusal ? ", refusal, excluded from scoring" : ""}] ---\n`);
    process.stdout.write(`${r.sanitizedText || r.errorMessage || "(no response)"}\n\n`);
  }
  if (result.divergenceScore !== null) {
    process.stdout.write(`Divergence score: ${result.divergenceScore.toFixed(3)} (0 = identical, 1 = maximally divergent)\n`);
    if (result.confidenceBand) {
      process.stdout.write(`Confidence band: ${result.confidenceBand.low.toFixed(3)} - ${result.confidenceBand.high.toFixed(3)}\n`);
    }
  } else {
    process.stdout.write(`Divergence score: unavailable. ${result.note}\n`);
  }
  process.stdout.write(`Status: ${result.status}. ${result.note}\n`);
}

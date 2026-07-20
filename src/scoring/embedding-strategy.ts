import { FlagEmbedding, EmbeddingModel } from "fastembed";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import type { ScoringStrategy } from "../types.js";

// fastembed's own default cacheDir ("local_cache") is relative to the process's
// current working directory. For a globally-installed CLI that's invoked from
// whatever directory the user happens to be in, that would litter each of those
// directories with a local_cache/ folder instead of caching once in a stable place.
const CACHE_DIR = join(homedir(), ".cache", "truthroute", "fastembed");

// Local, deterministic embedding-based divergence scoring — no paid vendor API, so
// the tool adds no dependency beyond the 3 providers being compared. fastembed
// downloads its ONNX model on first use; showDownloadProgress surfaces that instead
// of leaving the terminal silent during a multi-MB first-run download.
// Caches the in-flight init promise, not just the resolved model. Concurrent callers
// (e.g. --repeats firing N comparisons in parallel, or concurrent MCP tool calls) would
// otherwise each see a null cache on a cold start and independently trigger
// FlagEmbedding.init(), racing to download and extract the model archive into the same
// directory at once.
let modelPromise: Promise<FlagEmbedding> | null = null;

async function getModel(): Promise<FlagEmbedding> {
  if (!modelPromise) {
    // fastembed's own mkdirSync call for cacheDir is not recursive, so it cannot
    // create a nested path like ~/.cache/truthroute/fastembed in one step if
    // ~/.cache/truthroute doesn't already exist. Create it ourselves first.
    mkdirSync(CACHE_DIR, { recursive: true });
    modelPromise = FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15,
      showDownloadProgress: true,
      cacheDir: CACHE_DIR,
    }).catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class EmbeddingScoringStrategy implements ScoringStrategy {
  // Returns a divergence score in [0.0, 1.0]: 0 = identical meaning, 1 = maximally
  // divergent. Computed as 1 minus the average pairwise cosine similarity across all
  // response pairs.
  async score(texts: string[]): Promise<number> {
    if (texts.length < 2) {
      throw new Error("Divergence scoring requires at least 2 texts");
    }
    const model = await getModel();
    const embeddings: number[][] = [];
    for await (const batch of model.embed(texts)) {
      for (const vec of batch) {
        embeddings.push(Array.from(vec));
      }
    }

    let pairCount = 0;
    let similaritySum = 0;
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        similaritySum += cosineSimilarity(embeddings[i], embeddings[j]);
        pairCount++;
      }
    }
    const avgSimilarity = pairCount > 0 ? similaritySum / pairCount : 1;
    const divergence = 1 - avgSimilarity;
    return Math.max(0, Math.min(1, divergence));
  }
}

import { FlagEmbedding, EmbeddingModel } from "fastembed";
import type { ScoringStrategy } from "../types.js";

// Local, deterministic embedding-based divergence scoring — no paid vendor API, so
// the tool adds no dependency beyond the 3 providers being compared. fastembed
// downloads its ONNX model on first use; showDownloadProgress surfaces that instead
// of leaving the terminal silent during a multi-MB first-run download.
let cachedModel: FlagEmbedding | null = null;

async function getModel(): Promise<FlagEmbedding> {
  if (!cachedModel) {
    cachedModel = await FlagEmbedding.init({
      model: EmbeddingModel.BGESmallENV15,
      showDownloadProgress: true,
    });
  }
  return cachedModel;
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

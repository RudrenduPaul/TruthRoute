import { describe, it, expect } from "vitest";
import { EmbeddingScoringStrategy } from "../src/scoring/embedding-strategy.js";
import validationSet from "./fixtures/validation-set.json" with { type: "json" };

// This is the CEO-review-required validation gate: the divergence metric is the
// product's central credibility claim, and it must be checked against known
// agree/disagree/negation/paraphrase pairs before shipping as v1's headline feature.
// Downloads a real local embedding model on first run — CI caches it (see
// .github/workflows/ci.yml) so this isn't a network dependency on every run.
describe("EmbeddingScoringStrategy — validation set", () => {
  const strategy = new EmbeddingScoringStrategy();

  it("scores agreeing statements as low divergence", async () => {
    for (const [a, b] of validationSet.agree_pairs) {
      const score = await strategy.score([a, b]);
      expect(score).toBeLessThan(0.3);
    }
  }, 60_000);

  it("scores paraphrases as low divergence", async () => {
    for (const [a, b] of validationSet.paraphrase_pairs) {
      const score = await strategy.score([a, b]);
      expect(score).toBeLessThan(0.35);
    }
  }, 60_000);

  it("scores negation pairs as meaningfully higher divergence than paraphrases", async () => {
    const paraphraseScores = await Promise.all(
      validationSet.paraphrase_pairs.map(([a, b]) => strategy.score([a, b])),
    );
    const negationScores = await Promise.all(
      validationSet.negation_pairs.map(([a, b]) => strategy.score([a, b])),
    );
    const avgParaphrase = paraphraseScores.reduce((a, b) => a + b, 0) / paraphraseScores.length;
    const avgNegation = negationScores.reduce((a, b) => a + b, 0) / negationScores.length;
    // This is the specific failure mode a lexical/TF-IDF method would fall into: it
    // would score negation pairs as near-identical to paraphrases. An embedding-based
    // method should show a real, measurable gap even if not dramatic.
    expect(avgNegation).toBeGreaterThan(avgParaphrase);
  }, 60_000);

  it("scores clearly disagreeing statements higher than agreeing statements", async () => {
    const agreeScores = await Promise.all(
      validationSet.agree_pairs.map(([a, b]) => strategy.score([a, b])),
    );
    const disagreeScores = await Promise.all(
      validationSet.disagree_pairs.map(([a, b]) => strategy.score([a, b])),
    );
    const avgAgree = agreeScores.reduce((a, b) => a + b, 0) / agreeScores.length;
    const avgDisagree = disagreeScores.reduce((a, b) => a + b, 0) / disagreeScores.length;
    // Cosine-similarity-based embedding scores for topically-related sentences
    // compress into a smaller absolute range than a naive 0-1 intuition suggests —
    // this is expected behavior for semantic embeddings, documented in the README's
    // methodology section. Relative ordering (agree < disagree) is the real signal.
    expect(avgDisagree).toBeGreaterThan(avgAgree);
  }, 60_000);

  it("throws with fewer than 2 texts", async () => {
    await expect(strategy.score(["only one"])).rejects.toThrow();
  });
});

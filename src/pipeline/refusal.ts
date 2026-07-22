// Heuristic refusal/hedge detector — deliberately not an LLM-judge call, so it adds
// zero extra vendor dependency and keeps latency/cost predictable. By design,
// refused responses must be EXCLUDED from the divergence-score input set
// entirely, not merely flagged, since "refusal boilerplate vs. real answer" text
// distance is not factual disagreement and would otherwise dominate the score.
const REFUSAL_PHRASES = [
  "i can't help with that",
  "i cannot help with that",
  "i can't assist with that",
  "i'm not able to help with that",
  "i am not able to help with that",
  "i won't be able to help",
  "i cannot provide",
  "i can't provide",
  "i'm unable to",
  "i am unable to",
  "as an ai",
  "i must decline",
  "i'm not comfortable",
  "against my guidelines",
  "i don't feel comfortable",
];

export function isRefusal(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  if (normalized.length === 0) return false;
  return REFUSAL_PHRASES.some((phrase) => normalized.includes(phrase));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Length-outlier check: only meaningful with 3+ responses to form a distribution.
// At n=2 "outlier" is statistically undefined (both points are symmetric), so this
// check must not fire below n=3.
//
// Uses distance from the median as a fraction of the median, not a z-score. A
// population-stddev z-score is mathematically incapable of exceeding roughly sqrt(2)
// at n=3 when two responses happen to be close in length — verified directly: even an
// extreme single outlier against two similar-length responses caps out around z=1.41,
// so any z-based threshold above that can never fire in exactly the case it exists to
// catch. The median-ratio method has no such ceiling and was checked against both a
// near-uniform case (must not fire) and a genuine outlier case (must fire) before
// picking the threshold.
const OUTLIER_RATIO_THRESHOLD = 0.5;

export function lengthOutlierIndex(texts: string[]): number | null {
  if (texts.length < 3) return null;
  const lengths = texts.map((t) => t.length);
  const med = median(lengths);
  if (med === 0) return null;
  let maxRatio = 0;
  let outlierIdx: number | null = null;
  lengths.forEach((len, idx) => {
    const ratio = Math.abs(len - med) / med;
    if (ratio > maxRatio && ratio > OUTLIER_RATIO_THRESHOLD) {
      maxRatio = ratio;
      outlierIdx = idx;
    }
  });
  return outlierIdx;
}

// Strips markdown/formatting before scoring so systematic verbosity/style differences
// between providers (Claude vs. GPT vs. Gemini defaults) aren't measured as semantic
// divergence.
export function normalizeForScoring(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?|```/g, "")) // code fences
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italics
    .replace(/^[-*+]\s+/gm, "") // bullet markers
    .replace(/^\d+\.\s+/gm, "") // numbered list markers
    .replace(/\s+/g, " ")
    .trim();
}

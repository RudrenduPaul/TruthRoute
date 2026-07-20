# TODOS

## Non-English prompt handling for refusal detection

**What:** The refusal-heuristic classifier (phrase-matching against known refusal/hedge phrases) is implicitly English-only.
**Why:** No stated behavior for non-English prompts — refusal detection will silently under-perform or misfire on non-English model responses.
**Pros:** Broadens the tool's real usefulness beyond English-only research use cases.
**Cons:** Requires either multilingual phrase lists or a language-agnostic refusal-detection approach — added scope.
**Context:** Identified during initial design work. Not blocking v1, which is scoped to prove the core loop.
**Effort estimate:** M (human) → S (with AI assistance)
**Priority:** P3
**Depends on:** v1 refusal-heuristic implementation must exist first.

## Disclose third-party prompt transmission in README

**Status: DONE.** The README's FAQ ("Is this safe to run against sensitive prompts?", "Do I need my own API keys?") and Methodology section already state this plainly.

## Track fastembed's unverified download / vulnerable tar dependency

**What:** fastembed downloads its embedding model from a fixed GCS bucket (`storage.googleapis.com/qdrant-fastembed/`) with no checksum verification, then extracts it with `tar@6.2.1`, which carries known path-traversal CVEs. Upgrading to `tar@7.x` breaks fastembed's own CJS/ESM import (tar v7's ESM build has no default export).
**Why:** Real, verified supply-chain risk chain, accepted for now since exploitation requires compromising Qdrant's GCS bucket specifically, not anything a TruthRoute user or prompt controls.
**Pros:** Documented and tracked instead of silently accepted.
**Cons:** No control over the fix timeline; depends on upstream (Qdrant/fastembed).
**Context:** Found during the security audit before the repo went public, 2026-07-20. File an issue against `qdrant/fastembed` requesting either a checksum-verified download or a tar dependency bump compatible with tar v7's ESM shape.
**Effort estimate:** S (human, filing the issue) → depends on upstream for the actual fix.
**Priority:** P2
**Depends on:** Upstream fastembed maintainers.

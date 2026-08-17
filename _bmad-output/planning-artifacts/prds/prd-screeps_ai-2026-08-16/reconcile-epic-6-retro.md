# Reconciliation — epic-6-retro-2026-08-16.md vs. prd.md / addendum.md

Performed inline (fast path, solo/tight stakes — no subagent dispatched; the retro doc was authored in this same session and is already fully in working context, so re-ingestion adds no signal).

## Coverage

| Retro item | Landed in PRD? | Where |
|---|---|---|
| Root cause: tier cascade, no colony-wide/proportional cap (Finding 1) | Yes | §2, FR-8 |
| SM-1 contradiction, live-observed starvation (Finding 2) | Yes | §2 |
| Verification gap: no population-distribution test (Finding 3) | Gap found, now closed | NFR-4 (added during reconciliation) |
| Accepted deviation: `fill.maxWorkers=6` (Finding 4) | Implicitly moot | §6 (AD-7 ordering clause retired, replaced by pool caps) — not called out by name, correctly so: it's a Stage 1 config value, not a Stage 2 requirement |
| AD-5 binary Era blocks specialist-lite (Finding 5) | Yes | §2, FR-12 |
| What carries forward unchanged (Finding 6) | Yes | §0 closing paragraph, §6 "Kept, unchanged" |
| Action item 1 (retire AD-5/AD-7) | Yes | §6 |
| Action item 2 (population-distribution test class) | Gap found, now closed | NFR-4 |
| Action item 3 (carry-forward machinery, no action) | Yes | §6 |
| Action item 4 (Epic 1 doc — standalone interface-pattern reference) | Correctly excluded | Out of Stage 2 scope, unrelated to the pivot |
| Action item 5 (6-7/6-8 housekeeping) | Yes | §9 open item |

## Gaps found

One: NFR-4 was missing (the retro's Finding 3 / action item 2 — no test ever modeled colony-wide job-type distribution — had no corresponding requirement in the draft). Closed by adding NFR-4 during this reconciliation pass.

No other gaps. Qualitative content (tone, rationale, "why this pivot" framing) is preserved via §2's direct restatement rather than a bare citation.

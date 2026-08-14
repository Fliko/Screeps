# Token & Review Analysis — Stories 5-3 & 5-4

Batch: `spec-5-3-body-selection-affordability.md` + `spec-5-4-spawn-priority-ordering-colony-observation.md`, built together in one `bmad-build` run (2026-08-14). Spec+plan on Sonnet 5, implement on Haiku 4.5, review on Sonnet 5.

## Subagent Tokens, Duration & Tool Use

| Agent | Tokens | Duration | Tool calls |
|---|---|---|---|
| 5-3 implement | 87,682 | 416.7s | 92 |
| 5-4 implement | 45,766 | 120.8s | 25 |
| Review: blind-hunter | 32,064 | 56.4s | 1 |
| Review: edge-case-hunter | 46,527 | 73.1s | 9 |
| Review: verification-gap | 48,130 | 53.1s | 14 |
| **Subagent total** | **260,169** | **720.1s** | **141** |

Note: excludes main-thread (orchestrator) tokens — investigation, spec authoring, diff construction, triage — which were not separately measurable.

## Spec Size

| Spec | Words |
|---|---|
| spec-5-3-body-selection-affordability.md | 786 |
| spec-5-4-spawn-priority-ordering-colony-observation.md | 837 |

## Diff Size Per Story

Both stories edited the same functions in `src/control/spawn.ts` and `src/config.ts` in one continuous working tree with no intermediate commit/stash between the two implementation runs, so there's no exact per-story `git diff`. The split below is manual hunk-level attribution (by reading each hunk against each spec's Code Map), cross-checked line-for-line against the combined `git diff --numstat` — every file and story total below sums exactly to the real combined diff (207 insertions / 14 deletions across 22 files), so this is verified, not estimated.

| File | 5-3 (+/-) | 5-4 (+/-) | Unrelated (+/-) |
|---|---|---|---|
| `src/config.ts` | +18/-3 | +12/-0 | +1/-1 (`lifetimeClass` scope-creep) |
| `src/control/spawn.ts` | +4/-5 | +34/-1 | — |
| `test/config.test.ts` | +2/-2 | +2/-0 | — |
| `test/control/spawn.test.ts` | +47/-1 | +37/-1 | — |
| `src/game.ts` | +4/-0 | — | — |
| `src/world/snapshot.ts` | +5/-0 | — | — |
| `test/world/snapshot.test.ts` | +23/-0 | — | — |
| 15× `GameAdapter` mock-only test files | +18/-0 (1-3 lines each) | — | — |
| **Total** | **+121/-11** (22 files touched) | **+85/-2** (4 files touched, all shared with 5-3) | **+1/-1** |

5-4 touched zero files exclusively — every line it added landed in a file 5-3 also touched. 5-3 did the bulk of the file-count work (adapter plumbing + mechanical mock updates across 18 files); 5-4 did the bulk of the line-count work inside `spawn.ts` (the `selectSpawnReason` function + its wiring, +34 lines in one file).

## Triage Outcomes

| Layer | Findings | Triage outcome |
|---|---|---|
| blind-hunter | 11 | 10 reject, 1 defer (lifetimeClass scope-creep, logged not fixed) |
| edge-case-hunter | 3 | 3 reject (matched existing precedent or explicit spec Never-boundary) |
| verification-gap | 0 | clean pass, confirmed existing test coverage sufficient |

Zero `patch` or `bad_spec` findings — no code changed as a result of review.

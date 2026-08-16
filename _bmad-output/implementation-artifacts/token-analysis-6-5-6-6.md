# Token & Review Analysis — Stories 6.5 & 6.6

Batch: `spec-6-5-harvester-behavior.md` + `spec-6-6-collector-behavior.md`, built together in one `bmad-build` run (2026-08-14). Spec+plan on Sonnet 5, implement on Haiku 4.5, review on Sonnet 5.

## Subagent Tokens, Duration & Tool Use

| Agent | Tokens | Duration | Tool calls |
|---|---|---|---|
| 6.5 implement | 76,603 | 299.6s | 52 |
| 6.6 implement | 68,221 | 222.9s | 41 |
| Review: code-review | 61,902 | 3609.5s | 35 |
| **Subagent total** | **206,726** | **4131.9s** | **128** |

Note: excludes main-thread (orchestrator) tokens — investigation, spec authoring, diff construction, triage — which were not separately measurable. Review duration includes comprehensive analysis across the combined diff.

## Spec Size

| Spec | Words |
|---|---|
| spec-6-5-harvester-behavior.md | 1,125 |
| spec-6-6-collector-behavior.md | 926 |

## Diff Size Per Story

Both stories edited multiple core files in the working tree with no intermediate commit/stash between the two implementation runs. Attribution by function/section ownership per each spec's Code Map, verified against actual changes:

| File | 6.5 (+/-) | 6.6 (+/-) | Both (+/-) |
|---|---|---|---|
| `src/game.ts` | +17/-1 | — | — |
| `src/agents/behaviors/harvest.ts` | +86/-0 | — | — |
| `src/agents/behaviors/withdraw.ts` | — | +86/-0 | — |
| `src/agents/behaviors/run.ts` | +7/-0 | +14/-0 | — |
| `src/agents/sourcing.ts` | — | +41/-0 | — |
| `src/config.ts` | — | +3/-0 | — |
| `test/game.test.ts` | +47/-1 | — | — |
| `test/agents/behaviors/harvest.test.ts` | +536/-0 | — | — |
| `test/agents/behaviors/withdraw.test.ts` | — | +330/-0 | — |
| `test/agents/behaviors/run.test.ts` | +44/-1 | +145/-0 | — |
| `test/agents/sourcing.test.ts` | — | +55/-1 | — |
| `test/config.test.ts` | — | +6/-0 | — |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | +1/-1 | — | — |
| **Total** | **+738/-3** (9 files) | **+680/-1** (8 files, 2 exclusive) | **+1418/-4** |

6.5 focused on the AD-10 seam fix (game.ts Container merging) and Harvester behavior with comprehensive tests; 6.6 added source-strategy derivation, withdraw interceptor, and behavior tests. Only `run.ts` shows both stories touching (6.5 adds mine dispatch, 6.6 adds withdraw interceptor).

## Triage Outcomes

| Layer | Findings | Triage outcome |
|---|---|---|
| code-review (medium) | 0 | clean pass, all tests pass, types clean, zero logic/boundary issues |

Zero findings — no code changed as a result of review. All acceptance criteria satisfied, all I/O Matrix rows covered by passing tests, all verification checks passed.

## Key Metrics

- **Spec-to-code token ratio**: 1,125 + 926 = 2,051 spec words → 206,726 tokens implementation (implementation ~100x spec word count)
- **Implementation efficiency**: 76.6k + 68.2k = 144.8k for two complete behaviors + Container fix + ~850 lines of tests
- **Test coverage**: 384 total tests pass; new tests cover all I/O Matrix scenarios for both behaviors
- **Review confidence**: Zero findings across code logic, error handling, type safety, and integration points

# Token & Review Analysis — Stories 6-1 through 6-4

Batch: `spec-6-1-era-derivation-in-the-snapshot.md` + `spec-6-2-mine-producer-era-gating.md` + `spec-6-3-container-first-construction.md` + `spec-6-4-reserved-slot-spawning-specialist-bodies.md`, built together in one `bmad-build` run (2026-08-14), user-requested batching with explicit phase pauses. Investigation+spec+plan on Sonnet 5, implement on Haiku 4.5, review on Sonnet 5 — plus one review layer (verification-gap) run inline by the Sonnet 5 orchestrator after its subagent hit a session-usage limit.

## Subagent Tokens, Duration & Tool Use

| Agent | Tokens | Duration | Tool calls |
|---|---|---|---|
| Epic-6 context compile | 48,233 | 50.2s | 7 |
| Investigate: 6-1 (era derivation) | 29,321 | 208.1s | 9 |
| Investigate: 6-2 (mine producer) | 28,136 | 47.8s | 13 |
| Investigate: 6-3 (container-first) | 23,538 | 47.8s | 12 |
| Investigate: 6-4 (reserved-slot spawn) | 44,881 | 86.3s | 18 |
| Implement: 6-1 | 53,798 | 755.0s | 37 |
| Implement: 6-2 | 58,682 | 255.0s | 43 |
| Implement: 6-3 | 67,110 | 161.1s | 41 |
| Implement: 6-4 | 79,575 | 247.3s | 50 |
| Review: blind-hunter | 62,638 | 133.9s | 6 |
| Review: edge-case-hunter | 70,566 | 122.0s | 10 |
| Review: verification-gap | — (hit session limit, failed) | — | — |
| **Subagent total** | **566,478** | **2,114.5s** | **246** |

Investigation and implementation ran one story at a time, sequentially, per the user's explicit phase-pause request (plan all 4 → pause for model switch → implement all 4 → pause → review all 4). The two completed review layers ran in parallel against one combined diff (all 4 stories reviewed as a single pass, not 4 separate cycles, per user instruction). Excludes main-thread (orchestrator) tokens — investigation-result triage, spec authoring, diff construction, the inline verification-gap pass, and patch application — which were not separately measurable.

## Spec Size

| Spec | Words |
|---|---|
| spec-6-1-era-derivation-in-the-snapshot.md | 847 |
| spec-6-2-mine-producer-era-gating.md | 820 |
| spec-6-3-container-first-construction.md | 990 |
| spec-6-4-reserved-slot-spawning-specialist-bodies.md | 1,197 |

## Diff Size Per Story

Unlike the 5-3/5-4 batch, these four stories touched almost entirely separate files (era derivation, mine Producer, build-priority, and spawn control are structurally distinct concerns), so attribution below is by each spec's own Code Map/Execution-task ownership rather than a verified hunk-by-hunk audit — approximate, not exact. Combined diff: **1,272 insertions(+), 55 deletions(-) across 18 files** (post review-fixes).

| File | Story | Lines (+/-) |
|---|---|---|
| `src/world/snapshot.ts` | 6-1 | +65/-0 |
| `test/world/snapshot.test.ts` | 6-1 | +399/-0 |
| `test/world/producers/fill.test.ts` | 6-1 (mechanical: `era` field) | +1/-0 |
| `test/world/producers/upgrade.test.ts` | 6-1 (mechanical: `era` field) | +1/-0 |
| `src/world/producers/mine.ts` (new) | 6-2 | +27/-0 |
| `test/world/producers/mine.test.ts` (new) | 6-2 | +88/-0 |
| `src/world/producers/run.ts` | 6-2 | +2/-0 |
| `test/world/producers/run.test.ts` | 6-2 | +9/-0 |
| `src/world/producers/build.ts` | 6-3 | +7/-3 |
| `test/world/producers/build.test.ts` | 6-3 (+1 line mechanical from 6-1) | +44/-2 |
| `test/control/match.test.ts` | 6-3 | +20/-0 |
| `src/control/evolution.ts` (new) | 6-4 | +44/-0 |
| `test/control/evolution.test.ts` (new) | 6-4 | +121/-0 |
| `src/control/spawn.ts` | 6-4 | +68/-21 |
| `test/control/spawn.test.ts` | 6-4 | +326/-22 |
| `src/main.ts` | 6-4 | +3/-2 |
| `src/config.ts` | shared (~8 ln 6-1, ~12 ln 6-2, ~10 ln 6-3, ~11 ln 6-4) | +41/-5 |
| `test/config.test.ts` | shared (6-1 + 6-3 constants) | +6/-0 |

## Post-Implementation Review Fixes

Two review-subagent layers completed (blind-hunter, edge-case-hunter); the third (verification-gap) hit a session usage limit mid-run, so the orchestrator ran that pass inline against the same diff instead of retrying the subagent.

| Layer | Findings | Notes |
|---|---|---|
| blind-hunter | 13 | Ran against the full combined diff |
| edge-case-hunter | 2 | Both independently rediscovered by blind-hunter (deduped) |
| verification-gap (inline) | 0 new | Confirmed the 2 edge-case findings were genuinely uncovered by any test; no `main.ts`/loop-level test exists at all |

**Triage (13 unique findings after dedup):**

- **5 patch** (applied, all verified clean after fix — typecheck/test/lint all pass):
  - Harvester body actually costs 300 energy (2×WORK+CARRY+MOVE), declared as 250 — affordability check would pass then `spawnCreep` would silently fail (`src/config.ts:155`)
  - `spawn()` received the pre-validate/pre-release taken-set in `main.ts` instead of the same released set `match()` uses — risked a one-Tick vacancy-detection lag (`src/main.ts:53-56`)
  - Reserved-vacancy branch re-derived vacancy manually instead of reusing `hasCapacity` from `taken.ts` (`src/control/spawn.ts`)
  - Stale top-of-file JSDoc on `spawn()` never updated for the new reason-branching behavior
  - Leftover think-out-loud scratch comment in a test
- **1 defer** (logged to `deferred-work.md`, not fixed): `spawn()` has no fallback to a lower-priority present reason when the selected reason's body is unaffordable — matches the spec's own I/O Matrix/AC exactly (not a code bug), self-heals next Tick, flagged for deliberate attention alongside Story 6.7
- **7 reject**: `deriveEra` has no hysteresis (intentional per AD-5, no persisted era state), stale "Refined by Story 6.4" doc-comment framing, no positive test for the deferred fallback gap, no test enforcing `JOB_POLICY_TABLE.mine.requirements.body` stays synced with `BODY_COMPOSITIONS.harvester` (already same constant reference), `BUILD_STRUCTURE_PRIORITY` type shape mixing a `default` key (stylistic, no bug), 3 new spawn tests mock `getCurrentSnapshot` directly rather than driving real `deriveEra` (deliberate test-isolation choice, era already covered exhaustively in `snapshot.test.ts`), no test for the zero-Sources + demand-pressure combination (coverage suggestion, not a defect)

Unlike 5-3/5-4 (zero patches, everything rejected/deferred), this batch had real code bugs surface — the Harvester cost mismatch in particular would have silently broken Specialist-era Harvester spawning at 250–299 stored energy, undetected by the story's own tests since they derived their expected energy from the same buggy constant.

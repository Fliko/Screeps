---
title: 'Mine Producer & Era Gating'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'bf6cc078a5afd569fe742cd923d98ca6d1710817'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Once the colony reaches the Specialist era (Story 6.1's `WorldSnapshot.era`), Sources need a dedicated Reserved mining slot so Harvesters can be spawned into them — but no Producer emits mine Jobs today, and `mine` is explicitly excluded from the Job policy table pending this story.

**Approach:** Add a `mine` Producer (`world/producers/mine.ts`) that emits exactly one Reserved, persistent `mine:<sourceId>` Job per Source, gated on `snapshot.era === "specialist"`, following the existing Producer pattern (`build.ts`/`upgrade.ts`). Wire it into `runProducers()` and extend `JOB_POLICY_TABLE` to cover `mine`.

## Boundaries & Constraints

**Always:**
- Mine Producer emits zero Jobs when `snapshot.era !== "specialist"` — hard gate at the top of the function, same idiom as `upgrade.ts`'s no-target guard.
- When era is `"specialist"`, emit exactly one `mine:<sourceId>` Job per entry in `snapshot.sources` (one Producer → one Job per object, never aggregated, per AD-3).
- Job fields: `assignmentMode: "reserved"`, `lifetimeClass: "persistent"`, `maxWorkers: 1`, sourced from `JOB_POLICY_TABLE.mine` via `getConstant`, not hardcoded in the Producer.
- Widen `JobPolicyTable` type in `src/config.ts` from `Record<Exclude<JobType, "mine">, JobTypePolicy>` to `Record<JobType, JobTypePolicy>` and add the `mine` entry.
- Producer stays pure: takes `WorldSnapshot`, returns `Job[]`, no Game API calls, no Board writes (AD-10).
- Add a placeholder `HARVESTER_BODY: BodyPartConstant[]` constant in `src/config.ts` (WORK-heavy, documented as refined by Story 6.4) so `JOB_POLICY_TABLE.mine.requirements.body` has a concrete value now.
- Wire `produceMine(snapshot)` into `runProducers()` in `world/producers/run.ts` alongside the existing fill/build/upgrade calls.

**Ask First:** None — all fields and gating are fully specified above.

**Never:**
- Never offer mine Jobs through Matching logic — that remains true by construction (Reserved assignment mode already excludes Jobs from the Pulled Matching path per existing AssignmentMode handling; no Matching code changes in this story).
- Never call `Game` API or read Memory inside the Producer — snapshot-only.
- Out of scope: Spawn Management filling the Reserved slot (Story 6.4), Harvester behavior (Story 6.5), the real `HARVESTER_BODY` composition (Story 6.4 refines the placeholder added here).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Generalist era | `era: "generalist"`, 2 sources | `[]` (no mine Jobs) | N/A |
| Specialist era, one source | `era: "specialist"`, `sources: [S1]` | `[{ id: "mine:S1", assignmentMode: "reserved", lifetimeClass: "persistent", maxWorkers: 1 }]` | N/A |
| Specialist era, multiple sources | `era: "specialist"`, `sources: [S1, S2]` | Two Jobs, `mine:S1` and `mine:S2` | N/A |
| Specialist era, zero sources | `era: "specialist"`, `sources: []` | `[]` | N/A |

</frozen-after-approval>

## Code Map

- `src/world/producers/build.ts` -- reference Producer pattern (`.map()` over one snapshot list → one Job list)
- `src/world/producers/upgrade.ts:11-13` -- reference no-target-guard idiom, reused for the era gate
- `src/world/producers/mine.ts` -- NEW FILE, this story's core deliverable
- `src/world/producers/run.ts:13-32` -- `runProducers()`; add import + 4th spread entry for `produceMine`
- `src/board/job.ts:15-18` -- `JobType`/`AssignmentMode`/`LifetimeClass` unions already include `"mine"`/`"reserved"`/`"persistent"`; no changes needed
- `src/board/job.ts` -- `makeJob`/`makeJobId`/`parseJobId` already handle `mine:<sourceId>` grammar; reuse as-is
- `src/config.ts:44-49` -- doc comment explicitly earmarking this story to add `mine` to `JobPolicyTable`
- `src/config.ts:23` -- `JobTypePolicy.requirements.body: BodyPartConstant[]` -- needs concrete value; add `HARVESTER_BODY` placeholder constant
- `src/config.ts:88-113` -- `JOB_POLICY_TABLE` object; add `mine` entry here
- `src/control/generate.ts:16-24` -- confirms `resetBoard()` → `buildWorldSnapshot()` → `runProducers()` order; no changes needed
- `test/world/producers/fill.test.ts` -- reference test pattern (local `snapshot()`/`source()` builder helpers)
- `test/world/producers/mine.test.ts` -- NEW FILE, mirrors `fill.test.ts` pattern

## Tasks & Acceptance

**Execution:**
- [x] `src/config.ts` -- add `HARVESTER_BODY: BodyPartConstant[]` constant (WORK-heavy placeholder) and doc-comment it as refined by Story 6.4 -- satisfies `requirements.body` without inventing final composition
- [x] `src/config.ts` -- widen `JobPolicyTable` type to `Record<JobType, JobTypePolicy>`; add `mine: { tier, withinTierPriority, maxWorkers: 1, assignmentMode: "reserved", lifetimeClass: "persistent", requirements: { body: HARVESTER_BODY } }` to `JOB_POLICY_TABLE` -- closes the gap the Story 3.4-era doc comment earmarked
- [x] `src/world/producers/mine.ts` -- new Producer: `export function produceMine(snapshot: WorldSnapshot): Job[]`, returns `[]` if `snapshot.era !== "specialist"`, else `.map()` over `snapshot.sources` into `mine:<sourceId>` Jobs via `makeJob`
- [x] `src/world/producers/run.ts` -- import `produceMine`, add to the spread/array passed into `runProducers()`
- [x] `test/world/producers/mine.test.ts` -- cover all four I/O Matrix scenarios

**Acceptance Criteria:**
- Given `snapshot.era === "specialist"` and N Sources, when `produceMine(snapshot)` runs, then exactly N Jobs are returned, one per Source, each `id === "mine:<sourceId>"`.
- Given `snapshot.era === "generalist"`, when `produceMine(snapshot)` runs, then it returns `[]` regardless of Source count.
- Given `runProducers()` executes in the normal control cycle, when era is `"specialist"`, then the Board contains mine Jobs alongside fill/build/upgrade Jobs with no staleness-guard violation.

## Spec Change Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with `strict: true`; `JobPolicyTable` widening does not break existing fill/build/upgrade entries
- `npm run test` -- expected: all new `mine.test.ts` cases pass, existing producer/run tests unaffected
- `npm run lint` -- expected: clean Biome check

## Suggested Review Order

_This review covers the combined Epic 6 diff (Stories 6.1–6.4), reviewed as one pass._

**Era derivation (entry point)**

- Pure function gating everything else in Epic 6 — read this first.
  [`snapshot.ts:101`](../../src/world/snapshot.ts#L101)

- Wired into the per-Tick snapshot build; sets the field everything downstream reads.
  [`snapshot.ts:181`](../../src/world/snapshot.ts#L181)

**Mine Producer & Container-first construction**

- Era-gated Producer, one Reserved Job per Source, same shape as existing Producers.
  [`mine.ts:11`](../../src/world/producers/mine.ts#L11)

- Per-site priority lookup replaces the flat scalar — Container sites now outrank others via existing Matching cascade.
  [`build.ts:23`](../../src/world/producers/build.ts#L23)

**Reserved-slot spawning & specialist bodies**

- New pure presence checks feed Story 5.4's already-proven priority selection.
  [`evolution.ts:19`](../../src/control/evolution.ts#L19)
  [`evolution.ts:33`](../../src/control/evolution.ts#L33)

- Core branch: picks body kind and writes the mine Contract at spawn time (AD-2), bypassing Matching.
  [`spawn.ts:44`](../../src/control/spawn.ts#L44)

- Fix applied during review: `spawn()` now receives the post-validate/post-match released taken-set, matching `match()` — a stale pre-release set risked a one-Tick vacancy-detection lag.
  [`main.ts:56`](../../src/main.ts#L56)

**Config — policy and body data**

- Fix applied during review: Harvester body actually costs 300 energy (2×WORK+CARRY+MOVE), not the originally-declared 250 — affordability check would have passed then failed spawnCreep.
  [`config.ts:155`](../../src/config.ts#L155)

- Reserved mine Job policy — Body requirement, assignment mode, lifetime class as data.
  [`config.ts:133`](../../src/config.ts#L133)

- Structure-type-keyed build priority table (Container-first).
  [`config.ts:166`](../../src/config.ts#L166)

**Peripherals**

- New test files: [`evolution.test.ts`](../../test/control/evolution.test.ts), [`mine.test.ts`](../../test/world/producers/mine.test.ts)
- Extended: [`spawn.test.ts`](../../test/control/spawn.test.ts), [`build.test.ts`](../../test/world/producers/build.test.ts), [`snapshot.test.ts`](../../test/world/snapshot.test.ts), [`match.test.ts`](../../test/control/match.test.ts)

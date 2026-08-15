---
title: 'Reserved-Slot Spawning & Specialist Bodies'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'bf6cc078a5afd569fe742cd923d98ca6d1710817'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `control/spawn` only ever presents `"population-topup"` to `selectSpawnReason` (Story 5.4's ordering machinery is proven but fed nothing real); it has no notion of a vacant Reserved mine slot (Story 6.2) or Collector delivery demand, no Harvester/Collector body compositions, and no precedent for writing a Contract into a Creep's initial memory.

**Approach:** Add `control/evolution.ts` (pure, Board+taken-set in, `SpawnPriorityReason[]` presence out) computing `"reserved-vacancy"` (any vacant `mine:*` Job) and `"demand-pressure"` (Specialist era, any vacant Pulled Job). Widen `BodyKind`/`BODY_COMPOSITIONS` with `harvester`/`collector` entries. Extend `spawn()` to consume the taken-set, call `selectSpawnReason` with the richer presence array, pick body+name per reason, and — for `"reserved-vacancy"` — write the target mine Job's Contract into the Creep's initial memory via `setContract` (AD-2), bypassing Matching entirely.

## Boundaries & Constraints

**Always:**
- `spawn(takenSet)` takes the taken-set as a parameter (signature change); `main.ts`'s call site passes the already-derived taken-set (it exists in scope there today).
- `control/evolution.ts` is pure: given `board.jobs` and the taken-set, `hasReservedVacancy` returns true iff any `type === "mine"` Job has `hasCapacity(takenSet, job) === true` (Story 6.2 sets `maxWorkers: 1`, so untaken means vacant); `hasDemandPressure` returns true iff `snapshot.era === "specialist"` AND any Job with `assignmentMode === "pulled"` has `hasCapacity(takenSet, job) === true`.
- `present` array in `spawn()` is built from `["reserved-vacancy"]`/`["demand-pressure"]`/`["population-topup"]` conditionally, same pattern as Story 5.4, then passed unchanged to the existing `selectSpawnReason`.
- `BodyKind` widens to `"generalist" | "harvester" | "collector"`; `BODY_COMPOSITIONS` gets `harvester` (WORK-heavy, formalizing/replacing Story 6.2's `HARVESTER_BODY` placeholder) and `collector` (CARRY/MOVE-heavy, exactly one WORK part) entries.
- Affordability check (`snapshot.energyAvailable < cost`) is replicated per selected body kind's cost, same inline pattern as today — never spawn a body the colony can't afford.
- For `"reserved-vacancy"`: pick the vacant mine Job (any one, since MVP has one Spawn), spawn with the `harvester` body, and write its Contract via `setContract` against the `spawnCreep` memory options before issuing the intent — the Creep is born already under Contract and never enters Matching.
- For `"demand-pressure"`: spawn with the `collector` body and `{ memory: {} }` (no Contract) — Collectors claim their first Pulled Contract through ordinary Matching next Tick, same as Generalists do today.
- `JOB_POLICY_TABLE.mine.requirements.body` is updated to reference the formal `BODY_COMPOSITIONS.harvester.parts` instead of Story 6.2's placeholder constant.

**Ask First:** None — all three spawn reasons, body kinds, and the Contract-writing mechanism are fully specified above.

**Never:**
- Never route a Reserved mine Job through `control/match.ts` — it is claimed exclusively at spawn time (AD-2).
- Never spawn a Generalist once any Specialist-era reason (`reserved-vacancy`/`demand-pressure`) wins selection — those reasons pick their own body kind, not `generalist`.
- Never add a same-Tick double-issuance guard for two idle Spawns racing the same vacant mine Job — MVP has exactly one Spawn; the taken-set only reflects a written Contract starting the Tick after `spawnCreep` (pre-existing, unaffected architectural property).
- Out of scope: Harvester/Collector *behavior* (Stories 6.5/6.6) — this story only spawns them with the right body and (for Harvester) Contract; out of scope: era-based Generalist deprecation logic itself (Story 6.7) — this story's demand-pressure/reserved-vacancy reasons simply outrank `population-topup` by existing priority order, which already stops Generalist top-up from firing whenever a higher reason is present.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vacant mine slot | `era: "specialist"`, one `mine:S1` Job untaken, energy affordable | `spawnCreep` called with `harvester` body, `memory.contract === "mine:S1"` | N/A |
| Mine slot filled | `mine:S1` Job already taken (in takenSet) | No `"reserved-vacancy"` presence; falls through to next reason | N/A |
| Demand pressure only | `era: "specialist"`, no vacant mine Jobs, a vacant Pulled fill Job exists | `spawnCreep` called with `collector` body, `memory: {}` | N/A |
| Generalist era, population short | `era: "generalist"`, population < target | `spawnCreep` called with `generalist` body, `memory: {}` (unchanged from today) | N/A |
| Can't afford Harvester | `reserved-vacancy` present, `energyAvailable < harvester cost` | No `spawnCreep` call this Tick | N/A |
| All three present | reserved-vacancy, demand-pressure, and population-topup all true | `selectSpawnReason` picks `reserved-vacancy` per existing fixed order; Harvester spawned | N/A |

</frozen-after-approval>

## Code Map

- `src/control/spawn.ts:32-102` -- `spawn()`; add `takenSet` param, extend `present` construction, branch body/name/memory per selected reason
- `src/control/spawn.ts:59-65` -- comment already anticipates this exact extension point ("Epic 6's job on this same function")
- `src/control/spawn.ts:20-30` -- `selectSpawnReason` -- reuse unchanged
- `src/control/spawn.ts:83-87` -- current `{ memory: {} }` `spawnCreep` call and no-Contract comment -- branch point for Contract-writing
- `src/main.ts:32-55` -- `deriveTakenSet` phase (already computes taken-set) and `spawn()` call site -- pass taken-set through
- `src/control/evolution.ts` -- NEW FILE: `hasReservedVacancy(board, takenSet)`, `hasDemandPressure(board, takenSet, era)`, pure
- `src/control/taken.ts:45-52` -- `hasCapacity`/`getTakenCount` -- reuse for vacancy checks in `evolution.ts`
- `src/board/registry.ts` -- `getBoard()` -- reuse, same pattern as `generate.ts`/`match.ts`
- `src/config.ts:33` -- `BodyKind = "generalist"` -- widen to include `"harvester" | "collector"`
- `src/config.ts:27-30,125-127` -- `BodyComposition`/`BODY_COMPOSITIONS` -- add `harvester`, `collector` entries
- `_bmad-output/implementation-artifacts/spec-6-2-mine-producer-era-gating.md` -- `HARVESTER_BODY` placeholder this story formalizes into `BODY_COMPOSITIONS.harvester`; `JOB_POLICY_TABLE.mine.requirements.body` updated to match
- `src/state/contract.ts:53-59` -- `setContract(obj, contract)` -- reuse against a plain memory-shaped object before passing to `spawnCreep`
- `test/control/spawn.test.ts:46-78` -- `createMockGame` helper and existing assertion pattern on `spawnCreepImpl` call args -- extend for new body kinds and `opts.memory.contract`
- `test/control/spawn.test.ts:446-470` -- existing energy-boundary test pattern -- replicate per new body kind

## Tasks & Acceptance

**Execution:**
- [x] `src/config.ts` -- widen `BodyKind`; add `harvester` (WORK-heavy) and `collector` (CARRY/MOVE-heavy, exactly one WORK part) to `BODY_COMPOSITIONS`; update `JOB_POLICY_TABLE.mine.requirements.body` to `BODY_COMPOSITIONS.harvester.parts`
- [x] `src/control/evolution.ts` -- new pure module: `hasReservedVacancy(jobs, takenSet)`, `hasDemandPressure(jobs, takenSet, era)` using `hasCapacity` from `taken.ts`
- [x] `src/control/spawn.ts` -- accept `takenSet` param; build `present` from `evolution.ts` checks plus existing population-topup logic; on `"reserved-vacancy"`, select the vacant mine Job, spawn `harvester` body with Contract written via `setContract`; on `"demand-pressure"`, spawn `collector` body with `{ memory: {} }`; keep `"population-topup"` path spawning `generalist` unchanged
- [x] `src/main.ts` -- pass the phase's derived taken-set into the `spawn()` call
- [x] `test/control/spawn.test.ts` -- cover all six I/O Matrix scenarios, including Contract-in-memory assertion for reserved-vacancy spawns and affordability boundaries per body kind

**Acceptance Criteria:**
- Given a vacant `mine:<sourceId>` Job and sufficient energy, when `spawn(takenSet)` runs, then a Harvester is spawned with `memory.contract === "mine:<sourceId>"` and never enters Matching.
- Given no reserved vacancy but a vacant Pulled Job in the Specialist era, when `spawn(takenSet)` runs, then a Collector is spawned with no Contract.
- Given the Generalist era with population below target, when `spawn(takenSet)` runs, then behavior is unchanged from pre-6.4: a Generalist is spawned with `{ memory: {} }`.
- Given insufficient `energyAvailable` for the selected body kind's cost, when `spawn(takenSet)` runs, then no `spawnCreep` call is made.

## Spec Change Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with `strict: true`; `BodyKind` widening and `spawn()` signature change are fully typed at all call sites
- `npm run test` -- expected: all new `spawn.test.ts` and `evolution.test.ts` cases pass, no regressions to existing population-topup/TTL-replacement tests
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

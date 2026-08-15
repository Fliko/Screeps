---
title: 'Era Derivation in the Snapshot'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'bf6cc078a5afd569fe742cd923d98ca6d1710817'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The colony has no way to detect it has outgrown the Generalist economy. Evolution readiness (RCL >= 2, all 5 Extensions built, a Container adjacent to every Source) must be visible to downstream systems (mine Producer, spawn policy) without ever being persisted, per AD-5.

**Approach:** Add a pure `Era` derivation ("generalist" | "specialist") computed inside `world/`'s per-Tick snapshot build from already-read `WorldSnapshot` data (controller level, structures, sources), exposed as a new `era` field on `WorldSnapshot`. Recomputed fresh every Tick; no Memory key.

## Boundaries & Constraints

**Always:**
- Era is a pure function of `controller.level`, `structures` (Extensions, Containers), and `sources` already present on the snapshot — no new `GameAdapter` methods.
- Era = `"specialist"` iff RCL >= `ERA_MIN_RCL` AND count of built Extensions >= `ERA_EXTENSIONS_REQUIRED` AND every Source has a Container within Chebyshev range 1 (via `chebyshevDistance`/`liveDistance` from `world/distance.ts`); otherwise `"generalist"`.
- New constants `ERA_MIN_RCL` (2) and `ERA_EXTENSIONS_REQUIRED` (5) added to `src/config.ts`, accessed via `getConstant`.
- The default/empty snapshot object (published before population, per Story 2.1's defensive pattern) includes `era: "generalist"` so a mid-build throw never leaves `era` undefined.
- `Era` type is a plain string-union type alias (no runtime enum, no `isEra` guard needed — it never crosses a serialization boundary).

**Ask First:** None — derivation logic and thresholds are fully specified above.

**Never:**
- Never store era in `Memory` or any cache — recomputed every Tick (AD-5).
- Never add a new `GameAdapter` method for this story — existing `structures`/`sources`/`controller` snapshot data is sufficient.
- Never reimplement adjacency math — reuse `world/distance.ts`.
- Out of scope: mine Producer gating (6.2), spawn policy changes (6.4) — this story only exposes the `era` field.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Below RCL | RCL 1, 0 Extensions, no Containers | `era: "generalist"` | N/A |
| RCL met, Extensions short | RCL 2, 4/5 Extensions built, all Sources containerized | `era: "generalist"` | N/A |
| One Source uncontainerized | RCL 2, 5/5 Extensions, 1 of 2 Sources has adjacent Container | `era: "generalist"` | N/A |
| All conditions met | RCL 2, 5/5 Extensions, every Source has adjacent Container | `era: "specialist"` | N/A |
| No controller (no room vision) | `controller` undefined | `era: "generalist"` | Treat missing controller as RCL 0 |
| Container not adjacent (range 2) | Container exists but Chebyshev distance to Source is 2 | `era: "generalist"` | Source counts as uncontainerized |
| No sources in room | `sources: []` | Vacuous-true for the "every Source" check; era still gated by RCL + Extensions | N/A |

</frozen-after-approval>

## Code Map

- `src/world/snapshot.ts:64-75` -- `WorldSnapshot` type; add `era: Era` field here
- `src/world/snapshot.ts:18-26` -- `SnapshotStructure` (`structureType`, `pos`) -- source of Extension/Container data, no changes needed
- `src/world/snapshot.ts:43-50` -- `SnapshotController` (`level`) -- source of RCL, no changes needed
- `src/world/snapshot.ts:85-123` -- `buildWorldSnapshot()` -- call era derivation after structures/sources/controller are populated (~line 119-120)
- `src/world/snapshot.ts:90-98` -- default/empty snapshot object literal -- add `era: "generalist"` default
- `src/world/distance.ts:23-25` -- `chebyshevDistance(a, b)` -- reuse for Container-adjacent-to-Source check
- `src/game.ts:74-98` -- `GameAdapter` interface -- no changes; confirm `findMyStructures` (line 81, filtered via `isEnergyStructure` lines 104-111) still surfaces Containers
- `src/config.ts:54-134` -- `Config` interface + `constants` object -- add `ERA_MIN_RCL`, `ERA_EXTENSIONS_REQUIRED`
- `test/world/snapshot.test.ts` -- mirrored test file; extend with era cases using `createMockGame()` (lines 9-30) override pattern

## Tasks & Acceptance

**Execution:**
- [x] `src/config.ts` -- add `ERA_MIN_RCL: 2` and `ERA_EXTENSIONS_REQUIRED: 5` to `Config` interface and `constants` object -- new tunables, per project rule "never hardcode MVP constants"
- [x] `src/world/snapshot.ts` -- add `export type Era = "generalist" | "specialist";` near top, following the "String-union types" comment convention from `board/job.ts`
- [x] `src/world/snapshot.ts` -- add pure `deriveEra(structures: SnapshotStructure[], sources: SnapshotSource[], controllerLevel: number | undefined): Era` function using `getConstant("ERA_MIN_RCL")`, `getConstant("ERA_EXTENSIONS_REQUIRED")`, and `chebyshevDistance` from `world/distance.ts`
- [x] `src/world/snapshot.ts` -- add `era: Era` to `WorldSnapshot` type; set default `era: "generalist"` in the empty-snapshot literal; call `deriveEra(...)` in `buildWorldSnapshot()` after structures/sources/controller are populated
- [x] `test/world/snapshot.test.ts` -- add cases covering all seven I/O Matrix scenarios via `createMockGame()` overrides, asserting `snapshot.era`

**Acceptance Criteria:**
- Given RCL >= 2, 5 built Extensions, and every Source with an adjacent Container, when `buildWorldSnapshot()` runs, then `snapshot.era === "specialist"`.
- Given any one Evolution condition unmet, when `buildWorldSnapshot()` runs, then `snapshot.era === "generalist"`.
- Given a mid-build adapter throw, when the empty snapshot is published defensively, then `era` is `"generalist"`, never `undefined`.
- Given the room has zero Sources, when `buildWorldSnapshot()` runs with RCL/Extensions conditions met, then era is not blocked by the (vacuous) Source-containerization check.

## Spec Change Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with `strict: true`, no `era`-related type errors
- `npm run test` -- expected: all new `snapshot.test.ts` era cases pass, no regressions
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

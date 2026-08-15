---
title: 'Container-First Construction'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'bf6cc078a5afd569fe742cd923d98ca6d1710817'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Once RCL >= 2, Source-adjacent Container construction sites must outrank all other construction so the colony reaches Evolution readiness quickly — but `produceBuild` today applies one flat `withinTierPriority` to every construction site, uniformly, per its own header comment flagging this as a known gap.

**Approach:** Add a data-driven, structureType-keyed priority table in `src/config.ts` (`BUILD_STRUCTURE_PRIORITY`, with a default fallback) and have `produceBuild` select `withinTierPriority` per site from that table instead of one scalar. No changes to `control/match.ts` — the existing tier → withinTierPriority → distance ordering (Story 3.4, AD-7) already makes a higher-priority Container site beat a nearer ordinary site.

## Boundaries & Constraints

**Always:**
- Container priority is expressed as **data** in `src/config.ts`, never as an `if (structureType === ...)` special case inside `produceBuild` or `match.ts` (AD-7).
- New config shape: `BUILD_STRUCTURE_PRIORITY: Partial<Record<BuildableStructureConstant, number>>` with a `default` fallback value, both accessed via `getConstant`.
- `Container` (`STRUCTURE_CONTAINER`) maps to a higher `withinTierPriority` number than the default; all other `structureType`s fall back to the existing default (currently `0`).
- All Container sites stay in the same `tier` (`"medium"`) as other build Jobs — only `withinTierPriority` differs; tier is unchanged so this remains a within-tier priority shift, not a new tier.
- `produceBuild` becomes: for each `snapshot.constructionSites` entry, look up `withinTierPriority` from `BUILD_STRUCTURE_PRIORITY[site.structureType] ?? BUILD_STRUCTURE_PRIORITY.default`; all other Job fields (`tier`, `maxWorkers`, `assignmentMode`, `lifetimeClass`, `requirements`) still come from `JOB_POLICY_TABLE.build` unchanged.
- Update `produceBuild`'s header comment once implemented — it currently documents this exact gap and must not keep saying "all sites are priority 0."

**Ask First:** None — the approach follows the existing AD-7 policy-table pattern exactly; no architectural ambiguity remains.

**Never:**
- Never verify Container-to-Source adjacency in this story — operators place Container sites manually at Source-adjacent spots (epic constraint); this story only reacts to `structureType`.
- Never change `control/match.ts`'s ordering logic — the existing tier→priority→distance cascade already delivers the desired outcome once the Job carries the right `withinTierPriority`.
- Never change `Job` or `makeJob` shape in `src/board/job.ts` — a Job instance already carries one concrete `withinTierPriority` number.
- Out of scope: RCL-gating this behavior (Container-first construction priority applies regardless of era/RCL — a Container site simply always ranks higher when present; no era check needed here since Container sites only exist when the operator places them, which happens at/after RCL 2 by epic design).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Container site present | One `structureType: "container"` site, one `structureType: "extension"` site | Container Job's `withinTierPriority` > Extension Job's `withinTierPriority`; both `tier: "medium"` | N/A |
| Only non-Container sites | All sites `structureType !== "container"` | All Jobs get the default `withinTierPriority`, unchanged from current behavior | N/A |
| Only Container sites | All sites `structureType === "container"` | All Jobs get the elevated Container priority | N/A |
| Empty construction sites | `constructionSites: []` | `[]` | N/A |
| Container beats nearer ordinary site in Matching | Container site far, extension site near, both eligible | `selectJob` picks the Container Job first (tier ties, priority wins before distance) | N/A |

</frozen-after-approval>

## Code Map

- `src/world/producers/build.ts:12-26` -- `produceBuild()`; change `.map` to select `withinTierPriority` per `site.structureType` instead of reading one scalar off `policy`
- `src/world/producers/build.ts:1-6` -- header comment explicitly flags this exact gap ("Container-first within-tier precedence... is a later Evolution-era shift; all sites are priority 0 here") -- update once implemented
- `src/world/snapshot.ts:35-40` -- `SnapshotConstructionSite.structureType: BuildableStructureConstant` -- already present, reuse as-is, no changes
- `src/config.ts:17-24` -- `JobTypePolicy` type; `withinTierPriority: number` stays as-is (single scalar per Job instance, unaffected)
- `src/config.ts:97-104` -- current `JOB_POLICY_TABLE.build` entry (`tier: "medium"`, `withinTierPriority: 0`, ...); its other fields (`tier`, `maxWorkers`, `assignmentMode`, `lifetimeClass`, `requirements`) remain the source for everything except `withinTierPriority`
- `src/config.ts` -- NEW constant `BUILD_STRUCTURE_PRIORITY: Partial<Record<BuildableStructureConstant, number>> & { default: number }`, added to `Config` interface + `constants` object, accessed via `getConstant`
- `src/control/match.ts:33-92` -- `selectJob`; tier → withinTierPriority (desc) → liveDistance (asc) cascade already implemented (Story 3.4, AD-7) -- confirmed no changes needed
- `test/world/producers/build.test.ts:8-16` -- `site(id)` test helper hardcodes `structureType: "extension"`; extend to accept `structureType` param or add a `containerSite(id)` helper

## Tasks & Acceptance

**Execution:**
- [x] `src/config.ts` -- add `BUILD_STRUCTURE_PRIORITY` constant: `{ default: 0, container: 10 }`-shaped (or equivalent typed map keyed by `STRUCTURE_CONTAINER`), wired into `Config` interface and `constants` object, accessed via `getConstant`
- [x] `src/world/producers/build.ts` -- update `.map` to compute `withinTierPriority` per site via `getConstant("BUILD_STRUCTURE_PRIORITY")[site.structureType] ?? getConstant("BUILD_STRUCTURE_PRIORITY").default`; keep all other Job fields sourced from `JOB_POLICY_TABLE.build` unchanged; update header comment
- [x] `test/world/producers/build.test.ts` -- extend `site()` helper to accept `structureType`; add cases: Container site gets higher `withinTierPriority` than extension site; non-Container sites keep default priority; empty sites list still returns `[]`
- [x] `test/control/match.test.ts` (if this file exists; confirm during implementation) -- add or extend a case confirming a higher-priority Container build Job beats a nearer, lower-priority ordinary build Job in `selectJob`, exercising the existing tier→priority→distance cascade end-to-end

**Acceptance Criteria:**
- Given a Container construction site and a non-Container construction site both present, when `produceBuild(snapshot)` runs, then the Container Job's `withinTierPriority` is strictly greater than the non-Container Job's, and both share `tier: "medium"`.
- Given a Container build Job and a nearer non-Container build Job both eligible for the same Creep in Matching, when `selectJob` runs, then the Container Job is selected first, purely via the existing tier→priority→distance ordering (no special-case code added to `match.ts`).
- Given no construction sites in the snapshot, when `produceBuild(snapshot)` runs, then it returns `[]`.

## Spec Change Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with `strict: true`; new config constant is fully typed
- `npm run test` -- expected: all new `build.test.ts` (and `match.test.ts`, if extended) cases pass, no regressions
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

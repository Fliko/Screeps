---
title: 'Story 4.3: Build Behavior'
type: 'feature'
created: '2026-08-14'
status: 'blocked'
baseline_revision: cb1050d26c0bf81a09cf563e2aeb3ff35dfac4cc
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
deferred:
  - summary: >-
      The nearest-active-Source harvesting logic (runSource) is now byte-for-byte duplicated across
      fill.ts and build.ts, with upgrade.ts (Story 4.4) set to add a third copy.
    evidence: |-
      Both files independently implement the same reduce-over-sources/liveDistance/harvest/ERR-set
      logic; a future fix (e.g. a new ERR code to exclude) must be applied in every copy by hand.
      Extracting this into a shared helper (alongside agents/sourcing.ts#deriveSourcingPhase) would
      touch fill.ts, which this story's boundaries explicitly forbid modifying — out of this story's
      scope, best addressed once upgrade.ts (Story 4.4) makes the pattern three-for-three.
    location: 'src/agents/behaviors/build.ts runSource; src/agents/behaviors/fill.ts runSource'
    severity: medium
  - summary: >-
      No end-to-end test drives a real build Contract through the full loop() (generate → match →
      spawn → execute) or across multiple Ticks, asserting construction site progress climbs and the
      Job disappears from the Board once the site completes.
    evidence: |-
      Current coverage is unit-level (build.test.ts, run.test.ts) plus the pre-existing structural
      phase-order check in control-cycle.test.ts; identical gap to Story 4.2's deferred item, and
      Story 4.5's sim-room economy observation is explicitly scoped (epic-4-context.md) to cover "the
      full fill/build/upgrade loop... together," making this the natural home for that end-to-end
      coverage rather than a standalone addition here.
    location: 'test/agents/behaviors/build.test.ts; test/control-cycle.test.ts'
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Contracted Generalists can hold `build` Contracts (Story 2.3's `build` Producer, Story
3.4's Matching) but nothing executes them — `agents/behaviors/run.ts`'s dispatch table has no
`build` entry, so construction sites never progress.

**Approach:** Add `agents/behaviors/build.ts` (source energy via the shared sourcing rule, else
move+`build()` the Contract's construction site) and wire a `build` entry into
`agents/behaviors/run.ts`'s dispatch table — mirroring `fill.ts`/`run.ts` (Story 4.2) exactly,
except `build()`'s action range is 3 (not 1) and its routine-outcome ERR code is
`ERR_INVALID_TARGET` (site completed mid-Tick), not `ERR_FULL`.

## Boundaries & Constraints

**Always:**
- Reuse `deriveSourcingPhase` (Story 4.1), `resolveObject` (`world/objects.ts`, AD-10), and
  `moveCreep` (AD-8) exactly as `fill.ts` does — no new seams, no direct `getObjectById`/`moveTo`.
- Sourcing (empty carry) is byte-for-byte the same nearest-active-Source logic as `fill.ts`'s
  `runSource` (harvest range 1, same ERR exclusions) — do not reimplement or diverge it.
- `build(target)` fires only when `liveDistance(creep.pos, target.pos) <= 3` (Screeps' build action
  range); out of range, `moveCreep` toward the site and do not call `build`.
- `ERR_*` results from `build` are checked at the callsite: log any non-`OK`, non-`ERR_NOT_IN_RANGE`,
  non-`ERR_INVALID_TARGET` result. `ERR_INVALID_TARGET` is routine (the site completed and became a
  structure mid-Tick, or another Creep's `build` call already finished it this Tick) and must not be
  logged, mirroring how `fill.ts` excludes `ERR_FULL` for the same "target satisfied mid-Tick" shape.
- Add the `build` entry to `agents/behaviors/run.ts`'s `BEHAVIORS` table with zero other changes to
  that file's dispatch/guard/try-catch logic (per Story 4.2's Design Notes: the table is designed for
  exactly this zero-change addition).
- An unreachable Creep or construction site (resolver returns `undefined`) is a silent no-op for the
  Tick — `validate`/Board regeneration owns reconciling a completed site next Tick (FR-1), not this
  behavior.

**Block If:** None — this is a mechanical extension of Story 4.2's established shape with one
verified, well-known Screeps API difference (build range 3 vs. harvest/transfer range 1).

**Never:**
- Do not modify `fill.ts`, `sourcing.ts`, `movement.ts`, or `world/objects.ts` — reuse only.
- Do not add cleanup code for completed construction sites — the AC explicitly requires "no cleanup
  code," relying on the Board's per-Tick regeneration (FR-1) to make the Job disappear on its own.
- Do not add cross-Creep build-target coordination — out of scope, same rationale as Story 4.2's
  deferred Source-contention item.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty carry, Source out of range | `carry: 0`, nearest active Source range > 1 | `moveCreep` toward the Source, no `harvest` call | No error expected |
| Empty carry, Source in range | `carry: 0`, nearest active Source range ≤ 1 | `harvest(source)` called | Non-OK, non-`ERR_NOT_IN_RANGE`, non-`ERR_NOT_ENOUGH_RESOURCES` logged |
| Partial/full carry, site out of range | `carry > 0`, site range > 3 | `moveCreep` toward the site, no `build` call | No error expected |
| Partial/full carry, site in range | `carry > 0`, site range ≤ 3 | `build(site)` called | Non-OK, non-`ERR_NOT_IN_RANGE`, non-`ERR_INVALID_TARGET` logged |
| Site completes mid-Tick | `build` returns `ERR_INVALID_TARGET` | No-op, not logged | Next Tick's Board regeneration removes the Job (FR-1) |
| Construction site unreachable | `targetId` resolves to `undefined` | No-op this Tick | No error expected |
| Creep unreachable | `creepId` resolves to `undefined` | No-op this Tick | No error expected |

</intent-contract>

## Code Map

- `src/agents/behaviors/fill.ts` -- the exact structural template to mirror: `runX(creepId, jobId)`
  entrypoint, reachability guard, `runSource` (copy verbatim), `runServe`-shaped `runBuild` (replace
  `transfer`/range-1/`ERR_FULL` with `build`/range-3/`ERR_INVALID_TARGET`).
- `src/agents/behaviors/run.ts` -- add `build: runBuild` to the `BEHAVIORS` table (import from the
  new file); no other change to this file.
- `src/agents/sourcing.ts` -- `deriveSourcingPhase(carry)`; call, do not modify.
- `src/world/objects.ts` -- `resolveObject<T>(id)`; use for Creep, Source, and `ConstructionSite`
  resolution (generic over any live-object type, already used this way for Structure in `fill.ts`).
- `src/board/job.ts` -- `parseJobId` to extract the site's `targetId` from the `build` Contract.
- `src/world/producers/build.ts` -- confirms `build` Jobs target construction sites, one per site.
- `src/world/snapshot.ts` -- `SnapshotConstructionSite` / `WorldSnapshot.constructionSites` (id, pos)
  already available; no changes needed.
- `node_modules/@types/screeps/index.d.ts` (`Creep.build`) -- signature/ERR codes: `OK`,
  `ERR_NOT_ENOUGH_RESOURCES`, `ERR_INVALID_TARGET`, `ERR_NOT_IN_RANGE`, `ERR_NO_BODYPART`,
  `ERR_RCL_NOT_ENOUGH`. Range is 3 tiles (Screeps engine behavior, not separately typed).
- `test/agents/behaviors/fill.test.ts` -- test-structure and mock-factory convention to mirror
  (`createMockGame`, `Object.assign(globalThis, {...})` for ambient ERR/OK constants, per-scenario
  `it`s) for `test/agents/behaviors/build.test.ts`.
- `test/agents/behaviors/run.test.ts` -- dispatch-table test convention to extend with a `build`
  Contract case.

## Tasks & Acceptance

**Execution:**
- `src/agents/behaviors/build.ts` -- new file; `runBuild(creepId, jobId)`: resolve the live Creep,
  derive sourcing phase from carry, either move+harvest the nearest active Source (identical to
  `fill.ts#runSource`) or move+`build()` the Contract's construction site (range 3, `ERR_INVALID_TARGET`
  excluded from logging) -- the Job-4.3 execution logic
- `src/agents/behaviors/run.ts` -- add `build: runBuild` to `BEHAVIORS` -- wires the new behavior
  into the existing AD-9 execute-phase dispatch with no structural change
- `test/agents/behaviors/build.test.ts` -- new file; unit-test all I/O matrix rows against `runBuild`
  with a mocked `GameAdapter`/snapshot, mirroring `fill.test.ts`'s structure
- `test/agents/behaviors/run.test.ts` -- extend: a Contracted Creep with a `build` Contract dispatches
  to `runBuild`

**Acceptance Criteria:**
- Given a Generalist with a `build` Contract, when Ticks run, then it sources energy and builds
  until the site completes — observable via console/CPU logs and construction site `progress`
  climbing in the sim room
- Given the site completes, when the next Tick regenerates the Board, then the `build` Job is gone
  and the Creep re-pulls, with no cleanup code added by this story (FR-1)
- Given `build` returns a non-OK, non-`ERR_NOT_IN_RANGE`, non-`ERR_INVALID_TARGET` code, when the
  behavior runs, then the result is logged at the callsite, never silently ignored

## Spec Change Log

<!-- Empty until the first bad_spec loopback. -->

## Review Triage Log

### 2026-08-14 — Review pass (blind-hunter, edge-case-hunter, verification-gap, intent-alignment)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 2 (medium 2, low 0)
- reject: 12
- addressed_findings:
  - none

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with no errors
- `npm run lint` -- expected: `biome check` passes on all touched files
- `npm run test` -- expected: all tests pass, including the new `build.test.ts` suite and the
  extended `run.test.ts` case
- `npm run build` -- expected: `dist/main.js` builds successfully

## Auto Run Result

**Summary:** Added `agents/behaviors/build.ts` (`runBuild`), executing a Contracted Generalist's
`build` Job by sourcing energy (byte-for-byte identical to `fill.ts`'s nearest-active-Source
harvest logic) or moving to and calling `build()` on the Contract's construction site at Screeps'
range-3 build action range, excluding the routine `ERR_INVALID_TARGET` (site completed mid-Tick)
from logging. Wired `build: runBuild` into `agents/behaviors/run.ts`'s dispatch table with no other
change to that file. A 4-lens review pass (blind-hunter, edge-case-hunter, verification-gap,
intent-alignment) found 0 patchable issues; 2 pre-existing issues deferred as out of this story's
scope; 12 findings rejected as already-decided design, theoretical/unreachable within a single-tick
execution model, or (in one case) a reviewer input error.

**Files changed:**
- `src/agents/behaviors/build.ts` (new) -- `runBuild(creepId, jobId)`: source/build execution per
  the sourcing rule, range-3 build action, `ERR_INVALID_TARGET` exclusion
- `src/agents/behaviors/run.ts` -- `build: runBuild` added to the `BEHAVIORS` dispatch table
- `test/agents/behaviors/build.test.ts` (new) -- full I/O matrix coverage (sourcing move/harvest/
  nearest-selection/no-op/logging; serving move-out-of-range/build-in-range/unreachable-target/
  non-OK-logging/`ERR_INVALID_TARGET`-exclusion/`ERR_NOT_IN_RANGE`-exclusion; Creep-unreachable no-op)
- `test/agents/behaviors/run.test.ts` -- extended: a `build` Contract dispatches to `runBuild`

**Review findings breakdown:**
- Patches applied: 0
- Items deferred: 2 (medium 2, low 0) -- recorded in frontmatter `deferred`: (1) `runSource` logic
  duplicated across `fill.ts`/`build.ts` (extraction would touch `fill.ts`, forbidden by this
  story's boundaries; revisit once `upgrade.ts`/Story 4.4 makes it three copies); (2) no end-to-end
  sim-room/multi-tick test of construction progress and post-completion Job removal -- identical gap
  to Story 4.2's own deferred item, with Story 4.5's economy observation explicitly scoped as its home
- Items rejected: 12 -- pre-existing/already-accepted patterns carried over verbatim from Story 4.2
  (unexcluded harvest ERR codes, `creep.carry.energy` legacy API, no per-behavior job-type assertion,
  dispatcher's silent-no-op-on-missing-entry design), theoretical same-Tick race conditions with no
  reachable path in this single-threaded execution model (site/target disappearing between the range
  check and the action call), a correct FR-1 citation misflagged as a possible copy/paste slip
  (verified against epics.md's own Story 4.3 wording), the spawning-Creep guard already present one
  layer up in `run.ts`'s dispatcher, an unverified-forward-looking-comment style nit, and one finding
  (repeated `runBehaviors()` calls in a test) traced to a transcription error in the reviewer's input,
  not the actual diff -- verified against the real file contents before rejecting

**Follow-up review recommendation:** `false` -- 0 patches this pass, score = 3×0 + 1×0 = 0
(< 5 threshold), no high-severity patches.

**Verification performed:** `npm run typecheck` ✓, `npm run lint` ✓ (56 files), `npm run test` ✓
(246/246, 26 files), `npm run build` ✓ (`dist/main.js`, 23.5kb). Matrix test audit: all 7 I/O matrix
rows confirmed covered by a passing test in `build.test.ts`.

**Residual risks:** The two deferred items (sourcing-logic duplication, no sim-room/multi-tick
verification) are documented above with rationale; neither blocks this story's AC as written. The
sim-room observation gap is the one most likely to matter for user-visible confidence -- worth
watching during Story 4.5.

**Blocking condition:** `finalization left repository dirty` -- not a git failure. This project's
persistent rule (loaded at session start, hook-enforced) forbids AI agents from running any
git-mutating command, including `commit`; the human performs every commit. The implementation above
is complete, verified, and reviewed -- only the commit ceremony is blocked pending human action.
Working tree at halt: `src/agents/behaviors/build.ts` and `test/agents/behaviors/build.test.ts`
new/untracked; `src/agents/behaviors/run.ts` and `test/agents/behaviors/run.test.ts` modified;
this spec file untracked.

Ready-to-run commit command:
```
git add src/agents/behaviors/build.ts src/agents/behaviors/run.ts \
  test/agents/behaviors/build.test.ts test/agents/behaviors/run.test.ts \
  _bmad-output/implementation-artifacts/spec-4-3-build-behavior.md
git commit -m "ft: implement Build Behavior — dispatch-table wiring for build Contracts (Story 4.3)"
```

---
title: 'Story 4.4: Upgrade Behavior'
type: 'feature'
created: '2026-08-14'
status: 'blocked'
baseline_revision: 6bbd952fea0f8b6b72d1f4be89dc6ab5717097d1
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
deferred:
  - summary: >-
      The nearest-active-Source harvesting logic (runSource) is now byte-for-byte duplicated across
      fill.ts, build.ts, and upgrade.ts — three copies of the identical logic, as Story 4.3's own
      deferred item anticipated once upgrade.ts landed.
    evidence: |-
      All three files independently implement the same reduce-over-sources/liveDistance/harvest/ERR-set
      logic; a future fix (e.g. a new ERR code to exclude) must be applied in all three copies by hand.
      Extracting this into a shared helper (alongside agents/sourcing.ts#deriveSourcingPhase) would touch
      fill.ts and build.ts, which this story's boundaries explicitly forbid modifying — out of this
      story's scope, and now the strongest case yet for the extraction Story 4.3 flagged.
    location: 'src/agents/behaviors/upgrade.ts runSource; src/agents/behaviors/build.ts runSource; src/agents/behaviors/fill.ts runSource'
    severity: medium
  - summary: >-
      No end-to-end test drives a real upgrade Contract through the full loop() (generate → match →
      spawn → execute) or across multiple Ticks, asserting Controller progress climbs and the Contract
      persists until it ends.
    evidence: |-
      Current coverage is unit-level (upgrade.test.ts, run.test.ts) plus the pre-existing structural
      phase-order check in control-cycle.test.ts; identical gap to Stories 4.2 and 4.3's own deferred
      items, and Story 4.5's sim-room economy observation is explicitly scoped (epic-4-context.md) to
      cover "the full fill/build/upgrade loop... together," making this the natural home for that
      end-to-end coverage rather than a standalone addition here.
    location: 'test/agents/behaviors/upgrade.test.ts; test/control-cycle.test.ts'
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Contracted Generalists can hold `upgrade` Contracts (Story 2.3's always-open `upgrade`
Producer, Story 3.4's Matching) but nothing executes them — `agents/behaviors/run.ts`'s dispatch
table has no `upgrade` entry, so the Backfill default (FR-21) never produces Controller progression.

**Approach:** Add `agents/behaviors/upgrade.ts` (source energy via the shared sourcing rule, else
move+`upgradeController()` the Contract's Controller) and wire an `upgrade` entry into
`agents/behaviors/run.ts`'s dispatch table — mirroring `fill.ts`/`build.ts`/`run.ts` (Stories 4.2,
4.3) exactly, except `upgradeController()`'s action range is 3 (like `build`) and, unlike `build`'s
`ERR_INVALID_TARGET` exclusion, no additional ERR code is excluded beyond the universal
`ERR_NOT_IN_RANGE` — a Controller never "completes" or disappears mid-Tick the way a construction
site does, so `ERR_INVALID_TARGET`/`ERR_NOT_ENOUGH_RESOURCES`/`ERR_NO_BODYPART` are always genuine,
loggable conditions here.

## Boundaries & Constraints

**Always:**
- Reuse `deriveSourcingPhase` (Story 4.1), `resolveObject` (`world/objects.ts`, AD-10), and
  `moveCreep` (AD-8) exactly as `fill.ts`/`build.ts` do — no new seams, no direct
  `getObjectById`/`moveTo`.
- Sourcing (empty carry) is byte-for-byte the same nearest-active-Source logic as `fill.ts`'s and
  `build.ts`'s `runSource` (harvest range 1, same ERR exclusions) — do not reimplement or diverge it.
- `upgradeController(target)` fires only when `liveDistance(creep.pos, target.pos) <= 3` (Screeps'
  upgradeController action range); out of range, `moveCreep` toward the Controller and do not call
  `upgradeController`.
- `ERR_*` results from `upgradeController` are checked at the callsite: log any non-`OK`,
  non-`ERR_NOT_IN_RANGE` result — no other exclusion, since (unlike `build`'s `ERR_INVALID_TARGET`
  site-completed case) the Controller target never becomes invalid or satisfied mid-Tick in a way
  that makes another code a routine, expected outcome.
- Add the `upgrade` entry to `agents/behaviors/run.ts`'s `BEHAVIORS` table with zero other changes to
  that file's dispatch/guard/try-catch logic (per Story 4.2's Design Notes: the table is designed for
  exactly this zero-change addition).
- An unreachable Creep or Controller (resolver returns `undefined`) is a silent no-op for the Tick —
  `validate`/Board regeneration owns reconciling next Tick (FR-1), not this behavior.

**Block If:** None — this is a mechanical extension of Stories 4.2/4.3's established shape with one
verified, well-known Screeps API difference (no target-satisfied ERR exclusion).

**Never:**
- Do not modify `fill.ts`, `build.ts`, `sourcing.ts`, `movement.ts`, or `world/objects.ts` — reuse
  only.
- Do not special-case the always-open/unlimited-worker/Backfill nature of the `upgrade` Job inside
  this behavior — that is entirely a Board + Matching (Epic 2/3) concern; this behavior only executes
  whatever `upgrade` Contract it is given.
- Do not add cross-Creep upgrade-target coordination — out of scope, same rationale as Stories
  4.2/4.3's deferred Source-contention item.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty carry, Source out of range | `carry: 0`, nearest active Source range > 1 | `moveCreep` toward the Source, no `harvest` call | No error expected |
| Empty carry, Source in range | `carry: 0`, nearest active Source range ≤ 1 | `harvest(source)` called | Non-OK, non-`ERR_NOT_IN_RANGE`, non-`ERR_NOT_ENOUGH_RESOURCES` logged |
| Partial/full carry, Controller out of range | `carry > 0`, Controller range > 3 | `moveCreep` toward the Controller, no `upgradeController` call | No error expected |
| Partial/full carry, Controller in range | `carry > 0`, Controller range ≤ 3 | `upgradeController(controller)` called | Non-OK, non-`ERR_NOT_IN_RANGE` logged (including `ERR_INVALID_TARGET`, `ERR_NOT_ENOUGH_RESOURCES`, `ERR_NO_BODYPART`) |
| Controller unreachable | `targetId` resolves to `undefined` | No-op this Tick | No error expected |
| Creep unreachable | `creepId` resolves to `undefined` | No-op this Tick | No error expected |

</intent-contract>

## Code Map

- `src/agents/behaviors/build.ts` -- the closer structural template to mirror (range-3 action, same
  as this story): `runX(creepId, jobId)` entrypoint, reachability guard, `runSource` (copy verbatim),
  `runServe`-shaped `runUpgrade` (replace `build`/`ERR_INVALID_TARGET`-exclusion with
  `upgradeController`/no additional exclusion).
- `src/agents/behaviors/fill.ts` -- secondary reference for the `runSource` half and overall file
  shape/comment convention.
- `src/agents/behaviors/run.ts` -- add `upgrade: runUpgrade` to the `BEHAVIORS` table (import from the
  new file); no other change to this file (line 12 `import { runBuild } from "./build";`, line 19
  `build: runBuild,` show the exact pattern to repeat).
- `src/agents/sourcing.ts` -- `deriveSourcingPhase(carry)`; call, do not modify.
- `src/world/objects.ts` -- `resolveObject<T>(id)`; use for Creep and `StructureController`
  resolution (generic over any live-object type).
- `src/board/job.ts` -- `parseJobId` to extract the Controller's `targetId` from the `upgrade`
  Contract.
- `src/world/producers/upgrade.ts` -- confirms the `upgrade` Job always targets `snapshot.controller`
  (single Controller, unlimited workers); no changes needed.
- `src/world/snapshot.ts` -- `WorldSnapshot.controller` (id, pos) already available; no changes
  needed.
- `node_modules/@types/screeps/index.d.ts` (`Creep.upgradeController`, ~line 1611) -- signature/ERR
  codes: `OK`, `ERR_NOT_OWNER`, `ERR_BUSY`, `ERR_NOT_ENOUGH_RESOURCES`, `ERR_INVALID_TARGET`,
  `ERR_NOT_IN_RANGE`, `ERR_NO_BODYPART`, `ERR_ACCESS_DENIED`. Range is 3 tiles (per doc comment, same
  as `build`).
- `test/agents/behaviors/build.test.ts` -- test-structure and mock-factory convention to mirror
  (`createMockGame`/`setGame`, `Object.assign(globalThis, {...})` for ambient ERR/OK constants,
  per-scenario `it`s) for `test/agents/behaviors/upgrade.test.ts`.
- `test/agents/behaviors/run.test.ts` -- dispatch-table test convention to extend with an `upgrade`
  Contract case.

## Tasks & Acceptance

**Execution:**
- `src/agents/behaviors/upgrade.ts` -- new file; `runUpgrade(creepId, jobId)`: resolve the live Creep,
  derive sourcing phase from carry, either move+harvest the nearest active Source (identical to
  `build.ts#runSource`) or move+`upgradeController()` the Contract's Controller (range 3, only
  `ERR_NOT_IN_RANGE` excluded from logging) -- the Job-4.4 execution logic
- `src/agents/behaviors/run.ts` -- add `upgrade: runUpgrade` to `BEHAVIORS` -- wires the new behavior
  into the existing AD-9 execute-phase dispatch with no structural change
- `test/agents/behaviors/upgrade.test.ts` -- new file; unit-test all I/O matrix rows against
  `runUpgrade` with a mocked `GameAdapter`/snapshot, mirroring `build.test.ts`'s structure
- `test/agents/behaviors/run.test.ts` -- extend: a Contracted Creep with an `upgrade` Contract
  dispatches to `runUpgrade`

**Acceptance Criteria:**
- Given a Generalist with an `upgrade` Contract, when Ticks run, then it sources energy and calls
  `upgradeController` until the Contract ends — observable via console/CPU logs and Controller
  `progress` climbing in the sim room
- Given the behavior runs, then it executes only when an `upgrade` Contract is held — the decision of
  which Contract a Creep holds is made entirely by Board + Matching, never by a code path inside this
  behavior
- Given a mid-life tier change in the policy table (e.g. `build` promoted above `upgrade` in a test
  config), when Matching next runs for idle Creeps, then assignment order follows the new table with
  zero edits to `upgrade.ts` or `run.ts` — proving the Backfill default lives entirely in data
- Given `upgradeController` returns a non-OK, non-`ERR_NOT_IN_RANGE` code, when the behavior runs,
  then the result is logged at the callsite, never silently ignored

## Spec Change Log

<!-- Empty until the first bad_spec loopback. -->

## Review Triage Log

### 2026-08-14 — Review pass (blind-hunter, edge-case-hunter, verification-gap, intent-alignment)
- intent_gap: 0
- bad_spec: 0
- patch: 0
- defer: 2 (medium 2, low 0)
- reject: 15
- addressed_findings:
  - none

## Design Notes

Unlike `fill.ts` (excludes `ERR_FULL`) and `build.ts` (excludes `ERR_INVALID_TARGET`), `upgrade.ts`
excludes only `ERR_NOT_IN_RANGE`. Both prior exclusions cover a "target became satisfied mid-Tick by
another Creep" race (structure filled, site completed); a Controller has no such state — it always
accepts more energy, so every non-range ERR code from `upgradeController` (e.g. `ERR_INVALID_TARGET`
for a blocked/downgrading controller, `ERR_NOT_ENOUGH_RESOURCES`, `ERR_NO_BODYPART`) is a genuine,
worth-logging condition rather than routine noise.

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with no errors
- `npm run lint` -- expected: `biome check` passes on all touched files
- `npm run test` -- expected: all tests pass, including the new `upgrade.test.ts` suite and the
  extended `run.test.ts` case
- `npm run build` -- expected: `dist/main.js` builds successfully

## Auto Run Result

**Summary:** Added `agents/behaviors/upgrade.ts` (`runUpgrade`), executing a Contracted Generalist's
`upgrade` Job by sourcing energy (byte-for-byte identical to `fill.ts`'s/`build.ts`'s
nearest-active-Source harvest logic) or moving to and calling `upgradeController()` on the Contract's
Controller at Screeps' range-3 action range, logging every non-OK, non-`ERR_NOT_IN_RANGE` result (no
target-satisfied exclusion, since a Controller never becomes "satisfied" mid-Tick the way a structure
or construction site does). Wired `upgrade: runUpgrade` into `agents/behaviors/run.ts`'s dispatch
table with no other change to that file. A 4-lens review pass (blind-hunter, edge-case-hunter,
verification-gap, intent-alignment) found 0 patchable issues; 2 pre-existing-pattern issues deferred
as out of this story's scope; 15 findings rejected as already-decided design, theoretical/unreachable
within a single-tick execution model, or type-guaranteed by TypeScript.

**Files changed:**
- `src/agents/behaviors/upgrade.ts` (new) -- `runUpgrade(creepId, jobId)`: source/upgrade execution
  per the sourcing rule, range-3 `upgradeController` action, `ERR_NOT_IN_RANGE`-only exclusion
- `src/agents/behaviors/run.ts` -- `upgrade: runUpgrade` added to the `BEHAVIORS` dispatch table
- `test/agents/behaviors/upgrade.test.ts` (new) -- full I/O matrix coverage (sourcing move/harvest/
  nearest-selection/no-op/logging; serving move-out-of-range/upgrade-in-range/unreachable-target/
  non-OK-logging for `ERR_NOT_OWNER`/`ERR_INVALID_TARGET`/`ERR_NOT_ENOUGH_RESOURCES`/`ERR_NO_BODYPART`/
  `ERR_NOT_IN_RANGE`-exclusion; Creep-unreachable no-op)
- `test/agents/behaviors/run.test.ts` -- extended: an `upgrade` Contract dispatches to `runUpgrade`;
  repointed the "no dispatch entry" case to `mine` (the now-only undispatched `JobType`)

**Review findings breakdown:**
- Patches applied: 0
- Items deferred: 2 (medium 2, low 0) -- recorded in frontmatter `deferred`: (1) `runSource` logic now
  duplicated across three files (`fill.ts`/`build.ts`/`upgrade.ts`) -- extraction would touch
  `fill.ts`/`build.ts`, forbidden by this story's boundaries; Story 4.3 flagged this exact
  three-for-three trigger point; (2) no end-to-end sim-room/multi-tick test of Controller progress and
  Contract persistence -- identical gap to Stories 4.2/4.3's own deferred items, with Story 4.5's
  economy observation explicitly scoped as its home
- Items rejected: 15 -- pre-existing/already-accepted patterns carried over verbatim from Stories
  4.2/4.3 (unguarded `creep.carry.energy` legacy API, unlogged `moveCreep` failures, no runtime type
  check on `resolveObject` results, unguarded `parseJobId`, `creep.id` vs. `creep.name` in logs, no
  Controller-specific doc commentary), a magic-constant duplication (`UPGRADE_RANGE`/`BUILD_RANGE`)
  consistent with the existing `fill.ts`/`build.ts` pattern, a type-guaranteed exhaustiveness claim
  (`SourcingPhase` is a two-value union), a theoretical steady-state `ERR_NOT_OWNER` log-spam scenario
  with no reachable path in the single-room MVP, the still-undispatched `mine` `JobType` (explicitly
  out of this story's/epic's scope -- Epic 6 territory), an already-covered range-3 boundary test
  claimed as untested (verified present in `upgrade.test.ts`), and the intent-alignment auditor's
  "sim room" and "tier-change" evidence-surface observations, both already accounted for by this
  story's spec scoping (sim-room observation deferred to 4.5 above; tier-change AC is a structural
  guarantee of Board+Matching's existing data-driven design per `epic-4-context.md`, not something
  this story's diff needs to newly exercise).

**Follow-up review recommendation:** `false` -- 0 patches this pass, score = 3×0 + 1×0 = 0
(< 5 threshold), no high-severity patches.

**Verification performed:** `npm run typecheck` ✓, `npm run lint` ✓ (58 files), `npm run test` ✓
(264/264, 27 files), `npm run build` ✓ (`dist/main.js`, 25.1kb). Matrix test audit: all 6 I/O matrix
rows confirmed covered by a passing test in `upgrade.test.ts`.

**Residual risks:** The two deferred items (sourcing-logic triplication, no sim-room/multi-tick
verification) are documented above with rationale; neither blocks this story's AC as written. The
sourcing-logic triplication is now at the threshold Story 4.3 anticipated as the natural point to
revisit extraction -- worth raising at the Epic 4 retrospective.

**Blocking condition:** `finalization left repository dirty` -- not a git failure. This project's
persistent rule (loaded at session start, hook-enforced) forbids AI agents from running any
git-mutating command, including `commit`; the human performs every commit. The implementation above
is complete, verified, and reviewed -- only the commit ceremony is blocked pending human action.
Working tree at halt: `src/agents/behaviors/upgrade.ts` and `test/agents/behaviors/upgrade.test.ts`
new/untracked; `src/agents/behaviors/run.ts` and `test/agents/behaviors/run.test.ts` modified;
this spec file untracked.

Ready-to-run commit command:
```
git add src/agents/behaviors/upgrade.ts src/agents/behaviors/run.ts \
  test/agents/behaviors/upgrade.test.ts test/agents/behaviors/run.test.ts \
  _bmad-output/implementation-artifacts/spec-4-4-upgrade-behavior.md
git commit -m "ft: implement Upgrade Behavior — dispatch-table wiring for upgrade Contracts (Story 4.4)"
```

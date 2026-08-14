---
title: 'Story 4.5: DYING Unload & Economy Observation'
type: 'feature'
created: '2026-08-14'
status: 'blocked'
baseline_revision: b12087b144f78123d816a20dc8c9e3f7c1a9bde1
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** A Contracted Creep whose ttl drops low still runs its normal Job behavior (or, once
`fill`/`build`'s ttlFloor 200 invalidates its Contract, gets Backfilled onto `upgrade`) and dies
mid-Tick carrying energy that is simply lost — no code path ever unloads it (creep lifecycle
convention: DYING = deliver carried energy, then idle until death).

**Approach:** Add a `DYING` interceptor in `agents/behaviors/run.ts`'s dispatch loop: a Creep whose
`ttl` is below a new `config.ts` threshold (`CREEP_DYING_TTL_THRESHOLD`, pinned at 50 by this story)
runs a new `agents/behaviors/dying.ts#runDyingUnload` instead of its normal Job behavior, regardless
of whether it holds a Contract. That behavior delivers any carried energy to the nearest structure
below energy capacity (Spawn/Extension, same target set as the `fill` Producer); once empty (or no
needy structure exists), it is a no-op — the Creep idles until death. This story also covers the
epic's closing sim-room economy-observation pass (manual, not automatable — see Verification).

## Boundaries & Constraints

**Always:**
- Reuse `resolveObject` (`world/objects.ts`, AD-10) and `moveCreep` (`agents/movement.ts`, AD-8)
  exactly as `fill.ts`/`build.ts`/`upgrade.ts` do — no new seams, no direct `getObjectById`/`moveTo`.
- The DYING check in `run.ts` runs before the Job-type dispatch and short-circuits it: a dying Creep
  never also runs its Job behavior in the same Tick, whether or not it holds a Contract.
- A still-spawning Creep (`creep.spawning`) is never treated as dying — its `ttl` reads 0 regardless
  of actual lifecycle, mirroring `agents/validators.ts`'s `ttlFloorRule` spawning guard.
- "Needy structure" = a Spawn or Extension with `energy < energyCapacity` (identical target set to
  `world/producers/fill.ts#FILL_STRUCTURE_TYPES`), read from `getCurrentSnapshot().structures` — no
  new Game reads.
- Deliver via `creep.transfer(target, RESOURCE_ENERGY)` at range 1, moving into range first via
  `moveCreep` when needed — same shape as `fill.ts#runServe`. Log any non-`OK`, non-`ERR_FULL` result
  at the callsite (mirrors `fill.ts`).
- A Creep with zero carry, or with no reachable needy structure, is a silent no-op for the Tick (it
  idles) — no error, no log.
- Add `CREEP_DYING_TTL_THRESHOLD: number` to `config.ts`'s `Config` interface and `constants`,
  documented like the existing `MOVEMENT_*` constants.

**Block If:** None — this is a mechanical addition following Stories 4.2–4.4's established shape,
plus a documented manual observation pass.

**Never:**
- Do not modify `fill.ts`, `build.ts`, `upgrade.ts`, `sourcing.ts`, `movement.ts`, `world/objects.ts`,
  or `world/producers/*` — reuse only; `dying.ts` computes its own needy-structure filter locally
  (mirrors the existing `runSource` triplication pattern already flagged in Story 4.4's deferred
  items — extraction is out of this story's scope too).
- Do not clear or otherwise mutate the dying Creep's Contract — `validate`/Board regeneration already
  own Contract lifecycle (FR-9); this story only changes what `run.ts` dispatches to for one Tick.
- Do not attempt to automate the 1,000-Tick sim-room observation AC in a unit test — record it as a
  manual verification step instead (behaviors are sim-verified, not unit-tested, per
  `epic-4-context.md`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dying, carrying, needy structure out of range | `ttl < threshold`, `carry > 0`, nearest needy structure range > 1 | `moveCreep` toward it, no `transfer` call | No error expected |
| Dying, carrying, needy structure in range | `ttl < threshold`, `carry > 0`, range ≤ 1 | `transfer(structure, RESOURCE_ENERGY)` called | Non-OK, non-`ERR_FULL` logged |
| Dying, carrying, no needy structure | `ttl < threshold`, `carry > 0`, no structure below capacity | No-op (idle) | No error expected |
| Dying, empty carry | `ttl < threshold`, `carry === 0` | No-op (idle), no `transfer`/`moveCreep` call | No error expected |
| Dying, holds a Contract | `ttl < threshold`, `creep.contract` set | `runDyingUnload` runs; Job behavior (`runFill`/`runBuild`/`runUpgrade`) is NOT called | No error expected |
| Not dying, above threshold | `ttl >= threshold` | Normal Job dispatch unchanged | No error expected |
| Spawning | `creep.spawning === true`, `ttl` reads 0 | Not treated as dying; existing spawning no-op applies | No error expected |
| Creep unreachable | `creepId` resolves to `undefined` | No-op this Tick | No error expected |

</intent-contract>

## Code Map

- `src/agents/behaviors/run.ts` -- `runBehaviors()`'s dispatch loop (lines ~24-52): add the DYING
  check right after the existing `creep.spawning` guard is hoisted above the Contract check, before
  the `jobId === undefined` skip — a dying Creep must be intercepted whether or not it holds a
  Contract. Import `runDyingUnload` from the new file and `getConstant` from `config.ts`.
- `src/agents/behaviors/fill.ts` -- structural template for `dying.ts`: `resolveObject` guard shape,
  `runServe`-style move/transfer-at-range-1 logic, `[behavior:X]` log-prefix convention, ERR-set
  exclusion pattern (`ERR_FULL` only, same as `fill.ts#runServe`).
- `src/world/producers/fill.ts` -- `FILL_STRUCTURE_TYPES` (`["spawn", "extension"]`) and the
  `energy < energyCapacity` filter (lines 14-24): mirror this filter locally in `dying.ts` (read-only
  reference, do not import/modify — Producers stay decoupled from behaviors).
- `src/world/snapshot.ts` -- `WorldSnapshot.structures: SnapshotStructure[]` (`id`, `pos`,
  `structureType`, `energy`, `energyCapacity`) and `getCurrentSnapshot()` -- source of needy-structure
  data; `SnapshotCreep.ttl`/`.spawning` -- dying-check inputs.
- `src/world/distance.ts` -- `liveDistance(posA, posB)` -- nearest-structure selection and
  range-1 check, same as `fill.ts`.
- `src/world/objects.ts` -- `resolveObject<T>(id)` -- live Creep/Structure resolution.
- `src/agents/movement.ts` -- `moveCreep(creep, pos)` -- AD-8 movement choke point.
- `src/config.ts` -- `Config` interface (add `CREEP_DYING_TTL_THRESHOLD: number`) and `constants`
  (pin the value; no dedicated validator function needed -- other unvalidated constants, e.g.
  `LOG_BOOT`, `JOB_POLICY_TABLE`, follow the same unvalidated pattern).
- `test/agents/behaviors/build.test.ts` -- mock-factory and per-scenario `it` convention to mirror for
  `test/agents/behaviors/dying.test.ts` (`createMockCreep`/`createMockGame`,
  `Object.assign(globalThis, {...})` for ambient ERR/OK constants).
- `test/agents/behaviors/run.test.ts` -- dispatch-table test convention to extend with a
  DYING-intercept case (mock `runDyingUnload` the same way `runFill`/`runBuild`/`runUpgrade` are
  mocked).

## Tasks & Acceptance

**Execution:**
- `src/config.ts` -- add `CREEP_DYING_TTL_THRESHOLD: number` to `Config` and `constants` (value `50`)
  -- the DYING-check threshold, pinned by this story per `epics.md`'s "values pinned at the first
  consuming story" convention
- `src/agents/behaviors/dying.ts` -- new file; `runDyingUnload(creepId)`: resolve the live Creep,
  no-op if unreachable or carry is 0, else find the nearest structure with `energy < energyCapacity`
  among `spawn`/`extension` structures in the current snapshot, move into range 1 if needed, else
  `transfer(target, RESOURCE_ENERGY)` and log any non-OK, non-`ERR_FULL` result -- the Job-4.5
  unload logic
- `src/agents/behaviors/run.ts` -- hoist the `creep.spawning` guard above the Contract lookup; add a
  DYING check (`creep.ttl < getConstant("CREEP_DYING_TTL_THRESHOLD")`) that calls `runDyingUnload` and
  `continue`s, before the existing `jobId === undefined` check -- wires the interceptor into the
  AD-9 execute-phase dispatch
- `test/agents/behaviors/dying.test.ts` -- new file; unit-test all I/O matrix rows for
  `runDyingUnload` with a mocked `GameAdapter`/snapshot, mirroring `build.test.ts`'s structure
- `test/agents/behaviors/run.test.ts` -- extend: a dying Creep (below threshold) dispatches to
  `runDyingUnload` and not to its Job behavior, whether or not it holds a Contract; a spawning Creep
  at `ttl: 0` is not treated as dying

**Acceptance Criteria:**
- Given a Creep below `CREEP_DYING_TTL_THRESHOLD` carrying energy, when Ticks run, then it moves to
  and delivers its carry into the nearest structure below energy capacity, then stops acting once
  empty (idles until death)
- Given a Creep below the threshold with zero carry, when Ticks run, then no `transfer`/`moveCreep`
  call happens — it idles
- Given a Creep below the threshold that also holds a Contract, when Ticks run, then only
  `runDyingUnload` executes for it that Tick — its Job behavior does not also run
- Given the sim room running the full Generalist economy (fill/build/upgrade behaviors from Stories
  4.2-4.4, this story's DYING unload), when observed over a rolling 1,000-Tick window, then Sources
  keep draining, the Spawn stays fed, construction sites get built, the Controller progresses, no
  Creep stands idle without a Contract while a Job is open (SM-3), and per-phase CPU stays visibly
  under budget via the metering logs (NFR-1, SM-C1) -- manual sim-room verification, recorded in this
  spec's Verification section, not unit-tested

## Spec Change Log

<!-- Empty until the first bad_spec loopback. -->

## Review Triage Log

### 2026-08-14 — Review pass (blind-hunter, edge-case-hunter, verification-gap, intent-alignment)
- intent_gap: 0
- bad_spec: 0
- patch: 3 (low 3, medium 0, high 0)
- defer: 0
- reject: 12
- addressed_findings:
  - `[low]` `[patch]` `dying.ts#runDyingUnload` was missing the `!("memory" in creep) || !creep.memory` reachability guard that `fill.ts`/`build.ts`/`upgrade.ts` apply after `resolveObject` — added for consistency
  - `[low]` `[patch]` `run.ts`'s new DYING-interceptor `try/catch` had no test exercising the throw path — added a test asserting a thrown `runDyingUnload` is logged and dispatch continues to the next Creep
  - `[low]` `[patch]` `run.ts`'s file-header doc comment still described only Job-type dispatch — updated to mention the DYING interceptor

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with no errors
- `npm run lint` -- expected: `biome check` passes on all touched files
- `npm run test` -- expected: all tests pass, including the new `dying.test.ts` suite and the extended
  `run.test.ts` cases
- `npm run build` -- expected: `dist/main.js` builds successfully

**Manual checks (sim room, not automatable):**
- Deploy to the sim room per `README.md`'s existing deploy flow and let the full Generalist economy
  (Stories 4.2-4.5) run unattended for a rolling 1,000-Tick window.
- Confirm via console/CPU metering logs: Sources keep draining and regenerating, the Spawn/Extensions
  stay fed, construction sites complete, Controller `progress` climbs, no living Contracted-eligible
  Creep sits idle while a Job is open, per-phase CPU stays visibly under budget, and dying Creeps'
  carried energy visibly reaches a structure (`energy` values or transfer logs) before they die
  rather than vanishing.
- **Not performed by this automated run** — requires a live sim-room deploy and human/operator
  observation over 1,000 real Ticks, which this workflow does not have the means to execute. Left as
  an explicit follow-up for the operator before the epic is considered closed.

## Auto Run Result

**Summary:** Added a `DYING` interceptor to `agents/behaviors/run.ts`'s dispatch loop: a Creep whose
`ttl` drops below the new `config.ts` constant `CREEP_DYING_TTL_THRESHOLD` (pinned at `50`) runs the
new `agents/behaviors/dying.ts#runDyingUnload` instead of its normal Job behavior for that Tick,
regardless of whether it holds a Contract. `runDyingUnload` delivers any carried energy to the
nearest Spawn/Extension below energy capacity (same target set as the `fill` Producer, mirrored
locally), moving into range 1 via the existing `moveCreep` choke point and transferring once in
range; a Creep with zero carry or no reachable needy structure is a silent no-op (idles). The
Creep's Contract is never mutated — only what `run.ts` dispatches to for that Tick changes. A
4-lens review pass (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) found 3
patchable issues, applied and re-verified; 12 findings rejected as already-decided design (per this
spec's own Boundaries/Code Map), pre-existing accepted convention shared with `fill.ts`/`build.ts`/
`upgrade.ts`, or cosmetic/theoretical with no real consequence.

**Files changed:**
- `src/agents/behaviors/dying.ts` (new) -- `runDyingUnload(creepId)`: sourcing-free unload-only
  execution — deliver carried energy to nearest needy Spawn/Extension, else no-op
- `src/agents/behaviors/run.ts` -- hoisted the `spawning` guard above the Contract lookup; added the
  DYING interceptor (`creep.ttl < CREEP_DYING_TTL_THRESHOLD` → `runDyingUnload`, `continue`) before
  Job-type dispatch; updated file-header doc comment
- `src/config.ts` -- added `CREEP_DYING_TTL_THRESHOLD: number` to `Config` and `constants` (value
  `50`)
- `test/agents/behaviors/dying.test.ts` (new) -- full I/O matrix coverage for `runDyingUnload`
  (out-of-range move, in-range transfer, nearest-of-multiple selection, capacity exclusion, non-OK/
  non-`ERR_FULL` logging, `ERR_FULL` suppression, unresolved structure/creep no-ops, empty-carry
  no-op)
- `test/agents/behaviors/run.test.ts` -- extended: DYING interceptor dispatch (with/without
  Contract), at-threshold normal dispatch, spawning-Creep-at-ttl-0 exemption, and the throw/continue
  path for `runDyingUnload`
- `test/config.test.ts` -- mechanical addition of `CREEP_DYING_TTL_THRESHOLD` to the two
  `Config`-shaped test fixtures, required once `Config` grew the new required field (not in the
  spec's original touch list; needed to satisfy `typecheck`)

**Review findings breakdown:**
- Patches applied: 3 (low 3, medium 0, high 0) -- missing reachability guard in `dying.ts`, untested
  throw/continue path in `run.ts`'s new catch block, stale file-header doc comment in `run.ts`
- Items deferred: 0
- Items rejected: 12 -- structure-type-list duplication (explicitly accepted per this spec's Never
  section, mirrors Story 4.4's flagged triplication), missing config validation for the new threshold
  (explicitly excluded by this spec's own Code Map: "no dedicated validator function needed"),
  log-string-shape cosmetic inconsistency, no-log-on-no-target (explicitly the specified silent-no-op
  design), untested `carry.energy === undefined` boundary (theoretical, mirrors an already-accepted
  gap in `fill.ts`/`build.ts`), duplicate `liveDistance` computation in the nearest-selection `reduce`
  (copied verbatim from `fill.ts`/`build.ts` by spec instruction), redundant doubly-empty test case
  (spawning already short-circuits regardless of contract), multi-tick retarget scenario (not a bug —
  the stateless per-Tick recompute already self-heals), un-hoisted `getConstant` call (cosmetic,
  negligible CPU), unlogged `moveCreep` failures (pre-existing convention shared with `fill.ts`/
  `build.ts`/`upgrade.ts`, already accepted in Story 4.4's review), duplicate config-validation finding
  from edge-case-hunter, and the intent-alignment auditor's manual-observation/tracker-status note
  (descriptive only — the manual sim-room pass is explicitly out of this automated run's scope per the
  spec's own Never section, and `sprint-status.yaml` is maintained by a separate workflow, not
  build-auto)

**Follow-up review recommendation:** `false` -- 3 low-severity patches this pass, score = 3×0 + 1×3 =
3 (< 5 threshold), no high-severity patches.

**Verification performed:** `npm run typecheck` ✓, `npm run lint` ✓ (60 files), `npm run test` ✓
(279/279, 28 files, including the 3 new/patched tests), `npm run build` ✓ (`dist/main.js`, 26.5kb).
Matrix test audit: all 8 I/O matrix rows confirmed covered by a passing test (7 in `dying.test.ts`
directly, the "holds a Contract" row via `run.test.ts`'s DYING-interceptor cases). The 1,000-Tick
sim-room economy-observation manual check was **not** performed — see the note under Manual checks
above.

**Residual risks:** The sim-room economy-observation pass (this story's own second AC) remains
unexecuted — it requires a live deploy and human observation this automated run cannot perform.
Recommend the operator run it before treating Epic 4 as fully closed. No other residual risks
identified; all code-level ACs and I/O matrix rows are implemented and test-covered.

**Blocking condition:** none — implementation, review, and automated verification are complete.
Commit ceremony pending human action per this project's persistent rule (AI agents never run
git-mutating commands).

Ready-to-run commit command:
```
git add src/agents/behaviors/dying.ts src/agents/behaviors/run.ts src/config.ts \
  test/agents/behaviors/dying.test.ts test/agents/behaviors/run.test.ts test/config.test.ts \
  _bmad-output/implementation-artifacts/spec-4-5-dying-unload-economy-observation.md
git commit -m "ft: implement DYING Unload behavior — end-of-life energy delivery (Story 4.5)"
```

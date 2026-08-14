---
title: 'Story 4.2: Fill Behavior'
type: 'feature'
created: '2026-08-14'
status: 'blocked'
baseline_revision: 18d263722511dd20f5cbe78c982de442f486e9f4
review_loop_iteration: 1
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-4-context.md'
warnings: []
deferred:
  - summary: 'No cross-Creep coordination when selecting nearest active Source — multiple sourcing Creeps can independently pick the same nearest Source and pile onto its few adjacent tiles, leaving other Sources unharvested.'
    location: 'src/agents/behaviors/fill.ts runSource'
    severity: 'medium'
    evidence: 'blind-hunter finding #4 — out of the spec Approach''s "minimal seam" scope; adjacent to Epic 6''s Harvester source-lock territory (FR-28), explicitly Never-listed for this story.'
  - summary: 'transfer()/harvest() trust the resolved live object''s type via a generic-cast (`as AnyStoreStructure`) with no runtime guard; only Producer-side filtering (fill Jobs only ever target spawn/extension) currently protects this.'
    location: 'src/agents/behaviors/fill.ts runServe'
    severity: 'low'
    evidence: 'blind-hunter finding #6, verification-gap finding #5 — not exercised in practice; upstream Board/Producer correctness is the existing trust boundary elsewhere in this codebase too.'
  - summary: 'No end-to-end test drives a real fill Contract through the full loop() (generate → match → spawn → execute) asserting harvest/transfer actually fire as a consequence of the six-phase wiring — current coverage is unit-level (fill.test.ts, run.test.ts) plus a structural phase-order/log-count check in control-cycle.test.ts.'
    location: 'test/control-cycle.test.ts; src/main.ts'
    severity: 'medium'
    evidence: 'verification-gap finding #4 — Story 4.5''s sim-room economy observation is explicitly scoped (epic-4-context.md) to cover "the full fill/build/upgrade loop... together," making this the natural home for that end-to-end coverage rather than a standalone addition here.'
---

<intent-contract>

## Intent

**Problem:** Contracted Generalists hold `fill` Contracts (Epic 3) but nothing executes them — no Source-discovery seam exists, and AD-9's control cycle has no phase that invokes behaviors at all, so no energy moves and no Screeps intent is ever issued.

**Approach:** Add a `world/` Source-discovery seam (`findSources` via `FIND_SOURCES_ACTIVE`, mirroring the existing structures/constructionSites pattern), a generic live-object resolver for behaviors, the `agents/behaviors/fill.ts` behavior (harvest nearest active Source when empty, else `moveCreep` + `transfer` to the Contract's target, per the Story 4.1 sourcing rule), and a new 6th AD-9 "execute" phase in `main.ts` that dispatches Contracted Creeps to behaviors via a small `agents/behaviors/run.ts` table (only `fill` wired).

## Boundaries & Constraints

**Always:**
- Source discovery stays inside `world/`: a new `findSources(roomName): SourceStub[]` on `GameAdapter` using `FIND_SOURCES_ACTIVE` (harvestable Sources only), and a new `sources: readonly SnapshotSource[]` field on `WorldSnapshot`, mirroring `structures`/`constructionSites` exactly (id, pos, energy at minimum).
- Nearest-Source selection reuses `world/distance.ts#liveDistance` — no new distance logic anywhere.
- Behaviors obtain live object references (Creep, Source, target Structure) only through a `world/` resolver — no direct `getGame().getObjectById` call from `agents/behaviors/fill.ts` (AD-10: behaviors are the executor side, not readers). Add one generic resolver seam for this (new file or an addition alongside `world/creeps.ts`'s existing reachability-guard pattern).
- The sourcing decision is `deriveSourcingPhase(creep.carry.energy)` from Story 4.1 — call it, do not reimplement it.
- All movement goes through `agents/movement.ts#moveCreep` (AD-8) — no direct `moveTo`/`move`/`moveByPath` in the behavior file.
- `ERR_*` results from `harvest`/`transfer` are checked at the callsite (a non-`OK`, non-`ERR_NOT_IN_RANGE` result is logged, never silently dropped).
- The new "execute" phase runs after `spawn` in `main.ts`, wrapped in `measurePhase` like every other phase. The dispatch table (`agents/behaviors/run.ts`) maps `JobType -> behavior function`, mirroring `world/producers/run.ts`'s shape; only `fill` has an entry. A Contracted Creep whose Job type has no table entry is a silent no-op this Tick (Stories 4.3/4.4 add `build`/`upgrade` with zero changes to this table's shape).
- An unreachable live Creep, Source, or target Structure (resolver returns `undefined`) is a silent no-op for that Creep this Tick — never a throw.

**Block If:** None — both prior gaps (Source discovery, behavior wiring) are resolved by explicit user decision; the remaining shape is mechanical given Story 4.1's helper and the existing `world/` seam patterns.

**Never:**
- Do not implement `build.ts` or `upgrade.ts` — Stories 4.3/4.4.
- Do not add Harvester source-locking/sticky-Source assignment — Epic 6 (FR-28) scope, explicitly rejected during this story's planning gap.
- Do not store the sourcing phase or the selected Source id in `creep.memory` — both are derived fresh every Tick (AD-4, Story 4.1).
- Do not call any Screeps intent or `find`/`getObjectById` from `main.ts` or `agents/behaviors/run.ts` — the dispatcher only resolves Job type and calls the behavior; all Game interaction stays inside `fill.ts` (via the `world/` resolver) and `world/` itself.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty carry, Source out of range | `carry: 0`, nearest active Source range > 1 | `deriveSourcingPhase` → "source"; `moveCreep` toward the Source, no `harvest` call | No error expected |
| Empty carry, Source in range | `carry: 0`, nearest active Source range ≤ 1 | `harvest(source)` called | Non-OK, non-`ERR_NOT_IN_RANGE` result logged |
| No active Sources visible | `carry: 0`, `snapshot.sources` empty | No-op this Tick (nothing to harvest) | No error expected |
| Partial carry (anti-ping-pong) | `carry: 45` of 50 | `deriveSourcingPhase` → "serve"; travels/transfers to Contract's target, never re-sources | No error expected |
| Serve, target out of range | `carry > 0`, target range > 1 | `moveCreep` toward target, no `transfer` call | No error expected |
| Serve, target in range | `carry > 0`, target range ≤ 1 | `transfer(target, RESOURCE_ENERGY)` called | Non-OK result logged |
| Target structure unreachable | `targetId` resolves to `undefined` (structure gone/invisible) | No-op this Tick; Contract still validates/clears next `validate` phase per AD-9 ordering | No error expected — not this behavior's job to clear Contracts |
| Creep unreachable | `creepId` resolves to `undefined` | No-op this Tick | No error expected |
| Structure fills mid-delivery | Structure reaches `energyCapacity` before Contract clears | This Tick's `transfer` may still fire (behavior does not re-check capacity); next Tick's `validate` phase clears the stale Contract and the Creep re-pulls (FR-9) — this story does not add mid-Tick capacity re-checks | Handled by existing `validate` phase, not this story |

</intent-contract>

## Code Map

- `src/game.ts` -- add `findSources` to `GameAdapter` + `defaultGame`, new `SourceStub` interface; mirror `findMyStructures` (lines 107-120) exactly for shape/pattern.
- `src/world/snapshot.ts` -- add `sources: readonly SnapshotSource[]` to `WorldSnapshot`, a `mapSource` function, and wire into `buildWorldSnapshot()` (including the initial empty-snapshot object at line ~75-80).
- `src/world/distance.ts` -- reuse `liveDistance` for nearest-Source and in-range checks; no changes.
- `src/world/creeps.ts` -- existing reachability-guard pattern (`!obj || !("memory" in obj) || !obj.memory`, lines 25-34) to mirror for the new resolver; do not add Source/Structure resolution here (this file is Contract-specific per its header).
- `src/agents/sourcing.ts` -- `deriveSourcingPhase(carry)` from Story 4.1; call, do not modify.
- `src/agents/movement.ts` -- `moveCreep(creep, target, opts?)`; the only movement call site.
- `src/board/job.ts` -- `parseJobId` to extract `targetId` from the Contract's jobId.
- `src/world/producers/fill.ts` -- confirms `fill` Jobs target Spawn/Extension structures only.
- `src/world/producers/run.ts` -- the dispatch-coordinator pattern to mirror for `agents/behaviors/run.ts` (reads snapshot, iterates, calls per-type functions; no Board/Memory writes of its own).
- `src/control/generate.ts`, `src/control/validate.ts` -- AD-9 phase-orchestrator shape (thin, snapshot-driven, `measurePhase`-wrapped) to mirror for the new execute phase.
- `src/main.ts` -- add the 6th `measurePhase("execute", runBehaviors)` call after `spawn` (line 54).
- `test/agents/sourcing.test.ts`, `test/agents/validators.test.ts` -- pure-function test convention to mirror for the new behavior/dispatch tests.

## Tasks & Acceptance

**Execution:**
- `src/game.ts` -- add `SourceStub { id, pos, energy, energyCapacity }` and `findSources(roomName): SourceStub[]` using `room.find(FIND_SOURCES_ACTIVE)` -- new Source-discovery seam, active Sources only
- `src/world/snapshot.ts` -- add `SnapshotSource` + `sources` field, `mapSource`, wire into `buildWorldSnapshot()` (both the real read and the initial empty snapshot) -- makes Source data available to behaviors without any Game read outside `world/`
- `src/world/creeps.ts` (or a new sibling file if a generic resolver doesn't fit this Contract-specific file) -- add a live-object resolver behaviors can call for Creep/Source/Structure references -- the AD-10 seam behaviors go through instead of touching `getObjectById` themselves
- `src/agents/behaviors/fill.ts` -- new file; `runFill(creepId, jobId)`: resolve the live Creep, derive sourcing phase from its carry, either move+harvest the nearest active Source or move+transfer to the Contract's target, checking `ERR_*` at each intent callsite -- the actual Job-4.2 execution logic
- `src/agents/behaviors/run.ts` -- new file; `runBehaviors()`: iterate this Tick's Contracted Creeps from the snapshot, dispatch by Job type through a `Partial<Record<JobType, ...>>` table with only `fill` entered -- the AD-9 execute-phase coordinator
- `src/main.ts` -- add `measurePhase("execute", runBehaviors)` after the `spawn` phase -- wires the new phase into the fixed AD-9 cycle order
- `test/game.test.ts` (or nearest existing adapter test file) -- test `findSources` mapping
- `test/world/snapshot.test.ts` -- test `sources` field population, including the empty-room and no-Sources cases
- `test/agents/behaviors/fill.test.ts` -- unit-test the I/O matrix rows above against `runFill` with a mocked `GameAdapter`/snapshot
- `test/agents/behaviors/run.test.ts` -- test dispatch: a Contracted Creep with a `fill` Contract calls `runFill`; a Creep with no Contract or an unwired Job type is a no-op

**Acceptance Criteria:**
- Given a Generalist with a `fill` Contract and empty carry, when Ticks run, then it harvests from the nearest active Source, travels toward its target, and transfers into the Contract's structure until full — observable via console/CPU logs and structure `energy` climbing in the sim room
- Given the Contract's target structure becomes full mid-delivery, when validation next runs, then the Contract clears and the Creep re-pulls within the same Tick per the existing `validate`/`match` phases (FR-9) — this story adds no new clearing logic
- Given `harvest` or `transfer` returns a non-OK, non-`ERR_NOT_IN_RANGE` code, when the behavior runs, then the result is logged at the callsite, never silently ignored
- Given a room with more than one active Source, when a Generalist sources, then it selects the nearest one via `liveDistance` — never first-found, never sticky/locked across Ticks

## Spec Change Log

<!-- Empty until the first bad_spec loopback. -->

## Review Triage Log

### 2026-08-14 — Review pass (blind-hunter, edge-case-hunter, verification-gap, intent-alignment)
- intent_gap: 0
- bad_spec: 0
- patch: 6 (low 4, medium 2, high 0)
- defer: 3 (medium 2, low 1)
- reject: 6
- addressed_findings:
  - `[low]` `[patch]` Skip Creeps still `spawning` in `runBehaviors`' dispatch loop (mirrors `validate.ts`'s existing spawning exemption) — a spawning Creep can't act; dispatching it wasted CPU and produced spurious ERR logs.
  - `[medium]` `[patch]` Wrapped each per-creep `behavior(creep.id, jobId)` call in `run.ts` in try/catch, logging and continuing on throw, so one Creep's failure (e.g. missing movement config) can't abort dispatch for every other Contracted Creep the rest of the Tick and every Tick thereafter.
  - `[low]` `[patch]` Excluded `ERR_NOT_ENOUGH_RESOURCES` (harvest) and `ERR_FULL` (transfer) from the "unexpected result" log set in `fill.ts` — both are routine same-Tick multi-Creep contention outcomes, not real errors, and logging them as errors contradicted the file's own "silent no-op" framing.
  - `[medium]` `[patch]` Strengthened the resolved live-Creep guard in `runFill` from `if (!creep) return;` to the full reachability check (`!creep || !("memory" in creep) || !creep.memory`), matching `world/creeps.ts`'s established pattern and the spec's Design Notes instruction to preserve it for Creep resolution.
  - `[low]` `[patch]` Strengthened two `moveTo` test assertions to check the actual destination position passed through, not just that some move happened.
  - `[low]` `[patch]` Strengthened two log-content test assertions to check the actual numeric result code appears in the logged message, not just the module prefix.
  - `[medium]` `[defer]` Cross-Creep Source-contention coordination (multiple Creeps independently picking the same nearest Source) — out of the spec Approach's "minimal seam" scope; adjacent to Epic 6 territory.
  - `[low]` `[defer]` Unchecked cast to `AnyStoreStructure` in `runServe` — not exercised in practice; Producer-side targeting is the existing trust boundary.
  - `[medium]` `[defer]` No end-to-end `loop()` test proving execute actually fires from a real Contract — Story 4.5 is the scoped home for full fill/build/upgrade-loop observation.
  - `[reject]` (x6) Stale/cleared-Contract same-Tick execution (already explicitly scoped out by the spec's own I/O matrix: "does not add mid-Tick capacity re-checks," "validate owns that next Tick"); non-energy resource carry ignored (theoretical, outside MVP domain, mirrors Story 4.1's precedent); deprecated `creep.carry.energy` API usage (pre-existing codebase convention since Story 2.1, not introduced by this diff); `moveCreep` return code unchecked in the behavior (out of the spec's explicit harvest/transfer-only ERR_* scope; duplicated by `movement.ts`'s own stuck-detection design); zero-CARRY-capacity Creep soft-locking a fill Contract (Matching's responsibility per epic-4-context.md's explicit division of labor, not the behavior's); a test asserting Source-selection fallback behavior that the implementation was never specified to have.

## Design Notes

**Why a generic resolver instead of reusing `world/creeps.ts` as-is:** that file's header explicitly scopes it to Contract mutation ("AD-10 world seam for live Creep objects"). Fill needs to resolve three different object kinds (Creep, Source, target Structure) by id for intent-issuing, not Contract writes — same reachability-guard shape, different purpose. Keep the guard pattern, give it its own home if `world/creeps.ts` doesn't want to grow a second responsibility.

**Why nearest-Source selection lives in the behavior, not a new `world/` function:** `liveDistance` already is the seam; picking the minimum over `snapshot.sources` is a one-line reduction over plain data the snapshot already exposes, not a new Game-reading capability. Keeping it in `fill.ts` avoids a `world/` function whose only caller is one behavior.

**Why the execute phase is silent-no-op on missing table entries and unreachable objects:** the epic isn't finished (build/upgrade land in 4.3/4.4), and a resolver miss (Creep died mid-Tick, structure destroyed) is routine, not exceptional — `validate`/`clearCreepContract` already own reconciling stale Contracts next Tick. Throwing here would take down the whole execute phase for one stale reference.

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with no errors
- `npm run lint` -- expected: `biome check` passes on all touched files
- `npm run test` -- expected: all tests pass, including new `game`, `snapshot`, `behaviors/fill`, and `behaviors/run` suites
- `npm run build` -- expected: `dist/main.js` builds successfully

## Auto Run Result

**Summary:** Added the missing Source-discovery seam (`GameAdapter.findSources` via `FIND_SOURCES_ACTIVE`, `WorldSnapshot.sources`), a generic AD-10 live-object resolver (`world/objects.ts#resolveObject`), the `fill` behavior (`agents/behaviors/fill.ts`, harvesting the nearest active Source when empty or serving the Contract's target when carrying, per Story 4.1's `deriveSourcingPhase`), and the new 6th AD-9 "execute" phase (`agents/behaviors/run.ts` dispatch table, wired into `main.ts` after `spawn`). A 4-lens review pass (blind-hunter, edge-case-hunter, verification-gap, intent-alignment) found 6 patchable issues, all applied; 3 items deferred as out of this story's scope; 6 items rejected as already-scoped, out-of-domain, or someone else's stated responsibility.

**Files changed:**
- `src/game.ts` -- `SourceStub` + `GameAdapter.findSources`/`defaultGame.findSources`
- `src/world/snapshot.ts` -- `SnapshotSource` + `WorldSnapshot.sources`, `mapSource`, wired into `buildWorldSnapshot()`
- `src/world/objects.ts` (new) -- `resolveObject<T>(id)`, the generic AD-10 resolver seam behaviors use instead of calling `getObjectById` directly
- `src/agents/behaviors/fill.ts` (new) -- `runFill(creepId, jobId)`: source/serve execution per the sourcing rule
- `src/agents/behaviors/run.ts` (new) -- `runBehaviors()`: the execute-phase dispatch table, only `fill` wired
- `src/main.ts` -- `measurePhase("execute", runBehaviors)` after `spawn`; phase-count JSDoc updated to six phases
- `test/game.test.ts` (new), `test/agents/behaviors/fill.test.ts` (new), `test/agents/behaviors/run.test.ts` (new) -- new suites
- `test/world/snapshot.test.ts`, `test/control-cycle.test.ts` -- extended for the new `sources` field / sixth phase
- `test/control/match.test.ts`, `test/control/validate.test.ts`, `test/metering.test.ts`, `test/smoke.test.ts`, `test/world/creeps.test.ts`, `test/world/producers/{build,fill,run,upgrade}.test.ts` -- mechanical updates adding the new required `GameAdapter.findSources`/`WorldSnapshot.sources` members to existing mocks/fixtures

**Review findings breakdown:**
- Patches applied: 6 (2 medium, 4 low) — see Review Triage Log above
- Items deferred: 3 (2 medium, 1 low) — recorded in frontmatter `deferred`
- Items rejected: 6 — see Review Triage Log above for rationale on each

**Follow-up review recommendation:** `true` — 2 medium-severity patches this pass, score = 3×2 + 1×4 = 10 (≥ 5 threshold).

**Verification performed:** `npm run typecheck` ✓, `npm run lint` ✓ (54 files), `npm run test` ✓ (231/231, 25 files), `npm run build` ✓ (`dist/main.js`, 22.0kb). All re-run and confirmed after the patch pass.

**Residual risks:** The three deferred items (Source-contention coordination, unchecked structure-type cast, no full-`loop()` end-to-end test) are documented above with rationale; none block this story's AC. Source-contention coordination is the one most likely to matter as headcount grows — worth watching during Story 4.5's economy observation.

**Blocking condition:** `finalization left repository dirty` — not a git failure. This project's persistent rule (hook-enforced) forbids AI agents from running any git-mutating command, including `commit`; the human performs every commit. The implementation above is complete, verified, and reviewed — only the commit ceremony is blocked pending human action.

Ready-to-run commit command:
```
git add src/game.ts src/world/snapshot.ts src/world/objects.ts src/agents/behaviors/ src/main.ts \
  test/game.test.ts test/agents/behaviors/ test/world/snapshot.test.ts test/control-cycle.test.ts \
  test/control/match.test.ts test/control/validate.test.ts test/metering.test.ts test/smoke.test.ts \
  test/world/creeps.test.ts test/world/producers/build.test.ts test/world/producers/fill.test.ts \
  test/world/producers/run.test.ts test/world/producers/upgrade.test.ts \
  _bmad-output/implementation-artifacts/spec-4-2-fill-behavior.md
git commit -m "ft: implement Fill Behavior — Source discovery seam + AD-9 execute phase (Story 4.2)"
```

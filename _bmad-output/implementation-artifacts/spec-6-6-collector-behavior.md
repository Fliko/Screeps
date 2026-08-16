---
title: 'Collector Behavior'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
baseline_commit: '2877c333f6256e7709a9798830aba11418785e4d'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Collectors (Story 6.4's CARRY/MOVE-heavy Body, single WORK part) are dispatched to the exact same `fill`/`build`/`upgrade` behaviors as Generalists, whose `runSource` always harvests a Source directly — there is no notion of "withdraw from a Container instead" anywhere in `agents/`.

**Approach:** Add a body-derived sourcing strategy (`"harvest"` vs `"withdraw"`), computed fresh each Tick from live `body`, alongside the existing `deriveSourcingPhase`. Add `agents/behaviors/withdraw.ts#runWithdrawSource`, and intercept dispatch in `run.ts` — before the Job-type `BEHAVIORS` lookup — for any Contracted Creep whose strategy is `"withdraw"` and whose phase is `"source"`, mirroring the existing DYING interceptor's placement. This requires zero changes to `fill.ts`/`build.ts`/`upgrade.ts`: when a Collector is in `"serve"` phase, it falls through unmodified to the existing per-Job-type behavior, whose own `runServe` half is body-agnostic already.

## Boundaries & Constraints

**Always:**
- `agents/sourcing.ts` gains `deriveSourceStrategy(body: BodyPartConstant[]): "harvest" | "withdraw"` — pure, no Game/Memory reads, matching by exact multiset comparison against `getConstant("BODY_COMPOSITIONS").collector.parts` (only the Collector composition needs recognizing; anything else derives `"harvest"`).
- `run.ts`'s loop, immediately after the `jobId === undefined` guard and before the `BEHAVIORS[type]` lookup: if `deriveSourceStrategy(creep.body) === "withdraw"` AND `deriveSourcingPhase(creep.carry) === "source"`, call `runWithdrawSource(creep.id)` and `continue` — same try/catch-and-log wrapping as every other dispatch branch.
- `runWithdrawSource(creepId)` in a new `agents/behaviors/withdraw.ts`: resolve the Creep (same `memory` reachability guard as `fill.ts`), find the nearest Container in `snapshot.structures` with `energy > getConstant("COLLECTOR_MIN_CONTAINER_ENERGY")`, move into range 1 if needed, else `creep.withdraw(container, RESOURCE_ENERGY)`.
- New config constant `COLLECTOR_MIN_CONTAINER_ENERGY: number` (default `0`) in `config.ts` — names the "has energy" threshold instead of a hardcoded literal (never-hardcode-tunables rule).
- No qualifying Container: silent no-op — the Collector waits wherever it already is; never falls back to Spawn/Extension (Boundaries explicitly forbid it; only `dying.ts` targets those).
- Error handling mirrors existing behaviors: `withdraw` ignores `OK`/`ERR_NOT_IN_RANGE`/`ERR_NOT_ENOUGH_RESOURCES`; anything else logs via `console.log` prefixed `[behavior:withdraw]`.
- Once a Collector's carry is nonzero, `deriveSourcingPhase` already derives `"serve"`, so the interceptor stops firing and normal `BEHAVIORS[type]` dispatch (unmodified `runFill`/`runBuild`/`runUpgrade`) takes over for delivery — no new serve-side code needed.

**Ask First:** None.

**Never:**
- Never call `creep.harvest` from any Collector code path — `runWithdrawSource` only ever calls `withdraw`.
- Never modify `fill.ts`, `build.ts`, or `upgrade.ts` — Collector delivery reuses their existing `runServe` halves as-is.
- Never target Spawn/Extension as a Collector energy source.
- Out of scope: Harvester behavior (Story 6.5, prerequisite — Containers must already be findable via the snapshot), deprecation/degradation (Story 6.7).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Collector, empty carry, non-empty Container nearby | `fill`/`build`/`upgrade` Contract, `carry === 0` | `runWithdrawSource` called; never `harvest` | N/A |
| Collector, empty carry, no Container above threshold | all Containers at/below `COLLECTOR_MIN_CONTAINER_ENERGY` | Silent no-op; no `spawnCreep`/Spawn/Extension targeting | N/A |
| Collector, nonzero carry | `carry > 0` | Normal `BEHAVIORS[type]` dispatch (`runFill`/`runBuild`/`runUpgrade`) runs its `runServe` half | N/A |
| Generalist, empty carry | body matches `generalist`, not `collector` | `deriveSourceStrategy` returns `"harvest"`; interceptor does not fire; existing harvest-based `runSource` runs unchanged | N/A |

</frozen-after-approval>

## Code Map

- `src/agents/sourcing.ts:27-29` -- `deriveSourcingPhase` -- reuse unchanged; add `deriveSourceStrategy` alongside it in the same pure module
- `src/agents/behaviors/withdraw.ts` -- NEW FILE: `runWithdrawSource(creepId)`, shaped like `fill.ts`'s `runSource` but `withdraw` instead of `harvest`, target = nearest non-empty Container from `snapshot.structures`
- `src/agents/behaviors/run.ts:29-53` -- `runBehaviors` loop -- insert withdraw interceptor after the `jobId === undefined` guard, before `BEHAVIORS[type]` lookup, same shape as the DYING interceptor above it
- `src/config.ts:88,153-157` -- `BODY_COMPOSITIONS.collector` -- reuse as the strategy-matching reference; add `COLLECTOR_MIN_CONTAINER_ENERGY` to `Config`/`constants`
- `src/world/snapshot.ts:24-32` -- `SnapshotStructure` -- source of Container candidates (depends on Story 6.5's `findMyStructures` fix already landing Containers in `structures`)
- `src/world/objects.ts:25` -- `resolveObject` -- reuse for Creep/Container resolution
- `src/world/distance.ts:32` -- `liveDistance` -- reuse for nearest-Container selection and range checks
- `src/agents/movement.ts:47` -- `moveCreep` -- reuse
- `test/agents/sourcing.test.ts` -- existing `deriveSourcingPhase` test shape -- extend for `deriveSourceStrategy`
- `test/agents/behaviors/fill.test.ts` -- `runSource`/mock-Creep pattern -- mirror for `withdraw.test.ts`
- `test/agents/behaviors/run.test.ts` -- dispatch-table test shape -- extend for the withdraw interceptor (Collector+source-phase → `runWithdrawSource`; Collector+serve-phase → normal dispatch)

## Tasks & Acceptance

**Execution:**
- [ ] `src/agents/sourcing.ts` -- add `deriveSourceStrategy(body)` pure function
- [ ] `src/config.ts` -- add `COLLECTOR_MIN_CONTAINER_ENERGY: 0` to `Config`/`constants`
- [ ] `src/agents/behaviors/withdraw.ts` -- new `runWithdrawSource(creepId)`
- [ ] `src/agents/behaviors/run.ts` -- insert withdraw interceptor before Job-type dispatch
- [ ] `test/agents/sourcing.test.ts` -- cover `deriveSourceStrategy` for all three `BODY_COMPOSITIONS` kinds
- [ ] `test/agents/behaviors/withdraw.test.ts` -- cover all I/O Matrix scenarios
- [ ] `test/agents/behaviors/run.test.ts` -- cover interceptor firing/non-firing per body+phase combination

**Acceptance Criteria:**
- Given a Collector with a delivery Contract and empty carry, when it sources, then it withdraws from the nearest non-empty Container and never calls `harvest`.
- Given a Collector's single WORK part, when it holds a build or upgrade Contract and serves, then it executes via the unmodified `runBuild`/`runUpgrade` `runServe` halves (single-WORK rate falls out of the Screeps engine automatically) — sim-observed.
- Given no Container above `COLLECTOR_MIN_CONTAINER_ENERGY`, when a Collector sources, then it waits in place rather than targeting Spawn or Extension.

## Spec Change Log

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with `strict: true`
- `npm run test` -- expected: all new `sourcing.test.ts`/`withdraw.test.ts`/`run.test.ts` cases pass, no regressions to `fill`/`build`/`upgrade`/DYING dispatch
- `npm run lint` -- expected: clean Biome check

**Manual checks (if no CLI):**
- Sim room: confirm a spawned Collector withdraws from a Container (never approaches a Source) and delivers to fill/build/upgrade targets at single-WORK rate.

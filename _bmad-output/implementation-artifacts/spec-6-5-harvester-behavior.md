---
title: 'Harvester Behavior'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
baseline_commit: '2877c333f6256e7709a9798830aba11418785e4d'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** No behavior exists for the `mine` Job type — Harvesters spawned by Story 6.4 with a `mine:<sourceId>` Contract sit idle (`run.ts`'s `BEHAVIORS` table has no `mine` entry). Separately, `game.ts#findMyStructures` uses `FIND_MY_STRUCTURES`, which never returns Containers (unowned/neutral in Screeps) — so `snapshot.structures` currently can never contain one, silently starving 6.1's era check, 6.3's build priority, and this story's Container lookup alike.

**Approach:** Fix `findMyStructures` to also fetch Containers via `FIND_STRUCTURES` and merge them in. Add `agents/behaviors/harvest.ts#runHarvest`, registered for `"mine"` in `run.ts`'s `BEHAVIORS` table, following the Epic 4 behavior shape: resolve the Source from the Contract's `targetId`, find its adjacent Container from the snapshot, travel onto the Container's tile once (it's walkable), then harvest + transfer every Tick from that fixed spot — no re-derivation of phase, no re-travel.

## Boundaries & Constraints

**Always:**
- `src/game.ts`'s `findMyStructures` merges `room.find(FIND_STRUCTURES).filter(s => s.structureType === STRUCTURE_CONTAINER)` with the existing owned-structure result, mapped through the same `StructureStub` shape (no `spawning` field for Containers).
- `runHarvest(creepId, jobId)` resolves the Creep via `resolveObject` with the same `memory` reachability guard as `fill.ts`/`build.ts`/`dying.ts`.
- The Source is resolved via `resolveObject<Source>(parseJobId(jobId).targetId)` directly — never through `snapshot.sources` (which is `FIND_SOURCES_ACTIVE`-filtered and would hide a depleted Source).
- The Container is found via `snapshot.structures.find(s => s.structureType === "container" && chebyshevDistance(source.pos, s.pos) <= 1)` — a fresh lookup every Tick (never cached, never stored in the Contract).
- Movement target is the Container's position, not the Source's: `moveCreep(creep, container.pos)` when `liveDistance(creep.pos, container.pos) > 0`; Containers are walkable, so the Harvester parks exactly on it, satisfying both harvest range (1) and transfer range (1) permanently once arrived.
- Once positioned (`liveDistance === 0`), every Tick calls both `creep.harvest(source)` and, only when `creep.carry.energy > 0`, `creep.transfer(container, RESOURCE_ENERGY)` — both intents fire independently, matching Screeps' multi-intent-per-Tick semantics.
- Error handling mirrors existing behaviors: `harvest` ignores `OK`/`ERR_NOT_IN_RANGE`/`ERR_NOT_ENOUGH_RESOURCES`; `transfer` ignores `OK`/`ERR_FULL`; anything else logs via `console.log` prefixed `[behavior:harvest]`.
- No Container found for the Source (destroyed mid-life, pre-6.7 degradation): silent no-op for the Tick — never clear the Contract (AD-4, FR-9's persistent exception already covers `mine`).
- Register `mine: runHarvest` in `run.ts`'s `BEHAVIORS` table (one-line addition, same shape as the three existing entries).

**Ask First:** None.

**Never:**
- Never call `creep.harvest` when not in range 1 of the Source, or `creep.transfer` when not in range 1 of the Container — guard with `liveDistance` first, per existing convention.
- Never clear or reassign the Harvester's Contract from this behavior — it ends only with death (AD-4).
- Never introduce a stored "arrived" or "phase" flag — arrival is derived fresh each Tick from `liveDistance`, same as sourcing phase elsewhere.
- Out of scope: Collector behavior (Story 6.6), deprecation/degradation logic (Story 6.7).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh Harvester, not yet at Container | `mine:S1` Contract, Container `C1` adjacent to `S1`, Creep elsewhere | `moveCreep(creep, C1.pos)` called; no harvest/transfer this Tick | N/A |
| Parked on Container, Source has energy | Creep at `C1.pos`, `S1.energy > 0` | `creep.harvest(S1)` called every Tick; `creep.transfer(C1, RESOURCE_ENERGY)` called when carrying | N/A |
| Depleted Source | Creep at `C1.pos`, `S1.energy === 0` | `harvest` still called (returns `ERR_NOT_ENOUGH_RESOURCES`, ignored) — Creep stays in place | Logged only for unexpected codes |
| Full Container | Creep carrying energy, `C1` at capacity | `transfer` called, returns `ERR_FULL`, ignored — Creep stays in place | Logged only for unexpected codes |
| Container destroyed mid-life | `mine:S1` Contract, no Container within range 1 of `S1` | Silent no-op; Contract untouched | N/A |
| Unresolvable Creep/Source | `resolveObject` returns `undefined` for either | Silent no-op | N/A |

</frozen-after-approval>

## Code Map

- `src/game.ts:122-137` -- `findMyStructures` -- merge in `FIND_STRUCTURES`-filtered Containers alongside the existing owned-structure result
- `test/game.test.ts:67-` -- existing `findMyStructures` test block/mock pattern (`FIND_MY_STRUCTURES_CODE` ambient stub) -- extend with a `FIND_STRUCTURES`/`STRUCTURE_CONTAINER` case
- `src/agents/behaviors/harvest.ts` -- NEW FILE: `runHarvest(creepId, jobId)`, structured like `fill.ts`/`build.ts`
- `src/agents/behaviors/run.ts:23-27` -- `BEHAVIORS` table -- add `mine: runHarvest`
- `src/board/job.ts:84` -- `parseJobId` -- reuse to extract Source id from the Contract
- `src/world/objects.ts:25` -- `resolveObject` -- reuse for Creep, Source, Container(as `StructureContainer`) resolution
- `src/world/distance.ts:23,32` -- `chebyshevDistance`/`liveDistance` -- reuse for Container lookup and movement-arrival checks
- `src/world/snapshot.ts:24-32,58-68` -- `SnapshotStructure`/`snapshot.structures` -- source of Container lookup, depends on the `game.ts` fix above
- `src/agents/movement.ts:47` -- `moveCreep` -- reuse, single movement choke point (AD-8)
- `test/agents/behaviors/fill.test.ts`, `test/agents/behaviors/build.test.ts` -- existing behavior test shape (`createMockGame`-style Creep/target mocking) -- mirror for `harvest.test.ts`
- `test/agents/behaviors/run.test.ts` -- `BEHAVIORS` dispatch table test -- extend for `mine` → `runHarvest`

## Tasks & Acceptance

**Execution:**
- [ ] `src/game.ts` -- extend `findMyStructures` to merge Container structures from `FIND_STRUCTURES` -- fixes the snapshot gap blocking Container lookup for 6.1/6.3/6.5 alike
- [ ] `src/agents/behaviors/harvest.ts` -- new `runHarvest(creepId, jobId)`: resolve Creep/Source/Container, move-onto-Container-then-harvest-and-transfer, per Boundaries
- [ ] `src/agents/behaviors/run.ts` -- register `mine: runHarvest` in `BEHAVIORS`
- [ ] `test/game.test.ts` -- cover Container inclusion in `findMyStructures`
- [ ] `test/agents/behaviors/harvest.test.ts` -- cover all I/O Matrix scenarios
- [ ] `test/agents/behaviors/run.test.ts` -- cover `mine` Contract dispatch to `runHarvest`

**Acceptance Criteria:**
- Given a Harvester with a `mine` Contract, when Ticks run, then it travels to its Source's adjacent Container once, harvests every subsequent Tick, transfers into the Container when carrying, and never enters Matching again (no Job-type entry routes it there; `mine` Jobs are Reserved and spawn-time-only per Story 6.4).
- Given a depleted Source or a full Container, when the Harvester acts, then it silently waits in place (no thrown errors, no Contract mutation) — sim-observed.
- Given the Harvester's Contract, when the Creep eventually dies, then nothing in this behavior clears it early — its Contract ends only with death (AD-4).

## Spec Change Log

## Design Notes

Parking the Harvester directly on the Container tile (rather than treating Source-adjacency and Container-adjacency as two separate range checks) is the key simplification: Containers are walkable in Screeps, and Story 6.1's era condition already guarantees every Container sits within Chebyshev 1 of its Source. Standing on the Container is therefore always within harvest range of the Source too, so one `moveCreep` target and one arrival check (`liveDistance === 0`) cover both actions with no extra state.

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with `strict: true`
- `npm run test` -- expected: all new `harvest.test.ts`/`game.test.ts`/`run.test.ts` cases pass, no regressions
- `npm run lint` -- expected: clean Biome check

**Manual checks (if no CLI):**
- Sim room: place a Container adjacent to a Source at RCL2 with 5 Extensions, confirm a spawned Harvester parks on the Container and energy accumulates in it over time.

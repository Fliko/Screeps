---
title: 'Population Maintenance & the spawnCreep Issuer'
type: 'feature'
created: '2026-08-14'
status: 'blocked'
review_loop_iteration: 0
followup_review_recommended: true
context: []
warnings: []
deferred: []
baseline_revision: '374dd415fcbaaec8691e01a6aad581c879dc0702'
---

<intent-contract>

## Intent

**Problem:** `control/spawn` is still the Epic 1 empty stub (AD-9's final phase). The colony never replenishes losses — population only ever shrinks.

**Approach:** Implement `control/spawn` to derive population (living + Spawning Creeps) from the world snapshot each Tick and issue `spawnCreep` with the Generalist Body and empty initial memory whenever population is below `config.ts`'s target and an idle Spawn structure exists.

## Boundaries & Constraints

**Always:**
- Population = `snapshot.creeps.length` (Spawning Creeps already appear in the snapshot per `world/snapshot.ts#mapCreep`, so they count without extra bookkeeping).
- `control/spawn` never calls the Game read API directly (AD-1/AD-10) — it reads only the `WorldSnapshot`, then resolves the chosen live Spawn via `world/objects.ts#resolveObject` to issue the `spawnCreep` intent.
- Target population, and the Generalist Body composition used for spawning, are `config.ts` constants — never inline literals.
- At most one `spawnCreep` call per Tick (one Spawn structure is expected at MVP; if several exist, pick the first idle one deterministically — snapshot order).
- Skip the Tick with no action (no log spam) when population is at/above target, or when every Spawn structure is already busy (`spawning` truthy) — engine-level `ERR_BUSY`/`ERR_NOT_ENOUGH_ENERGY` are not treated as failures to surface.
- Log successful issuance at `[spawn]` prefix (Story 5.2 depends on this log existing for its own observation).
- New Creep's initial memory is `{}` — no Contract is assigned at population-top-up spawn time (unlike the Reserved-slot spawning that lands in Epic 6); the Creep is picked up by `match` next Tick like any idle Creep.

**Block If:** none identified — the story is self-contained given the existing snapshot/config/world seams.

**Never:**
- Do not add Body-selection/affordability logic (Story 5.3) or priority ordering (Story 5.4) — always request the single Generalist Body, unconditionally, whenever under target.
- Do not add TTL-based proactive replacement (Story 5.2).
- Do not reorder the AD-9 control cycle; `spawn` stays last, replacing its existing stub call site in `main.ts` (no `main.ts` change needed — `measurePhase("spawn", spawn)` already wired).
- Do not persist population/spawn-demand state in `Memory` outside `Memory.creeps` (AD-5) — always derive fresh from the snapshot.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Below target, idle Spawn | 2 living Creeps, target 4, one non-spawning `STRUCTURE_SPAWN` | `spawnCreep(GENERALIST_BODY, name, {memory: {}})` called on the resolved live Spawn; `[spawn]` log line | No error expected |
| At target | 4 Creeps (any mix of spawning/living), target 4 | No `spawnCreep` call | No error expected |
| Above target | 5 Creeps, target 4 | No `spawnCreep` call | No error expected |
| Spawning Creep counts | 3 living + 1 `spawning: true`, target 4 | Population reads 4 -> no `spawnCreep` call | No error expected |
| All Spawns busy | Population below target, every Spawn structure `spawning` truthy | No `spawnCreep` call, no log | No error expected |
| No snapshot this Tick | `getCurrentSnapshot()` returns `undefined` | No-op, no throw | No error expected |
| No Spawn structure visible | Population below target, `snapshot.structures` has no `STRUCTURE_SPAWN` entry | No-op | No error expected |
| Live Spawn unresolvable | Snapshot lists a Spawn id `resolveObject` can't resolve (died mid-Tick) | No-op, no throw | Silent no-op, consistent with other AD-10 resolver misses |

</intent-contract>

## Code Map

- `src/control/spawn.ts` -- currently the Epic 1 empty stub; replace body with population-derivation + issuance logic.
- `src/game.ts:24-30` -- `StructureStub` interface; add optional `spawning?: boolean` (only meaningful for `STRUCTURE_SPAWN`).
- `src/game.ts:72-92` -- `GameAdapter` interface; add `getTime(): number` (wraps `Game.time`, needed for a unique Creep name — control/spawn must not read `Game` directly).
- `src/game.ts:98-105` -- `isEnergyStructure`; keep as-is, it already lets Spawn structures (energyCapacity > 0) through `findMyStructures`.
- `src/game.ts:116-129` -- `findMyStructures` mapping; add `spawning: (structure as StructureSpawn).spawning != null` when `structure.structureType === STRUCTURE_SPAWN` (omit the field for non-Spawn structures).
- `src/game.ts:111-185` (`defaultGame`) -- add `getTime: () => Game.time`.
- `src/world/snapshot.ts:19-24` (`SnapshotStructure`) -- add optional `spawning?: boolean`, threaded through from `StructureStub`.
- `src/world/snapshot.ts:59-65` (`WorldSnapshot`) -- add `tick: number`.
- `src/world/snapshot.ts:76-` (`buildWorldSnapshot`) -- set `snapshot.tick = game.getTime()` alongside the other fields; carry it even when `roomName` is empty (matches the "publish immediately" comment already there).
- `src/world/snapshot.ts` (`mapStructure`) -- copy `stub.spawning` through to `SnapshotStructure.spawning`.
- `src/world/objects.ts#resolveObject` -- reuse as-is to resolve the chosen Spawn id to a live `StructureSpawn` before calling `.spawnCreep(...)`.
- `src/config.ts` -- add `SPAWN_TARGET_POPULATION: number` (pin to `4`) and `SPAWN_BODY_GENERALIST: BodyPartConstant[]` (reuse the existing `GENERALIST_BODY` array, exported/reused rather than duplicated) to the `Config` interface and `constants` object.
- `test/control/spawn.test.ts` -- new file, unit tests against a fake `GameAdapter` + fabricated `WorldSnapshot`, mirroring the `setGame`/`buildWorldSnapshot` pattern in `test/control/match.test.ts`.

## Tasks & Acceptance

**Execution:**
- `src/game.ts` -- add `getTime()` to `GameAdapter` + `defaultGame`, and thread an optional `spawning` flag through `StructureStub`/`findMyStructures` for `STRUCTURE_SPAWN` entries -- gives `control/spawn` a Tick number for unique naming and Spawn busy/idle status, without it touching `Game` directly.
- `src/world/snapshot.ts` -- add `tick` to `WorldSnapshot`, populate it from `game.getTime()`, and thread `spawning` through `SnapshotStructure`/`mapStructure` -- extends the AD-10 read seam `control/spawn` consumes.
- `src/config.ts` -- add `SPAWN_TARGET_POPULATION` and `SPAWN_BODY_GENERALIST` -- single-source tunables per FR-14/FR-22-style config ownership.
- `src/control/spawn.ts` -- implement: read `getCurrentSnapshot()`; no-op if absent; population = `snapshot.creeps.length`; no-op if population >= `getConstant("SPAWN_TARGET_POPULATION")`; find the first `snapshot.structures` entry with `structureType === STRUCTURE_SPAWN` and `spawning` falsy; no-op if none; resolve it via `resolveObject<StructureSpawn>(id)`; no-op if unresolvable; call `.spawnCreep(getConstant("SPAWN_BODY_GENERALIST"), \`generalist-${snapshot.roomName}-${snapshot.tick}\`, { memory: {} })`; log `[spawn] spawnCreep(<name>) issued, population <n>/<target>` only when the call returns `OK` -- replaces the Epic 1 stub with FR-14's population-maintenance rule.
- `test/control/spawn.test.ts` -- unit-test every I/O Matrix row above using a fake `GameAdapter` (`findMyStructures`, `getTime`, `getObjectById` returning a mock `spawnCreep`-bearing object) and a snapshot built via `buildWorldSnapshot()` -- proves AC1/AC2 without a live Screeps runtime.

**Acceptance Criteria:**
- Given population (living + Spawning) below `SPAWN_TARGET_POPULATION`, when the spawn phase runs, then `control/spawn` issues `spawnCreep` with the Generalist Body and `{ memory: {} }` on the resolved live Spawn.
- Given population at or above `SPAWN_TARGET_POPULATION`, when the spawn phase runs, then no `spawnCreep` call is made.
- Given a Creep still `spawning: true` in the snapshot, when population is counted, then it counts toward population (no over-spawning while the Spawn is busy).
- Given the spawn phase replaces the Epic 1 stub, when `main.ts`'s AD-9 cycle runs, then `spawn` still executes in its existing final position (`measurePhase("spawn", spawn)`) with no cycle-ordering change required.

## Design Notes

`SPAWN_TARGET_POPULATION` has no PRD-given number (confirmed via the PRD's own review-rubric note that MVP constants are deliberately unspecified pending story-time pinning). Pinned to `4` here as a plausible early-colony Generalist count — small enough to be affordable at RCL1 energy capacity, large enough to keep all three Generalist-era Jobs (fill/build/upgrade) staffed. Purely a config value; change it in one place if it proves wrong empirically.

Naming: `generalist-<roomName>-<tick>` guarantees uniqueness because at most one `spawnCreep` call happens per Tick (busy-Spawn check) and Screeps Creep names must be globally unique across all rooms, hence the room-name component.

## Verification

**Commands:**
- `npx vitest run test/control/spawn.test.ts` -- expected: all new tests pass, covering every I/O & Edge-Case Matrix row.
- `npm test` -- expected: full suite green, no regressions in `test/control/match.test.ts`, `test/control-cycle.test.ts`, or other existing tests touched by the `game.ts`/`snapshot.ts` shape changes.
- `npm run typecheck` -- expected: no type errors from the new `StructureStub`/`WorldSnapshot`/`Config` fields.
- `npm run lint` -- expected: clean, matches repo's biome conventions.

## Spec Change Log

## Review Triage Log

### 2026-08-14 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3 (medium 2, low 1)
- defer: 0
- reject: 12
- addressed_findings:
  - `[medium]` `[patch]` `spawn()` silently swallowed any non-`OK` `spawnCreep` result (e.g. `ERR_NOT_ENOUGH_ENERGY`) with no log — added a failure-path `[spawn]` log line so PTR operators can diagnose why population isn't growing.
  - `[medium]` `[patch]` `defaultGame.findMyStructures`'s new `spawning` mapping and `getTime()` were only ever exercised against hand-built `StructureStub`/`WorldSnapshot` stubs, never against a real fake `Game` global (unlike `defaultGame.findSources`, which has that coverage in `test/game.test.ts`) — added adapter-level tests for both.
  - `[low]` `[patch]` Added a code comment in `control/spawn.ts` explaining why initial memory is `{}` (Contract-carrying initial memory is Epic 6's Reserved-slot-only mechanism; population top-up leaves the Creep idle for `match` to pick up next Tick) — closes a documentation gap the intent-alignment auditor flagged as ambiguous from the AC text alone.

## Auto Run Result

**Summary:** Replaced the Epic 1 `control/spawn` stub with population-maintenance logic (FR-14): derives population from the world snapshot each Tick, and issues `spawnCreep` with the Generalist Body and empty initial memory whenever population falls below `config.ts`'s target and an idle Spawn structure is visible. Spawning Creeps already appear in the snapshot, so they count toward population without extra bookkeeping — satisfying "no over-spawning while the Spawn is busy." `spawn` keeps its existing AD-9 final-phase wiring in `main.ts` unchanged.

**Files changed:**
- `src/control/spawn.ts` -- population-derivation + `spawnCreep` issuance, replacing the Epic 1 stub; logs both success and failure at `[spawn]`.
- `src/game.ts` -- added `getTime()` to `GameAdapter`/`defaultGame`; threaded an optional `spawning` flag through `StructureStub`/`findMyStructures` for `STRUCTURE_SPAWN` entries.
- `src/world/snapshot.ts` -- added `tick` to `WorldSnapshot`; threaded `spawning` through `SnapshotStructure`/`mapStructure`.
- `src/config.ts` -- added `SPAWN_TARGET_POPULATION` and `SPAWN_BODY_GENERALIST` (reuses `GENERALIST_BODY`, not duplicated).
- `test/control/spawn.test.ts` -- new, 8 tests covering every I/O & Edge-Case Matrix row.
- `test/game.test.ts` -- new adapter-level tests for `findMyStructures`'s `spawning` mapping and `getTime()` against a real fake `Game` global.
- 16 other test files -- mechanical `getTime: () => 0` / `tick: 0` fixture additions to satisfy the widened `GameAdapter`/`WorldSnapshot` types; no behavioral changes.

**Review findings breakdown:** 3 patches applied (medium 2, low 1); 0 deferred; 12 rejected (out-of-scope for this story — affordability/body-selection/priority-ordering/TTL-replacement/dynamic-target belong to Stories 5.2-5.4 and Phase 3; multi-spawn/name-collision unreachable at this story's single-spawn-per-Tick scope; silent-no-op paths already matched spec boundaries; one blind-hunter claim about Spawning-Creep snapshot visibility was factually incorrect per existing codebase evidence).

**Verification performed:** `npx vitest run test/control/spawn.test.ts` (8/8 pass), `npm test` (290/290 pass), `npm run typecheck` (clean), `npm run lint` (clean).

**Residual risks:** None identified within this story's scope. Out-of-band note: during this run the operator was live-testing on PTR with local uncommitted tuning (`JOB_POLICY_TABLE.fill.maxWorkers` 1→6, `SPAWN_TARGET_POPULATION` 4→10) and a commented-out board-log line in `control/generate.ts`; the implementation subagent initially reverted these as unrelated drift, which was caught, restored, and generalized into a `LOG_BOARD_ENABLED` config toggle (mirroring `CPU_METERING_ENABLED`) at the operator's request — outside this story's `<intent-contract>` but folded into the same working-tree changes since it touches the same files.

**Blocking condition:** all changes are implemented, verified (290/290 tests, clean typecheck, clean lint), and staged, but `git commit` is refused by this repository's pre-commit hook (`commits are disabled for agents in this repository` — requires a human operator to run `ALLOW_COMMIT=1 git commit ...`). Finalization could not commit or leave the working tree clean, so this run halts `blocked` rather than `done`. No code changes are at risk — everything is staged in the working tree, nothing needs to be redone once a human commits.


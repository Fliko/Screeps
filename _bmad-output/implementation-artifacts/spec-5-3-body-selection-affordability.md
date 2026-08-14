---
title: 'Body Selection & Affordability'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
baseline_commit: '7e807babf295c54f0fe46bc0ce188e46d714fe5a'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `control/spawn` (Stories 5.1/5.2) sources its Body from a flat `SPAWN_BODY_GENERALIST` constant and never checks `energyAvailable` — it can queue a spawn the colony can't afford, and there is no typed home for future Body compositions (FR-18).

**Approach:** Replace the flat constant with a typed `BODY_COMPOSITIONS` table in `config.ts` (Generalist populated, Harvester/Collector left for Epic 6), plumb `energyAvailable` into the `WorldSnapshot`, and gate `control/spawn`'s single issuance path on affordability before calling `spawnCreep`.

## Boundaries & Constraints

**Always:** Source the Body from `BODY_COMPOSITIONS.generalist`, never an inline part list; skip issuance entirely (no partial/queued spawn) on any Tick where `energyAvailable < cost`; keep one `spawnCreep` call site shared by both the population top-up and TTL-replacement triggers (5.1/5.2 unchanged otherwise); read `energyAvailable` only via the snapshot (AD-10) — no direct Game reads in `control/`.

**Never:** Touch priority ordering (Story 5.4); add Harvester/Collector body entries (Epic 6); change control-cycle phase order.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Body sourced from table | population < target, idle Spawn, `energyAvailable >= cost` | `spawnCreep` called with `BODY_COMPOSITIONS.generalist.parts` | N/A |
| Insufficient energy blocks spawn | population < target, idle Spawn, `energyAvailable < cost` | No `spawnCreep` call this Tick | N/A |
| Exact-cost boundary | `energyAvailable === cost` | `spawnCreep` called (not blocked) | N/A |
| TTL-replacement path also gated | near-dying trigger present, `energyAvailable < cost` | No `spawnCreep` call | N/A |

</frozen-after-approval>

## Code Map

- `src/game.ts` (`GameAdapter`) -- add `getEnergyAvailable(roomName: string): number`; `defaultGame` impl reads `Game.rooms[roomName]?.energyAvailable ?? 0`.
- `src/world/snapshot.ts` (`WorldSnapshot`) -- add `energyAvailable: number`; default `0` in the pre-populate empty snapshot; set from `game.getEnergyAvailable(roomName)` once `roomName` is known.
- `src/config.ts` -- add `BodyKind = "generalist"`, `BodyComposition { parts: BodyPartConstant[]; cost: number }`, `BodyCompositionTable = Record<BodyKind, BodyComposition>`; add `BODY_COMPOSITIONS: BodyCompositionTable` to `Config`/`constants` pinned `{ generalist: { parts: GENERALIST_BODY, cost: 200 } }` (200 = WORK 100 + CARRY 50 + MOVE 50); **remove** `SPAWN_BODY_GENERALIST` (superseded).
- `src/control/spawn.ts` -- read `const { parts, cost } = getConstant("BODY_COMPOSITIONS").generalist;`; add `if (snapshot.energyAvailable < cost) return;` guard before the idle-Spawn lookup, ahead of both the population and TTL-replacement paths; pass `parts` to `spawnCreep`.
- `test/control/spawn.test.ts` -- mock `getEnergyAvailable` in `createMockGame`/`GameAdapter`; default sufficient energy (e.g. `300`) in existing tests; add tests for insufficient-energy no-spawn, exact-cost boundary, and TTL-replacement-path-gated-by-energy; replace `getConstant("SPAWN_BODY_GENERALIST")` usage with `getConstant("BODY_COMPOSITIONS").generalist.parts`.
- `test/config.test.ts` -- replace `SPAWN_BODY_GENERALIST` key with `BODY_COMPOSITIONS: getConstant("BODY_COMPOSITIONS")` in both `Config`-shaped object literals.
- `test/world/snapshot.test.ts` -- mock `getEnergyAvailable`; add a case asserting `energyAvailable` propagates onto the snapshot.
- Other full `GameAdapter` test doubles need the new required method added (return any fixed number, e.g. `300`, unless the test cares): `test/agents/behaviors/build.test.ts`, `test/agents/behaviors/dying.test.ts`, `test/agents/behaviors/fill.test.ts`, `test/agents/behaviors/run.test.ts`, `test/agents/behaviors/upgrade.test.ts`, `test/control-cycle.test.ts`, `test/control/match.test.ts`, `test/control/validate.test.ts`, `test/metering.test.ts`, `test/smoke.test.ts`, `test/world/creeps.test.ts`, `test/world/producers/run.test.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/game.ts` -- add `getEnergyAvailable` to `GameAdapter` + `defaultGame` -- new snapshot input, adapter-seam only (AD-10).
- [ ] `src/world/snapshot.ts` -- add and populate `energyAvailable` -- plain-data per-Tick view, no caching.
- [ ] `src/config.ts` -- add `BODY_COMPOSITIONS` table, remove `SPAWN_BODY_GENERALIST` -- single typed source for Body + cost (FR-18, FR-22-style config ownership).
- [ ] `src/control/spawn.ts` -- source Body from the table; add the affordability guard shared by both issuance triggers -- never queue what the colony can't afford.
- [ ] `test/control/spawn.test.ts` -- I/O Matrix coverage + mock update.
- [ ] `test/config.test.ts` -- key rename.
- [ ] `test/world/snapshot.test.ts` -- `energyAvailable` propagation case + mock update.
- [ ] Remaining 12 `GameAdapter` test doubles listed in Code Map -- add `getEnergyAvailable` stub so `tsc` and the full suite stay green.

**Acceptance Criteria:**
- Given the sim room, when a Generalist spawns, then its parts match `BODY_COMPOSITIONS.generalist.parts` (Body table drives production spawning, not a literal).
- Given `energyAvailable` below `BODY_COMPOSITIONS.generalist.cost` on any Tick, when the spawn phase runs (regardless of which trigger — population or TTL-replacement — would otherwise fire), then no `spawnCreep` call is made and no partial/queued spawn is left pending.

## Design Notes

`energyAvailable` is Screeps' own room-level aggregate (Spawn + Extensions), read once via the adapter rather than re-summed from `snapshot.structures` in `control/` — keeps the AD-10 read seam single-sourced and avoids a second energy-accounting path drifting from the engine's own number.

## Verification

**Commands:**
- `npx vitest run test/control/spawn.test.ts test/world/snapshot.test.ts test/config.test.ts` -- expected: all pass, including new affordability/boundary cases.
- `npm test` -- expected: full suite green (all 13 `GameAdapter` mocks updated).
- `npm run typecheck` -- expected: clean (no missing `getEnergyAvailable` on any mock, no lingering `SPAWN_BODY_GENERALIST` reference).
- `npm run lint` -- expected: clean.

## Suggested Review Order

**Body composition table**

- New typed table replaces the flat `SPAWN_BODY_GENERALIST` constant — Generalist's parts + cost in one place, forward-shaped for Epic 6.
  [`config.ts:27-36`](../../src/config.ts#L27)

- Pinned cost (200 = WORK 100 + CARRY 50 + MOVE 50), the table's only populated entry.
  [`config.ts:126`](../../src/config.ts#L126)

**Affordability gate**

- Body + cost sourced from the table, then a hard guard ahead of both issuance triggers — never queues what the colony can't afford.
  [`spawn.ts:36-37`](../../src/control/spawn.ts#L36)

- `spawnCreep` now takes `parts` from the table instead of a bare constant.
  [`spawn.ts:87`](../../src/control/spawn.ts#L87)

**energyAvailable plumbing**

- New adapter read — room-level aggregate, single-sourced from Screeps' own accounting.
  [`game.ts:195-196`](../../src/game.ts#L195)

- Snapshot carries `energyAvailable`, defaulted to 0 before the room is known.
  [`snapshot.ts:93`](../../src/world/snapshot.ts#L93)

**Tests**

- Affordability I/O Matrix: below-cost, exact-cost boundary, TTL-replacement path also gated.
  [`spawn.test.ts:446-484`](../../test/control/spawn.test.ts#L446)

- `energyAvailable` propagation + no-room default.
  [`snapshot.test.ts:229-244`](../../test/world/snapshot.test.ts#L229)

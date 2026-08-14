---
title: 'Spawn Priority Ordering & Colony Observation'
type: 'feature'
created: '2026-08-14'
status: 'done'
review_loop_iteration: 0
baseline_commit: '7e807babf295c54f0fe46bc0ce188e46d714fe5a'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `control/spawn` has no notion of priority order — if multiple demand sources were ever simultaneously present, there is no rule for which gets the Spawn first (FR-17). Epic 6 will introduce real Reserved-vacancy and demand-pressure triggers into the same issuer; the ordering machinery must exist and be proven now.

**Approach:** Add a fixed, non-era-branching priority table (`SPAWN_PRIORITY_ORDER`: Reserved vacancies > demand pressure > population top-up) and a pure selection function in `control/spawn.ts`, wired into the existing single issuance path so it governs whichever reason(s) are actually present each Tick. In the Generalist era only "population-topup" is ever present in production; rules (1)/(2) are proven exclusively via fabricated inputs in unit tests, per the epic's pre-Epic-6 scope.

## Boundaries & Constraints

**Always:** Priority order is fixed data (`SPAWN_PRIORITY_ORDER`), read via `getConstant`, never a hardcoded if/else chain; the selection function is pure (`readonly SpawnPriorityReason[]` in, one reason or `undefined` out) and independently unit-testable with fabricated reason lists; the existing 5.1/5.2 population/TTL-replacement trigger computation is unchanged and continues to produce exactly the `"population-topup"` reason.

**Never:** Wire real Reserved-vacancy or demand-pressure detection (Epic 6, `control/evolution.ts`) — their "presence" stays hardcoded absent in this story's production code; touch Body selection/affordability (Story 5.3) or change the `[spawn]` log's existing `population`/`ttl-replacement` reason labels from Story 5.2; change control-cycle phase order.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| All three present | `["population-topup", "demand-pressure", "reserved-vacancy"]` | Returns `"reserved-vacancy"` | N/A |
| Two present, no reserved | `["population-topup", "demand-pressure"]` | Returns `"demand-pressure"` | N/A |
| Only top-up present | `["population-topup"]` | Returns `"population-topup"` | N/A |
| Nothing present | `[]` | Returns `undefined` | N/A |
| Duplicate entries present | `["population-topup", "population-topup"]` | Returns `"population-topup"` (order-stable, no double-count) | N/A |

</frozen-after-approval>

## Code Map

- `src/config.ts` -- add `SpawnPriorityReason = "reserved-vacancy" | "demand-pressure" | "population-topup"` (exported type); add `SPAWN_PRIORITY_ORDER: readonly SpawnPriorityReason[]` to `Config`/`constants`, pinned `["reserved-vacancy", "demand-pressure", "population-topup"]`.
- `src/control/spawn.ts` -- add exported pure `selectSpawnReason(present: readonly SpawnPriorityReason[]): SpawnPriorityReason | undefined` that returns the first entry of `getConstant("SPAWN_PRIORITY_ORDER")` found in `present`. Inside `spawn()`, build `present` from the existing population/TTL-replacement computation (`population < effectiveTarget ? ["population-topup"] : []` -- Epic 5 never adds `"reserved-vacancy"`/`"demand-pressure"` here, that's Epic 6's job on this same function) and call `selectSpawnReason(present)`; if `undefined`, return before the idle-Spawn lookup (equivalent to today's early return, now routed through the shared selection function instead of the bare population check).
- `test/control/spawn.test.ts` -- unit tests for `selectSpawnReason` per the I/O Matrix (fabricated reason arrays, no snapshot/adapter needed); keep all existing `spawn()` behavior tests passing unmodified.
- `test/config.test.ts` -- add `SPAWN_PRIORITY_ORDER: getConstant("SPAWN_PRIORITY_ORDER")` to both `Config`-shaped object literals.

## Tasks & Acceptance

**Execution:**
- [ ] `src/config.ts` -- add `SpawnPriorityReason` type + `SPAWN_PRIORITY_ORDER` constant -- single typed, fixed-order source (FR-17, FR-22-style config ownership).
- [ ] `src/control/spawn.ts` -- add `selectSpawnReason`; route the existing early-return through it -- proves the ordering machinery without changing observable Generalist-era behavior.
- [ ] `test/control/spawn.test.ts` -- add `selectSpawnReason` unit tests covering the full I/O Matrix.
- [ ] `test/config.test.ts` -- add the new constant to both object literals.

**Acceptance Criteria:**
- Given fabricated `present` reason lists representing simultaneous demand (a vacant Reserved slot, Collectors below minimum, population below target), when `selectSpawnReason` decides, then it returns them in exactly the fixed order — unit-tested, no live Reserved/demand producers required.
- Given the Generalist-era sim room observed over a long window, when the colony runs, then only `"population-topup"`-triggered spawns fire (the `[spawn]` log never shows a reserved-vacancy/demand-pressure reason, since Epic 5 never presents them), population climbs to and holds `SPAWN_TARGET_POPULATION` across Creep deaths, and CPU per Tick stays under budget (NFR-1).

## Design Notes

**Sequencing with Story 5.3:** both stories edit `spawn()`'s body around the same early-return. Implement 5.3 first (affordability guard) so 5.4's `selectSpawnReason` gate composes with it (order: compute `present` -> `selectSpawnReason` -> return if `undefined` -> affordability guard -> idle-Spawn lookup -> issue). If 5.4 lands first, re-verify the guard order once 5.3 lands.

`selectSpawnReason` is intentionally the *only* piece of priority-ordering logic Epic 5 ships — Epic 6 (`control/evolution.ts`) will compute real `"reserved-vacancy"`/`"demand-pressure"` presence from mine-Job vacancies and Collector counts and pass a richer `present` array into this same function, with no changes to `selectSpawnReason` or `SPAWN_PRIORITY_ORDER` itself. That's why this story's unit tests fabricate presence directly rather than trying to simulate Epic-6 producers that don't exist yet.

## Verification

**Commands:**
- `npx vitest run test/control/spawn.test.ts test/config.test.ts` -- expected: all pass, including new `selectSpawnReason` cases.
- `npm test` -- expected: full suite green, no regressions.
- `npm run typecheck` -- expected: clean.
- `npm run lint` -- expected: clean.

**Manual checks (if no CLI):**
- Sim room, long window: population holds at `SPAWN_TARGET_POPULATION` across deaths; `[spawn]` log shows only `population`/`ttl-replacement` reasons (never a reserved/demand reason); CPU per Tick stays under budget.

## Suggested Review Order

**Priority selection**

- Pure `selectSpawnReason` — returns the first `SPAWN_PRIORITY_ORDER` entry found in `present`, or `undefined`; the whole ordering machinery in one function.
  [`spawn.ts:20-28`](../../src/control/spawn.ts#L20)

- Fixed order is data, not an if/else chain: reserved-vacancy > demand-pressure > population-topup.
  [`config.ts:39-42`](../../src/config.ts#L39)

  [`config.ts:129-133`](../../src/config.ts#L129)

**Wiring into `spawn()`**

- `present` built from the unchanged 5.1/5.2 population/TTL computation — Epic 5 only ever produces `"population-topup"` here; Epic 6 adds the other two without touching this call site.
  [`spawn.ts:59-71`](../../src/control/spawn.ts#L59)

**Tests**

- `selectSpawnReason` I/O Matrix — all-three-present, partial-present, empty, duplicate-stable.
  [`spawn.test.ts:91-127`](../../test/control/spawn.test.ts#L91)

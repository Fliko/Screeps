---
title: 'Story 3.4: Matching & Claim Lock'
type: 'feature'
created: '2026-08-13'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: '588b4175258baaf3b0d9dd7d469da538c9122bb5'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Idle Creeps never pull work — `control/match.ts` is still the Story 1.4 stub — so nothing dispatches a freshly idle or freshly spawned Creep.

**Approach:** Each Tick, for every idle Creep (no Contract, not Spawning), select the best eligible open Job — Pulled mode only, TTL floor met, capacity open — ordered tier → within-tier priority → distance (`world/distance.ts`), write the Contract via `state/`, and immediately decrement that Job's local running capacity so the next idle Creep in the same call sees it (the within-Tick claim lock, FR-13).

## Boundaries & Constraints

**Always:**
- Eligibility = `assignmentMode === "pulled"` AND `creep.ttl >= job.requirements.ttlFloor` AND local running count `< job.maxWorkers`.
- Ordering: tier (critical > high > medium > low) → `withinTierPriority` descending → `liveDistance(creep.pos, job.pos)` ascending.
- Claim lock: a local `Map<JobId, number>` copied from `takenSet.entries` at the start of one `match()` call, mutated only within that call, never returned or persisted (AD-5, AD-9).
- Memory writes route through `state/contract.ts#setContract` via a `world/creeps.ts` seam only (AD-2, AD-10).
- A Spawning Creep (`creep.spawning === true`) is excluded from the idle pool even with no Contract.

**Ask First:** none anticipated.

**Never:**
- No `getRangeTo`/`findPath`/`PathFinder` in `control/match.ts` (AD-7 — distance only from `world/distance.ts`).
- No new `control/matching.ts` file — the codebase's wired file is `control/match.ts`; the spine's tree names it differently but isn't authoritative (this trap caused two reverts in Story 3.3).
- No touching `main.ts`, `control/taken.ts`, or `control/validate.ts` — Story 3.2 already wires `match(releaseContracts(takenSet, cleared))`.
- No movement, spawn-time Reserved writes, or weighted/PathFinder scoring — out of scope (3.5, Epic 6).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tier beats distance | Critical Job far away, medium Job near, one idle Creep | Critical Job assigned | N/A |
| Within-tier priority beats distance | Same tier, higher `withinTierPriority` Job farther away | Higher-priority Job assigned | N/A |
| Distance tiebreak | Equal tier and priority, two Jobs | Nearer Job assigned | N/A |
| TTL floor breach | Creep TTL below Job's `ttlFloor` | Job excluded, next-best (or none) assigned | N/A |
| Reserved mode excluded | Job `assignmentMode: "reserved"` | Never assigned to an idle Creep | N/A |
| Claim lock | 3 idle Creeps, one `maxWorkers: 1` Job | Exactly one claims it; others get distinct next-best or none | N/A |
| Spawning Creep | No Contract, `spawning: true` | Skipped, not assigned, not counted idle | N/A |
| Unreachable Creep / no snapshot / no Board | `getObjectById` → `undefined`, or `getCurrentSnapshot()`/`getBoard()` undefined | No assignment for that case; skipped and logged, no throw | `[control]`-prefixed log |

</frozen-after-approval>

## Code Map

- `src/control/match.ts` -- Story 1.4/3.2 stub, typed `match(takenSet: TakenSet): void`, wired in `main.ts`. Add pure `selectJob(creep, jobs, counts)` + orchestrator body; do not rename.
- `src/world/creeps.ts` -- has `clearCreepContract(creepId): boolean` (Story 3.3). Add symmetric `assignCreepContract(creepId, jobId): boolean` via `setContract`.
- `src/board/registry.ts` -- `getBoard(): Board | undefined` gives `board.jobs`, the open set to score against.
- `src/control/taken.ts` -- `TakenSet.entries` is `Object.freeze`d; copy into a fresh `Map` before mutating, never in place.
- `src/world/distance.ts` -- `liveDistance(a: RoomPositionData, b: RoomPositionData): number`; `SnapshotCreep.pos`/`Job.pos` are already this type.
- `src/control/validate.ts` -- orchestrator precedent: bail on no snapshot/no Board, loop snapshot Creeps, delegate to a pure function, write through a `world/` seam, log unresolvable Creeps.
- `test/control/validate.test.ts`, `test/world/creeps.test.ts` -- staging patterns to reuse.

## Tasks & Acceptance

**Execution:**
- [x] `src/world/creeps.ts` -- `assignCreepContract(creepId, jobId): boolean`, symmetric to `clearCreepContract`
- [x] `src/control/match.ts` -- `selectJob(creep, jobs, counts)`: filter pulled mode + TTL + open capacity, sort tier → withinTierPriority desc → distance asc, return best or `undefined` -- pure
- [x] `src/control/match.ts` -- `match(takenSet)`: bail on no snapshot/no Board; copy `takenSet.entries` into a local `Map`; per idle, non-Spawning Creep in snapshot order, `selectJob` then `assignCreepContract` + increment local count, else log+skip
- [x] `test/world/creeps.test.ts` -- cases for `assignCreepContract`: resolved, unresolvable, memory-less
- [x] `test/control/match.test.ts` (new) -- every I/O Matrix row against `selectJob`/`match()`, incl. a hand-built `reserved`-mode Job fixture
- [x] `test/control-cycle.test.ts` -- one `loop()` case: exactly one of two idle Creeps gets a real `memory.contract` write for a `maxWorkers: 1` Job

**Acceptance Criteria:**
- Given a Creep already holding a valid Contract, when `match` runs, then it is never touched — only Creeps with `contract === undefined` and `spawning !== true` enter selection.

## Design Notes

Tier ranking needs a local rank table inside `match.ts` (no numeric rank exists yet); do not add it to `config.ts`. Compare claim-lock counts directly against `job.maxWorkers` — don't wrap them back into a `TakenSet` to reuse `hasCapacity`.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test && npm run build` -- all clean, new tests included, `dist/main.js` builds

## Suggested Review Order

**Scoring logic**

- Entry point: pure selection over one Creep's eligible Jobs — mode, TTL, capacity filters, then tier → priority → distance ordering, with the full-tie rule documented inline.
  [`match.ts:42`](../../src/control/match.ts#L42)

- Tier-rank table backing the ordering — a local convention, deliberately not added to `config.ts` (Design Notes).
  [`match.ts:24`](../../src/control/match.ts#L24)

**Control-cycle orchestration**

- Thin AD-9 phase shim: bails on no snapshot/no Board, copies the taken-set into a local claim-lock `Map`, walks idle non-Spawning Creeps in snapshot order.
  [`match.ts:103`](../../src/control/match.ts#L103)

**Memory-write seam**

- `assignCreepContract`, symmetric to Story 3.3's `clearCreepContract` — resolves the live Creep via `getObjectById`, writes through `state/contract.ts`.
  [`creeps.ts:46`](../../src/world/creeps.ts#L46)

**Tests**

- Per-scenario matrix against `selectJob`/`match()` directly — every I/O row, plus the full-tie case added during review.
  [`match.test.ts:111`](../../test/control/match.test.ts#L111)

- `assignCreepContract` in isolation — resolved, overwritten, unresolvable, memory-less.
  [`creeps.test.ts`](../../test/world/creeps.test.ts#L72)

- End-to-end: `loop()` claim-locks a real `fill` Job between two competing Creeps, with the snapshot-order (not distance) tiebreak explained inline.
  [`control-cycle.test.ts:294`](../../test/control-cycle.test.ts#L294)

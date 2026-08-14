---
baseline_commit: 588b4175258baaf3b0d9dd7d469da538c9122bb5
status: review
---

# Story 3.4: Matching & Claim Lock

Status: review

<!-- Implemented via bmad-build; see spec-3-4-matching-claim-lock.md (status: done)
     for the frozen intent, Spec Change Log, and Suggested Review Order. This file's
     own Tasks/Subtasks and Dev Notes stand as originally written and were not used
     as the execution spec. -->

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the operator,
I want Matching to assign idle Creeps by tier → within-tier priority → distance, with TTL eligibility and a within-Tick claim lock,
So that dispatch is deterministic, cheapest-first, and herd-proof (FR-6, FR-10, FR-11, FR-12, FR-13).

**Epic 3 — Dispatch: Creeps Claim and Keep Work.** Story 3.1 built the Contract schema, 3.2 the taken-set, 3.3 the validators. This story is the dispatch brain: every Tick, each idle Creep (holds no Contract) is offered the best open Pulled Job — tier first, then within-tier priority (the mechanism that makes FR-24's Container-first construction pure data, once it exists in Epic 6), then nearest by the `world/` distance service — and TTL-ineligible or Reserved Jobs are never offered. Assignment is claim-locked within the same Tick so N Creeps going idle simultaneously get N distinct Jobs, not a pile-up on one.

Do **not** implement movement (Story 3.5), spawn-time Reserved Contract writing (Epic 6), or any weighted/PathFinder scoring — AD-7 forbids pathfinding in the scoring path; distance comes only from `world/distance.ts`.

[Source: epics.md L334–357; prd.md FR-6, FR-10, FR-11, FR-12, FR-13; ARCHITECTURE-SPINE.md AD-7 L62–66, AD-9 L72–76]

## Acceptance Criteria

1. **Tier-first, within-tier-priority-second ordering (AC1)** — Given an idle Creep and open Jobs across tiers, when Matching runs, then a critical `fill` Job across the room beats a medium `build` Job next door, and a Job with higher `withinTierPriority` in the same tier beats a nearer Job with lower `withinTierPriority` in that tier. [AC: epics.md L342–344; FR-11]
2. **Distance breaks same-tier, same-priority ties (AC2)** — Given two Jobs with equal tier and equal `withinTierPriority`, when Matching runs, then the nearer one (by `world/distance.ts`) wins. [AC: epics.md L345–347; FR-11]
3. **Within-Tick claim lock (AC3)** — Given three idle Creeps and one `maxWorkers: 1` Job on the same Tick, when Matching runs, then exactly one Creep claims it and the other two are assigned distinct next-best Jobs (or none, if none remain eligible). [AC: epics.md L348–350; FR-13]
4. **TTL and Reserved-mode exclusions (AC4)** — Given a Creep whose remaining TTL is below a Job's `ttlFloor`, or a Job whose `assignmentMode` is `reserved`, when Matching runs, then no assignment is made in either case. [AC: epics.md L351–353; FR-12, FR-6]
5. **Assignment writes through `state/` (AC5)** — Given a winning Creep/Job pair, when the assignment is made, then the Contract is written via `state/contract.ts#setContract` on the live Creep object (AD-2), and that Creep is excluded from the rest of this Tick's Matching (FR-10). [AC: epics.md L354; AD-2]
6. **Backfill falls out of ordinary scoring (AC6)** — Given an idle Creep with only the `upgrade` Job open (always posted, unlimited workers, lowest tier), when Matching runs, then the Creep is assigned `upgrade` through the same scoring path used for every other Job — no separate fallback code path exists. [AC: epics.md L355–357; FR-21 by calculation]

## Tasks / Subtasks

- [ ] **T1 — Pure selection helper in `src/control/match.ts` (AC1, AC2, AC4, AC6)**
  - [ ] Export `selectJob(creep: SnapshotCreep, jobs: readonly Job[], counts: ReadonlyMap<JobId, number>): Job | undefined`
  - [ ] Filter to eligible Jobs: `assignmentMode === "pulled"` (AC4/FR-6), `creep.ttl >= job.requirements.ttlFloor` (AC4/FR-12), and open capacity — `(counts.get(job.id) ?? 0) < job.maxWorkers` (reuse the same comparison `hasCapacity` makes, but against the local running counts, not the Tick-start `TakenSet`)
  - [ ] Sort eligible Jobs by tier (critical > high > medium > low — define a tier-rank table or reuse ordering from `config.ts`'s policy table shape), then `withinTierPriority` descending, then `liveDistance(creep.pos, job.pos)` ascending (`world/distance.ts`)
  - [ ] Return the first (best) Job, or `undefined` if none eligible
  - [ ] No Game reads, no Memory writes — pure function over plain data, mirrors `agents/validators.ts`'s purity convention

- [ ] **T2 — Live-write seam in `src/world/creeps.ts` (AC5)**
  - [ ] Export `assignCreepContract(creepId: string, jobId: JobId): boolean`, symmetric to the existing `clearCreepContract`
  - [ ] Resolve via `getGame().getObjectById<Creep>(creepId)`, guard `"memory" in creep && creep.memory`, delegate to `state/contract.ts#setContract({ jobId })`, return whether the Creep was reachable
  - [ ] Import `JobId` type-only from `../board/job`; import `setContract` from `../state/contract`

- [ ] **T3 — Thin orchestrator: `match(takenSet)` in `src/control/match.ts` (AC3, AC5)**
  - [ ] Bail early (log, return) if no snapshot or no Board — same defensive shape as `control/validate.ts`
  - [ ] Build one local mutable `Map<JobId, number>` copied from `takenSet.entries` — the claim lock's running counts for this Tick only, never exposed outside the function
  - [ ] Iterate idle Creeps from `snapshot.creeps` in snapshot order — idle means `creep.contract === undefined`; also exclude `creep.spawning === true` (a Spawning Creep has no live position to travel from yet and no Contract-writing story wires it into Matching until Epic 6's Reserved-slot spawn — see Dev Notes)
  - [ ] For each idle Creep, call `selectJob(creep, board.jobs, counts)`; on a hit, call `assignCreepContract(creep.id, job.id)`, and on success increment `counts` for that Job id **before** the next Creep is considered — this is the claim lock (AC3)
  - [ ] Log (module-prefixed) when `assignCreepContract` reports the Creep unreachable, mirroring `validate.ts`'s unresolvable-Creep log
  - [ ] Remove the Story 1.4/3.2 stub body and its `TODO(Story 3.4)` comment

- [ ] **T4 — Unit tests: `test/control/match.test.ts` (new)**
  - [ ] `selectJob`: tier beats within-tier-priority beats distance (AC1) — fabricate a `reserved`-mode Job with a Board fixture (mine doesn't exist yet; hand-build one) to prove AC4's mode exclusion
  - [ ] `selectJob`: equal tier and priority, nearer Job wins (AC2)
  - [ ] `selectJob`: TTL below floor excludes the Job even when it would otherwise win (AC4/FR-12)
  - [ ] `selectJob`: a Job at full capacity (per `counts`) is excluded even with an open Board entry
  - [ ] `selectJob`: only the `upgrade` Job open → it is selected with no special-cased code path (AC6)
  - [ ] `match()`: three idle Creeps, one `maxWorkers: 1` Job — exactly one claims it, the running counts prevent a second claim within the same call (AC3)
  - [ ] `match()`: a Spawning Creep with no Contract is skipped (not assigned, not counted as idle)
  - [ ] `match()`: no snapshot / no Board bail with no assignments, matching `validate.ts`'s guard shape
  - [ ] `match()`: an unreachable Creep (`getObjectById` returns `undefined`) is logged and skipped, not silently retried

- [ ] **T5 — Unit tests: `test/world/creeps.test.ts` (update, AC5)**
  - [ ] `assignCreepContract`: resolved Creep → `memory.contract` set to the jobId, returns `true`
  - [ ] `assignCreepContract`: unresolvable id → returns `false`, no throw
  - [ ] `assignCreepContract`: memory-less resolved object → returns `false`

- [ ] **T6 — `test/control-cycle.test.ts` (update, AC3, AC5)**
  - [ ] One end-to-end case: `loop()` with two idle Creeps and one open `maxWorkers: 1` Job — exactly one Creep's real `memory.contract` is set after the Tick
  - [ ] One case proving `match` receives the **post-validation** taken-set (Story 3.2's `releaseContracts` output), not the pre-validate instance — reuse the pattern from Story 3.3's wiring test

## Dev Notes

### Architecture Compliance

- **AD-1 module roles:** Matching logic lives entirely in `control/match.ts` — the spine's Capability→Architecture Map assigns "PRD §4.3 Job Matching" to `control/matching` only (no `agents/` split, unlike Story 3.3's validators). **Do not** create a second file — keep the pure `selectJob` helper and the orchestrator in the same `control/match.ts` this story updates in place.
- **Naming trap — read before coding:** the spine's Structural Seed names the file `control/matching.ts`, but the codebase's actual file — already created in Story 1.4, already wired into `main.ts`, already typed by Story 3.2 — is `control/match.ts`. This exact spine-vs-codebase mismatch caused a full spec revert in Story 3.3 (loop 2, `agents/validators.ts` vs `control/validate.ts`). Update the existing `src/control/match.ts`; do not create `matching.ts`.
- **AD-2 write ownership:** only `control/` sets Contracts — this story is one of the two places that do (the other is spawn-time writing, Epic 6). Write through `state/contract.ts#setContract`, called from the new `world/creeps.ts#assignCreepContract` seam — never touch `.memory.contract` directly in `control/`.
- **AD-7 no pathfinding in scoring:** all distances come from `world/distance.ts#liveDistance` (Chebyshev at MVP). Do not call `getRangeTo`, `findPath`, or `PathFinder` from `control/match.ts`.
- **AD-9 control-cycle order:** `match` is the fourth phase, already wired in `main.ts` receiving `releaseContracts(takenSet, cleared)` — the post-validation taken-set. Do not touch `main.ts`'s wiring; the signature `match(takenSet: TakenSet): void` is unchanged from Story 3.2.
- **AD-10 Game reads only through `world/`:** `control/match.ts` never calls `getObjectById` directly — it goes through the new `world/creeps.ts#assignCreepContract`, mirroring Story 3.3's `clearCreepContract`.

### Design Notes

- **Idle Creep definition:** `creep.contract === undefined`. Whether to also exclude `creep.spawning === true` is a real design choice, not explicitly tested by epics.md's ACs for this story — recommended default (see T3) is to exclude Spawning Creeps from Matching entirely, since: (a) no story before Epic 5 spawns a Generalist without a Contract, so no live case currently exercises it; (b) a Spawning Creep's `ttl` reads `0` (see Story 3.2/3.3 notes), which would trivially pass the `upgrade` Job's `ttlFloor: 0` and could claim Backfill before the Creep can act. If this reasoning doesn't hold once implementing, flag it rather than guessing — this is exactly the kind of ambiguity that caused Story 3.3's two spec reverts.
- **Claim lock scope:** the running `counts` map in T3 is local to one `match()` call and discarded after — it is not the `TakenSet` returned to any caller (unlike `validate`, `match` returns `void`). Do not mutate the `takenSet` parameter's `entries` (frozen, would throw) or return a new `TakenSet` — nothing downstream consumes one from `match`.
- **Reserved-mode fixture for AC4:** no Job in the current Board can be `assignmentMode: "reserved"` yet (`mine` doesn't exist until Story 6.2). Build a hand-constructed `Job` object for the reserved-exclusion test rather than trying to produce one through the real Producers — the same approach Story 3.2/3.3 tests already use for `Job` fixtures.
- **Tier ordering:** `PriorityTier` is `"critical" | "high" | "medium" | "low"`, no numeric rank exists yet anywhere in the codebase. `withinTierPriority` sorts descending (Story 2.3's convention: higher = more important, e.g. Container-first). Define whatever tier-rank table `selectJob` needs locally in `match.ts` — do not add it to `config.ts` unless a future story needs it elsewhere.

### File Structure Requirements

| File | Action | Purpose |
| --- | --- | --- |
| `src/control/match.ts` | Update | `selectJob` pure helper + `match(takenSet)` orchestrator, claim lock |
| `src/world/creeps.ts` | Update | `assignCreepContract(creepId, jobId): boolean` |
| `test/control/match.test.ts` | Create | Unit tests for `selectJob` and `match()` |
| `test/world/creeps.test.ts` | Update | Tests for `assignCreepContract` |
| `test/control-cycle.test.ts` | Update | End-to-end claim-lock and post-validation-taken-set wiring |

### Testing Requirements

- Use **vitest** (`describe`/`it`/`expect`), matching existing project convention.
- `selectJob` is pure — test with plain-data `SnapshotCreep`/`Job` fixtures, no Game mocking.
- `match()` needs `setGame()` with a `getObjectById` mock returning Creep-shaped `{ id, memory }` objects (the same pattern `test/control/validate.test.ts` and `test/world/creeps.test.ts` already establish).
- Run the full verification suite after implementation:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`

### Previous Story Intelligence

From **Story 3.3: Validators** (most recent, most relevant):
- `src/world/creeps.ts` already exists with `clearCreepContract(creepId): boolean` — this story adds the symmetric `assignCreepContract`; follow its exact guard shape (`"memory" in creep && creep.memory`).
- `control/validate.ts` is the precedent for a thin AD-9 orchestrator: bail on no snapshot/no Board, loop the snapshot's Contracted Creeps, delegate the verdict to a pure function, write through the `world/` seam, log unresolvable Creeps. `control/match.ts` should read the same way for idle Creeps.
- `Creep.spawning` is already plumbed through `game.ts` → `world/snapshot.ts` (`SnapshotCreep.spawning?: boolean`) — use it directly, no new plumbing needed.
- Two spec reverts in 3.3 both traced to *not reading the actual codebase* before trusting the architecture spine's file tree (which is missing real, committed modules like `control/taken.ts` and `control/metering.ts`, and — relevant here — names `matching.ts` where the codebase has `match.ts`). Read `src/control/match.ts` and `src/control/taken.ts` as they exist on disk before writing any code.
- Test staging pattern (`test/control/validate.test.ts`): a `stage(creeps, jobs)` helper that calls `setGame`, `resetBoard`/`addJob`, `buildWorldSnapshot()` — reuse or mirror this for `match.test.ts`.

From **Story 3.2: Taken-Set Derivation**:
- `TakenSet.entries` is `Object.freeze`d — copy into a fresh `Map` before mutating locally (T3); never attempt to mutate `takenSet.entries` in place.
- `getTakenCount`/`hasCapacity` take a `TakenSet`, not a raw `Map` — T1's `selectJob` takes a raw `ReadonlyMap<JobId, number>` instead (the local running counts), so do not try to wrap it back into a `TakenSet` just to reuse `hasCapacity`; a direct comparison is simpler and avoids re-freezing on every Creep.
- `main.ts` already calls `match(releaseContracts(takenSet, cleared))` — the taken-set `match` receives already excludes what `validate` cleared this Tick.

### Project Context Reference

- All tunables live in `src/config.ts`; do not hardcode values. This story introduces no new tunables — tier ordering and `withinTierPriority` come from already-Job-carried fields, not new config.
- `Job.assignmentMode` is `"reserved" | "pulled"`; `Job.maxWorkers` can be `Infinity` (the `upgrade` Backfill).
- `findJob`/`getBoard` live in `src/board/registry.ts`; `match` needs `getBoard()?.jobs`, not `findJob` (validate looks up one Job by id, match needs the whole open set).
- `world/distance.ts#liveDistance(a: RoomPositionData, b: RoomPositionData): number` — both `SnapshotCreep.pos` and `Job.pos` are already `RoomPositionData`; no adapter call needed for distance.
- Current `src/control/match.ts` is a 7-line stub with a `TODO(Story 3.4)` comment; replace its body, keep the signature.

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## References

- [Source: epics.md L334–357] — Story 3.4 ACs: tier → within-tier-priority → distance, TTL eligibility, claim lock, Backfill-by-calculation
- [Source: prd.md FR-6] — Assignment-mode separation (Reserved never offered to idle Creeps)
- [Source: prd.md FR-10] — Idle-only assignment
- [Source: prd.md FR-11] — Tier-first matching
- [Source: prd.md FR-12] — TTL-aware matching
- [Source: prd.md FR-13] — Within-Tick claim lock
- [Source: ARCHITECTURE-SPINE.md AD-1] — Blackboard module roles (Matching stays in `control/`, no `agents/` split)
- [Source: ARCHITECTURE-SPINE.md AD-2] — Write ownership (`control/` sets Contracts)
- [Source: ARCHITECTURE-SPINE.md AD-7] — No pathfinding in scoring; tier → within-tier priority → distance ordering
- [Source: ARCHITECTURE-SPINE.md AD-9] — Control-cycle order; `match` receives the post-validation taken-set
- [Source: _bmad-output/implementation-artifacts/spec-3-3-validators.md] — Previous story: validators, `world/creeps.ts` seam pattern, `Creep.spawning` plumbing
- [Source: _bmad-output/implementation-artifacts/3-2-taken-set-derivation.md] — Previous story: `TakenSet`, `releaseContracts`, frozen-wrapper convention
- [Source: src/control/match.ts] — Current stub to replace
- [Source: src/control/taken.ts] — `TakenSet`, `getTakenCount`, `hasCapacity`
- [Source: src/control/validate.ts] — Thin AD-9 orchestrator precedent
- [Source: src/world/creeps.ts] — `clearCreepContract`, seam pattern to extend
- [Source: src/world/distance.ts] — `liveDistance`, the only permitted distance source
- [Source: src/board/registry.ts] — `getBoard()`, `findJob()`
- [Source: src/board/job.ts] — `Job`, `JobId`, `parseJobId`
- [Source: src/state/contract.ts] — `setContract`
- [Source: src/config.ts] — `JobPolicyTable` shape (reference only; no changes needed)
- [Source: src/main.ts] — AD-9 control cycle, existing `match(releaseContracts(takenSet, cleared))` call site

## Change Log

- **2026-08-13:** Story created (ready-for-dev).

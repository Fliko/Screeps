---
baseline_commit: 09c315357df993488b87da163f1e9b24269d63e9
status: done
---

# Story 3.2: Taken-Set Derivation

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the operator,
I want the taken-set derived fresh each Tick from all Creeps' Contracts — including Creeps still Spawning,
So that capacity accounting is exact and Reserved slots never double-fill (FR-5, FR-16, FR-29).

**Epic 3 — Dispatch: Creeps Claim and Keep Work.** Epic 2 built the Job Board; Story 3.1 established `state/contract.ts` as the single owner of `creep.memory.contract`. Story 3.2 adds the **taken-set** — the per-Tick count of active Contracts per Job. It is derived, not stored (AD-5, AD-9), and consumed by the validate (Story 3.3) and match (Story 3.4) phases.

Do **not** implement validators, Matching logic, scoring, claim lock, spawn queueing, or Reserved-slot spawn Contract writing here. This story only builds the data structure and the derive phase seam. Spawn writes Reserved Contracts in Epic 5; this story must design the seam so those Contracts feed the taken-set without rework.

[Source: epics.md L300–315; prd.md FR-5, FR-16, FR-29; ARCHITECTURE-SPINE.md AD-9 L72–76]

## Acceptance Criteria

1. **Taken-set type and helpers (AC1)** — Given the `control/taken.ts` module, when a developer inspects it, then it exports a `TakenSet` type that holds per-Job Contract counts and helper functions (`getTakenCount`, `hasCapacity`) with no business logic leaking into `state/` or `world/`. [AC: epics.md L300–315; AD-1 module roles]
2. **Derive from Contracts (AC2)** — Given arrays of `ContractState` objects (living + spawning), when `deriveTakenSet(contracts)` is called, then it returns a `TakenSet` whose counts reflect how many Creeps hold each Job id. [AC: epics.md L308–310; FR-5]
3. **Spawning Creeps count (AC3)** — Given a Contract held by a Creep still Spawning, when the taken-set is derived, then that Job counts as taken — unit-tested (the double-spawn trap from the adversarial review). [AC: epics.md L308–310; FR-16, FR-29]
   - *Amended 2026-08-13 during code review:* satisfied through the world snapshot, not a separate spawn seam. `spawnCreep` creates the Creep immediately in `Game.creeps` with its Reserved Contract already written, and `room.find(FIND_MY_CREEPS)` returns it while `spawning === true`, so it reaches the taken-set like any other Creep. See the withdrawn T3.
4. **No persistence (AC4)** — Given two consecutive Ticks with different Contracts, when each derives its own taken-set, then nothing carries over — the set is recomputed, never stored in Memory or module state (AD-5, AD-9). [AC: epics.md L311–313]
5. **Run once per Tick and pass downstream (AC5)** — Given the control cycle in `main.ts`, when a Tick runs, then `deriveTakenSet` runs exactly once after `generate` and before `validate`, and the same `TakenSet` instance is passed to `validate` and `match`. [AC: epics.md L314–315; AD-9]
   - *Amended 2026-08-13 during code review:* `match` receives the **post-validation** taken-set, not unconditionally the same instance. `validate` now returns the Contracts it cleared and `releaseContracts` removes them before `match` reads capacity — otherwise a Job reads as full while its worker is being released, since AD-9 derives the taken-set before validate runs. When validate clears nothing (the case until Story 3.3), `releaseContracts` returns the original instance, so the identity guarantee still holds today.
6. **No direct `creep.memory` access in `control/` (AC6)** — Given a grep across `src/control/`, when searching for `.memory.contract` reads, then there are zero hits; Contracts reach the taken-set from the snapshot, never directly from memory. [AC: AD-2 single owner; Story 3.1 AC5]
   - *Amended 2026-08-13 during code review:* original wording said `control/taken.ts` "reads Contracts from the snapshot and from the spawn seam". It reads neither — it is pure and takes an injected array. AD-9 binds the collection to `main.ts`: *"The taken-set is derived in `main.ts` during the cycle and passed to validate and match."* The grep clause is unchanged and satisfied.

## Tasks / Subtasks

- [x] **T1 — Implement `TakenSet` data structure in `src/control/taken.ts` (AC1, AC2)**
  - [x] Replace the empty `deriveTakenSet()` stub in `src/control/taken.ts`
  - [x] Define and export `TakenSet` interface: `{ readonly entries: ReadonlyMap<JobId, number> }`
  - [x] Import `JobId` as type-only from `../board/job`
  - [x] Import `ContractState` as type-only from `../state/contract`
  - [x] Add file header comment: "AD-9: taken-set phase — derived per-Tick count of active Contracts per Job"
  - [x] Export `getTakenCount(takenSet, jobId)` returning `number` (0 if absent)
  - [x] Export `hasCapacity(takenSet, job)` returning `boolean` (`getTakenCount(job.id) < job.maxWorkers`)
  - [x] Keep helpers pure; no Game reads, no Memory writes, no Board mutation

- [x] **T2 — Implement `deriveTakenSet` (AC2, AC3, AC4)**
  - [x] Signature: `deriveTakenSet(contracts: readonly ContractState[]): TakenSet`
  - [x] Count Contracts by `jobId` into a `Map<JobId, number>`
  - [x] Return a frozen/immutable `TakenSet` (e.g., wrap the Map and expose via `readonly entries`)
  - [x] Empty input → empty Map
  - [x] Duplicate `jobId`s increment the count
  - [x] Treat `contracts` as read-only; do not mutate caller arrays
  - [x] Do **not** validate jobId grammar here — upstream `getContract` and `setContract` already guarantee valid Job ids

- [x] **T3 — ~~Add spawn seam for pending Reserved Contracts (AC3)~~ — WITHDRAWN 2026-08-13 during code review**
  - The task rested on a mistaken premise: that Creeps are invisible to `FIND_MY_CREEPS` until Spawning completes. They are not. `spawnCreep` creates the Creep immediately with its Reserved Contract written, so it already reaches the taken-set through the snapshot. Keeping the seam would have double-counted every Reserved Contract once Epic 5 filled it — `hasCapacity` under-reporting, the mirror of the trap AC3 exists to prevent, and undetectable because `ContractState` carries no Creep identity.
  - Removed: `getPendingSpawnContracts()` from `src/control/spawn.ts`, its use in `src/main.ts`, and `test/control/spawn.test.ts`.

- [x] **T4 — Wire taken-set into `src/main.ts` (AC5)**
  - [x] Import `getCurrentSnapshot` from `./world/snapshot`
  - [x] Import `deriveTakenSet`, type `TakenSet` from `./control/taken`
  - [x] ~~Import `getPendingSpawnContracts` from `./control/spawn`~~ — withdrawn with T3
  - [x] Update `measurePhase` in `src/control/metering.ts` to a generic return type so `deriveTakenSet` can return its result while still being metered
  - [x] In `loop()`:
    - After `generate()`, build the Contract array in one pass over `getCurrentSnapshot()?.creeps`, keeping Creeps whose `contract` field is defined (Creeps still Spawning are among them)
    - Log a warning and derive from an empty array when no snapshot exists, rather than silently reading every Job as open
    - Call `deriveTakenSet(contracts)`
    - Pass the `TakenSet` to `validate(takenSet)`, then `match(releaseContracts(takenSet, cleared))`
  - [x] Preserve AD-9 phase order: generate → deriveTakenSet → validate → match → spawn

- [x] **T5 — Update `validate` and `match` signatures (AC5 seam)**
  - [x] Change `src/control/validate.ts` to `export function validate(takenSet: TakenSet): readonly ContractState[]` returning `[]` — amended during code review from `void` so cleared Contracts can be released before match (see AC5 amendment)
  - [x] Change `src/control/match.ts` to `export function match(takenSet: TakenSet): void` (body stays empty)
  - [x] Import `TakenSet` as type-only from `./taken`
  - [x] Leave TODO comments referencing Stories 3.3 and 3.4


- [x] **T6 — Unit tests for `deriveTakenSet` in `test/control/taken.test.ts` (AC1–AC4)**
  - [x] Empty array returns empty `entries`
  - [x] Single Contract returns count 1
  - [x] Multiple distinct Contracts return count 1 each
  - [x] Duplicate Contracts return incremented count
  - [x] Spawning Contracts mixed with living Contracts are counted together — moved to `test/control-cycle.test.ts`, where a Spawning Creep (ttl 0) actually flows through `loop()`; the original unit test only spread two locally-named arrays and could not observe the seam
  - [x] `getTakenCount` returns 0 for untaken Job id
  - [x] `hasCapacity` returns `true` when below `job.maxWorkers`
  - [x] `hasCapacity` returns `false` when count reaches `job.maxWorkers`
  - [x] `hasCapacity` returns `true` for Infinity maxWorkers regardless of count
  - [x] Returned `entries` is read-only (TypeScript `readonly`) and not mutated by later calls

- [x] **T7 — Update `test/control-cycle.test.ts` for taken-set wiring (AC5)**
  - [x] Spy on `validate` and `match` after importing them dynamically
  - [x] Assert that both functions are called exactly once per Tick
  - [x] Assert that both functions receive the same `TakenSet` object
  - [x] Assert phase logs still appear in AD-9 order
  - [x] Ensure existing AC2 (metering disabled) and AC4 (zero colony Memory) tests still pass

- [x] **T8 — Verify no direct memory access (AC6)**
  - [x] Run `rg "\.memory\.contract" src/control/ --type ts` and confirm zero hits
  - [x] Note: `src/state/contract.ts` and `src/game.ts` are the only permitted touch points per Story 3.1

### Review Findings

- [x] [Review][Patch] **(from Decision 1 — resolved: drop the seam)** Remove `getPendingSpawnContracts()` entirely. The seam rested on a mistaken premise: that Creeps are invisible until Spawning completes. They are not — `spawnCreep` creates the Creep immediately in `Game.creeps`, `room.find(FIND_MY_CREEPS)` returns it while `spawning === true`, and its Reserved Contract (written at `spawnCreep` per AD-9) already reaches the taken-set through the snapshot's `living` path. Keeping the seam would double-count once Epic 5 filled it. Remove the export from `src/control/spawn.ts`, its import and use in `src/main.ts`, and `test/control/spawn.test.ts`; annotate T3 as withdrawn. AC3 remains satisfied — but via the snapshot path, so it needs the real test in the item below. Related: the adapter maps `ttl: creep.ticksToLive ?? 0`, so Spawning Creeps enter the snapshot with ttl 0 — Story 3.3 `ttlFloor` checks must account for this.
- [x] [Review][Patch] **(from Decision 2 — resolved: validate returns cleared Contracts)** Change `validate` to return the Contracts it cleared so `match` sees post-validation capacity, closing the one-Tick starvation window where a Job reads as full while its worker is being released. Add a `releaseContracts(takenSet, cleared): TakenSet` helper to `src/control/taken.ts` and apply it in `main.ts` between the validate and match phases. **Note: this amends AC5** — `validate` and `match` no longer receive the same `TakenSet` instance when validate clears anything; they receive the same instance only when nothing was cleared. AC5's wording and its test both need updating to assert the post-validation set instead of instance identity.
- [x] [Review][Patch] `measurePhase` metered branch can drop the return value undetected [src/control/metering.ts:23]
- [x] [Review][Patch] The snapshot-to-Contract derivation in `loop()` is never run with any Creep holding a Contract [src/main.ts:31-37]
- [x] [Review][Patch] AC3's headline requirement is untested — no test asserts a pending-spawn Contract reaches the derived `TakenSet` [src/main.ts:35, test/control/taken.test.ts:285]
- [x] [Review][Patch] `hasCapacity` Infinity test is vacuous — Job id `upgrade:spawn1` never matches the `upgrade:controller1` Contracts, so the measured count is 0 [test/control/taken.test.ts:108-114]
- [x] [Review][Patch] The "read-only map" test asserts nothing about read-only-ness and duplicates the test above it [test/control/taken.test.ts:74-84]
- [x] [Review][Patch] AC4's "two consecutive Ticks" scenario is never exercised through `loop()` [test/control-cycle.test.ts]
- [x] [Review][Patch] `taken.ts` module JSDoc describes the caller's behavior, not the module's — it takes an injected array and reads no snapshot [src/control/taken.ts:1-8]
- [x] [Review][Patch] `TakenSet` wrapper is not frozen; `ReadonlyMap` is erased at runtime and the instance is shared by validate and match [src/control/taken.ts:107]
- [x] [Review][Patch] `creep.contract as string` is an unchecked cast where a type predicate would narrow properly and preserve `JobId` [src/main.ts:161]
- [x] [Review][Patch] Module-namespace spies are never restored and `vitest.config.ts` sets no `restoreMocks` [test/control-cycle.test.ts:148-149]
- [x] [Review][Patch] Missing `hasCapacity` boundary tests (`maxWorkers: 0`, over-subscribed count) and no test that `deriveTakenSet` leaves the caller's array unmutated [test/control/taken.test.ts]
- [x] [Review][Patch] Derivation allocates three arrays per Tick (filter, map, spread) in a CPU-metered hot path where one loop suffices [src/main.ts:31-37]
- [x] [Review][Patch] A missing snapshot degrades silently to an empty taken-set, making every Job look open [src/main.ts:32]
- [x] [Review][Defer] `spawn` phase is not given the `TakenSet` though Reserved-slot spawning needs capacity data [src/main.ts:167] — deferred, Epic 5 scope
- [x] [Review][Defer] Contracts naming a `jobId` absent from this Tick's Board are still counted [src/control/taken.ts:102] — deferred, Story 3.3 validator scope
- [x] [Review][Defer] `hasCapacity` is never tested against Jobs produced by `world/producers/` from `JOB_POLICY_TABLE` [test/control/taken.test.ts] — deferred, Story 3.4 scope

## Dev Notes

### Architecture Compliance

- **AD-1 module roles:** `control/taken.ts` is a control-phase module. It derives data; it does not write the Board, read Game directly, or execute Creep intents.
- **AD-2 write ownership:** The taken-set is read-only derived data. No module writes it; `control/match` will read it in Story 3.4. `control/spawn` owns the pending-spawn seam via `getPendingSpawnContracts()`.
- **AD-3 Board is per-Tick derived:** The taken-set is recomputed every Tick from the freshly built snapshot. It must not cache counts across Ticks.
- **AD-4 Contract grammar:** A Contract is `jobId = type:targetId`. The taken-set keys are Job ids. Do not parse or split them here.
- **AD-5 zero colony-level persistence:** The taken-set lives only as a local variable in `loop()`. No Memory keys, no module-level cache.
- **AD-9 control-cycle order:** `generate` builds the snapshot and Board; `deriveTakenSet` follows; `validate` and `match` consume the same instance. The spawn phase runs after matching.
- **AD-10 Game reads only through `world/`:** `control/taken.ts` reads Contracts from `WorldSnapshot.creeps`, which is produced by `world/snapshot.ts`. It does not call Game APIs.


### File Structure Requirements

| File | Action | Purpose |
| --- | --- | --- |
| `src/control/taken.ts` | Update | Core `TakenSet` type, `deriveTakenSet`, helpers |
| `src/control/metering.ts` | Update | Generic `measurePhase<T>` return type |
| `src/control/spawn.ts` | Update | `getPendingSpawnContracts()` placeholder seam |
| `src/control/validate.ts` | Update | Accept `TakenSet` parameter |
| `src/control/match.ts` | Update | Accept `TakenSet` parameter |
| `src/main.ts` | Update | Derive and forward takenSet through AD-9 cycle |
| `test/control/taken.test.ts` | Create | Unit tests for derivation, counts, capacity |
| `test/control-cycle.test.ts` | Update | Verify takenSet is passed to validate/match |

### Testing Requirements

- Use **vitest** with `describe`/`it`/`expect` (existing project convention).
- Prefer plain objects and type-only imports; avoid mocking `Game` for pure derivation tests.
- For `test/control-cycle.test.ts`, use `vi.spyOn` or dynamic imports to intercept `validate`/`match` without mutating their real implementations.
- Run verification suite after implementation:
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`

### Previous Story Intelligence

From **Story 3.1: Contract & Memory Schema**:
- `state/contract.ts` exports `ContractState { jobId: JobId }`, `getContract`, `setContract`, `clearContract`.
- `world/snapshot.ts` populates `SnapshotCreep.contract?: string` via `getContract`, so snapshot contracts are already validated.
- Direct `creep.memory.contract` access is restricted to `state/contract.ts` and the `src/game.ts` adapter mapping.
- Tests are object-based (fake Creep with `memory` object), not integration tests.
- Code style: string-union types, type-only imports, `readonly` arrays, no runtime enums.

Apply the same patterns here: keep `control/taken.ts` pure, derive from snapshot data, and validate seam behavior with unit tests.

### Project Context Reference

- All tunables live in `src/config.ts`; do not hardcode values.
- `Job` carries `maxWorkers: number` (can be `Infinity`).
- `Board` is rebuilt every Tick; `findJob(id)` in `board/registry.ts` can look up a Job by id when Matching needs it in Story 3.4.
- Current `src/control/taken.ts` is a 3-line empty stub; replace it entirely.
- Current `src/main.ts` calls phases through `measurePhase` and does not import snapshot or spawn.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- `npm run typecheck` — clean (2 pre-existing errors from partial T1–T3 wiring fixed by T4/T5)
- `npm test` — 84/84 passed
- `npm run lint` — clean (biome autofixed formatting/import order; unused-param warnings resolved with `_takenSet` naming)
- `npm run build` — `dist/main.js` 11.5kb

### Completion Notes List

- `TakenSet`, `deriveTakenSet`, `getTakenCount`, `hasCapacity`, and the `getPendingSpawnContracts` seam were already implemented on disk (uncommitted) when this session started; verified against AC1–AC4 and left unchanged.
- Made `measurePhase` generic (`<T>(name, fn: () => T): T`) so `deriveTakenSet`'s return value survives metering.
- Wired `main.ts`: after `generate()`, builds the living-contract array from `getCurrentSnapshot()?.creeps` (contracts already Job-id-validated by `state/contract.ts` via the snapshot), concatenates with `getPendingSpawnContracts()`, derives one `TakenSet`, and passes the same instance to `validate(takenSet)` and `match(takenSet)`.
- Updated `validate`/`match` signatures to accept `TakenSet` (param named `_takenSet` — unused until Stories 3.3/3.4); added TODO comments referencing those stories.
- Fixed a pre-existing bug in `test/control-cycle.test.ts`'s Taken-Set Wiring block: `vi.resetModules()` in `beforeEach` caused the dynamically re-imported `main.ts` to bind to a fresh, unmocked `game.ts` module instance (`Game is not defined`) and to fresh `validate`/`match` module instances the test's `vi.spyOn` calls weren't watching. Removed the reset — the file's other describe blocks already reuse the cached module graph safely across tests.
- Added a `TakenSet`-typed test asserting `entries` is a `Map` and stays stable across later `deriveTakenSet` calls (closing the last T6 checklist item, which was otherwise only indirectly covered).
- AC6 verified via `rg "\.memory\.contract" src/control/ --type ts` — zero hits.

### Code Review Follow-up (2026-08-13)

Adversarial review with four parallel layers. 2 decision-needed, 13 patch, 3 deferred, 7 dismissed. All 15 patches applied.

**Two decisions resolved by Fliko:**

1. **Spawn seam dropped.** The seam assumed Creeps stay invisible until Spawning finishes. They do not — `spawnCreep` puts the Creep in `Game.creeps` immediately with its Reserved Contract written, so `FIND_MY_CREEPS` returns it and the snapshot already carries it. Had Epic 5 filled `getPendingSpawnContracts()`, every Reserved Contract would have counted twice, and `ContractState` carries no Creep identity to de-duplicate on. Seam removed rather than worked around; AC3 now verified through the snapshot path.
2. **`validate` returns cleared Contracts.** AD-9 derives the taken-set before validate, so cleared Contracts would still hold capacity when match ran — a Job reading as full while its worker is released. Added `releaseContracts(takenSet, cleared)`; `match` now reads the post-validation set. Amends AC5 (documented inline above).

**Verification gaps closed — the substance of the review.** Four regressions were silent against the original suite. Each is now caught, confirmed by re-running the mutation after the fix:

| Mutation | Before | After |
| --- | --- | --- |
| `metering.ts` metered branch returns `undefined` | 84/84 pass | 3 fail |
| `hasCapacity` Infinity Job id realigned to `maxWorkers: 1` | 84/84 pass | 1 fail |
| `main.ts` Contract filter inverted | 84/84 pass | 4 fail |
| `releaseContracts` call dropped from `main.ts` | n/a | 1 fail |

The Infinity test was vacuous: `buildJob` hardcoded `targetId: "spawn1"`, so the Job id never matched the `upgrade:controller1` Contracts and the measured count was 0. `buildJob` now takes a `targetId`. The "read-only map" test I added asserted `instanceof Map` and duplicated its neighbour; it now asserts `Object.isFrozen` and that replacing `entries` throws.

**Other patches:** froze the `TakenSet` wrapper (JSDoc is now honest that `ReadonlyMap` is compile-time only); replaced the `as string` cast with a narrowing loop that also removes two per-Tick array allocations from a CPU-metered path; corrected the `taken.ts` module JSDoc, which described the caller's behavior; added an `afterEach` restore for module-namespace spies that would otherwise leak into the tests added after them; added `loop()`-level tests for AC2, AC3, and AC4; added `hasCapacity` boundary tests (`maxWorkers: 0`, over-subscribed) and a caller-array-immutability test; added a warning when the snapshot is missing instead of silently reading every Job as open.

**Notable dismissal:** one layer's headline finding was to move the snapshot reading out of `main.ts` into `control/taken.ts`, citing this story's own Dev Notes and AC6. Rejected — AD-9 states verbatim that the taken-set "is derived in `main.ts` during the cycle". The code was right and the story prose was wrong; AC6 has been amended instead.

Tests: 84 → 96 (one file deleted, 13 tests added). Typecheck, lint, and build all clean.

### File List

- `src/control/taken.ts`
- `src/control/metering.ts`
- `src/control/spawn.ts`
- `src/control/validate.ts`
- `src/control/match.ts`
- `src/main.ts`
- `test/control/taken.test.ts`
- `test/control-cycle.test.ts`
- `test/metering.test.ts`
- `test/control/spawn.test.ts` *(created, then deleted in review — seam withdrawn)*

## References

- [Source: epics.md L300–315] — Story 3.2 ACs: taken-set derivation from all Creeps' Contracts including Spawning
- [Source: prd.md FR-5] — Capacity-limited availability
- [Source: prd.md FR-16] — Reserved-slot spawning
- [Source: prd.md FR-29] — Reserved mine slot policy (Specialist era)
- [Source: ARCHITECTURE-SPINE.md AD-2] — Write ownership
- [Source: ARCHITECTURE-SPINE.md AD-5] — Zero colony-level persistence
- [Source: ARCHITECTURE-SPINE.md AD-9] — Control-cycle order and taken-set derivation
- [Source: ARCHITECTURE-SPINE.md L102] — Job schema including `maxWorkers`
- [Source: _bmad-output/implementation-artifacts/3-1-contract-memory-schema.md] — Previous story: Contract schema and accessors
- [Source: src/state/contract.ts] — `ContractState` type and accessors
- [Source: src/world/snapshot.ts] — `WorldSnapshot` and `SnapshotCreep.contract`
- [Source: src/board/registry.ts] — `findJob(id)` helper
- [Source: src/board/job.ts] — `JobId`, `Job`, `JobInput`
- [Source: src/control/metering.ts] — `measurePhase` to be made generic
- [Source: src/main.ts] — AD-9 control cycle

## Change Log

- **2026-08-13:** Story created (ready-for-dev).
- **2026-08-13:** Implementation complete — taken-set wired through `main.ts`, `validate`/`match` accept `TakenSet`, `measurePhase` made generic, control-cycle wiring test bug fixed. All tasks/ACs satisfied; status → review.
- **2026-08-13:** Code review — 15 patches applied, 3 items deferred, 7 dismissed. Spawn seam withdrawn (T3) and `validate` now returns cleared Contracts, amending AC3, AC5, and AC6. Four silent regressions are now caught by tests. 96 tests pass; typecheck, lint, build clean.


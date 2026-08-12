---
baseline_commit: 650898926b8733435d5ab491d19c0a22915ffcf8
---

# Story 2.2: Job & Contract Types + Per-Tick Board Registry

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the operator,
I want the Job and Contract types and the Board registry in `board/`,
So that work has one canonical, freshly-derived representation every Tick (FR-3, FR-4, AD-3).

**Epic 2 — The Job Board (the Colony Sees Its Work).** Story 2.1 laid the AD-10 world-read seam
(`GameAdapter` extension + plain-data `WorldSnapshot` built once per Tick in `generate.ts`).
Story 2.2 adds the Board itself: the canonical `Job` type with its full schema, the
`type:targetId` id grammar, the `Contract` type stored in `creep.memory.contract`, and the
per-Tick registry that Producers (Story 2.3) fill and Matching/Spawn (Epic 3) read.
The registry is rebuilt from scratch every Tick — no Job object survives across Ticks (AD-3).
Story 2.3 will add Producers that emit Jobs from the snapshot; Story 2.4 adds the distance
service and `[board]` logging. Do **not** implement Producers, Matching, behaviors, or
distance service in this story. [Source: epics.md L228–242; ARCHITECTURE-SPINE.md AD-1–AD-10]

## Acceptance Criteria

1. **Full Job schema (AC1)** — Given the type definitions, when a `Job` is created, then it
   carries the complete schema `{ id, type, targetId, pos, tier, withinTierPriority, maxWorkers,
   assignmentMode, lifetimeClass, requirements { body, ttlFloor } }` — every field typed, no
   optional fields on the core shape. [AC: epics.md L238; ARCHITECTURE-SPINE.md Consistency Conventions]

2. **Deterministic Job ids (AC2)** — Given the id helpers, when `makeJobId` and `parseJobId`
   are called for every `JobType` (`mine`, `fill`, `build`, `upgrade`), then ids follow the
   `type:targetId` grammar and round-trip losslessly. A malformed id (no colon) throws. The
   grammar splits on the **first** colon only so target ids containing colons still parse.
   [AC: epics.md L239; AD-4]

3. **Per-Tick Board rebuild (AC3)** — Given the Board registry on two consecutive Ticks, when
   the second Tick begins, then the registry is rebuilt from scratch — every Job from the
   previous Tick is gone, with no explicit removal code. `getBoard()` returns `undefined`
   before the first `resetBoard()` and returns an empty board after `resetBoard()`.
   [AC: epics.md L240–242; AD-3, AD-9]

## Tasks / Subtasks

- [x] **T1 — Define Job types + id grammar in `src/board/job.ts` (AC1, AC2)**
  - [x] Export string-union types (not runtime enums — Consistency Conventions):
    - `JobType = "mine" | "fill" | "build" | "upgrade"`
    - `PriorityTier = "critical" | "high" | "medium" | "low"`
    - `AssignmentMode = "reserved" | "pulled"`
    - `LifetimeClass = "persistent" | "transient"`
    - `JobId = string` (branded alias for `type:targetId`)
  - [x] Export `JobRequirements { body: BodyPartConstant[]; ttlFloor: number }`
    - `body` is a `BodyPartConstant[]` — global type from `@types/screeps@3.4.0` (no import needed; tsconfig `types: ["screeps"]`)
    - `ttlFloor` is a `number` — the minimum TTL a Creep must have to be offered this Job (FR-4, FR-12)
  - [x] Export `Job` interface matching exact field order from ARCHITECTURE-SPINE.md L102:
    `id, type, targetId, pos, tier, withinTierPriority, maxWorkers, assignmentMode, lifetimeClass, requirements { body, ttlFloor }`
    - `pos` is `RoomPositionData` — reused from `src/game.ts` (defined Story 2.1)
  - [x] Implement `makeJobId(type: JobType, targetId: string): JobId` — returns template string `${type}:${targetId}`
  - [x] Implement `parseJobId(id: JobId): { type: JobType; targetId: string }` — split on first colon; throw on missing colon
  - [x] Implement `makeJob(input: JobInput): Job` factory — computes `id` via `makeJobId`, spreads input
  - [x] Export `JobInput` interface (all Job fields except `id`) for Producer ergonomics
- [x] **T2 — Define Contract type in `src/board/contract.ts` (FR-8, AD-4)**
  - [x] `export type Contract = JobId` — AD-4: Contract IS the jobId string
  - [x] This aligns with the global `CreepMemory.contract?: string` augmentation already in
    `src/game.ts` (L9–13, added Story 2.1)
  - [x] No runtime logic — pure type alias

- [x] **T3 — Implement Board registry in `src/board/registry.ts` (AC3, AD-3)**
  - [x] Export `Board` interface: `readonly jobs: readonly Job[]` (readonly to consumers;
    producers push via internal mutable array — see snapshot.ts pattern)
  - [x] Module-level state: `let jobs: Job[]` and `let currentBoard: Board | undefined`
  - [x] Implement `resetBoard(): void` — creates a fresh empty board, replaces all module state
    (AD-3: rebuild from scratch, never mutate in place across Ticks)
  - [x] Implement `addJob(job: Job): void` — pushes to the internal array; throws if board not
    initialized (defensive — catches a Producer calling before `resetBoard`)
  - [x] Implement `getBoard(): Board | undefined` — returns current board or `undefined`
  - [x] Implement `findJob(id: JobId): Job | undefined` — convenience lookup used later by
    validators (Story 3.1+) and Matching (Story 3.4)
  - [x] Publish empty board immediately in `resetBoard` (mirrors snapshot.ts stale-state guard)

- [x] **T4 — Wire `resetBoard()` into `generate()` at AD-9 position (AD-3, AD-9)**
  - [x] Modify `src/control/generate.ts` — import `resetBoard` from `../board/registry`
  - [x] Call `resetBoard()` at the start of `generate()`, before any Producer would add jobs
    (Producers arrive in Story 2.3; for now the Board is reset to empty each Tick)
  - [x] Do **not** reorder the existing `buildWorldSnapshot()` call — it runs in the same phase
  - [x] Do **not** add Board logging here (Story 2.4 adds `[board]` logs)

- [x] **T5 — Write vitest suites (AC2, AC3)**
  - [x] Create `test/board/job.test.ts`:
    - Round-trip `makeJobId` → `parseJobId` for every `JobType`
    - `parseJobId` throws on id with no colon
    - `parseJobId` splits on first colon only (target containing `:` still valid)
    - `makeJob` sets `id` to `makeJobId(type, targetId)` and preserves all other fields
    - [x] Create `test/board/registry.test.ts`:
    - [x] `getBoard()` returns `undefined` before any `resetBoard()`
    - [x] `resetBoard()` → empty board (jobs length 0)
    - [x] `addJob()` appends to the board
    - [x] **Per-Tick rebuild (AC3):** add jobs in Tick 1, call `resetBoard()` for Tick 2, assert
      the Tick 2 board has zero jobs (no survival from Tick 1)
    - [x] `findJob()` returns the correct job by id
    - [x] `addJob()` throws if board not initialized

- [x] **T6 — Verify all gates green**
  - [x] `npm run typecheck` (tsc --noEmit, TS 7.0.2 strict)
  - [x] `npm run lint` (biome check src test scripts)
  - [x] `npm run test` (vitest run — all existing + new tests pass)
  - [x] `npm run build` (esbuild — bundle still produces dist/main.js)
  - [x] AD-10 sanity: no `Game.` / `FIND_` / `getObjectById` / `look` calls in `src/board/`

## Dev Notes

### Previous Story Learnings (Story 2.1 — World Snapshot & Game-Read Seam)

Story 2.1 is the direct predecessor. Lessons that apply to 2.2:

- **GameAdapter pattern** (`src/game.ts`): `getGame()` / `setGame()` injection. Tests build a
  `createMockGame()` fake implementing `GameAdapter` and inject via `setGame()`. The Board types
  need **no Game mock** — pure TypeScript. Reuse `RoomPositionData` from `game.ts`, do not redefine.
- **Module-level mutable state + getter pattern** (`src/world/snapshot.ts`): `let currentSnapshot`,
  `getCurrentSnapshot()`, `buildWorldSnapshot()` writer. Board registry mirrors this:
  `let currentBoard`, `getBoard()` getter, `resetBoard()`/`addJob()` mutators.
- **Stale-state guard**: snapshot.ts publishes the empty snapshot *before* adapter reads so a throw
  mid-build never leaves stale data. Apply same: `resetBoard()` sets `currentBoard` to an empty
  board *before* any state mutation.
- **Readonly arrays**: `WorldSnapshot` uses `readonly SnapshotStructure[]`. Board's `jobs` must also
  be `readonly` to consumers — push through an internal mutable array only.
- **Test pattern** (`test/world/snapshot.test.ts`): `beforeEach(() => setGame())`,
  `createMockGame()` returning a full `GameAdapter`. For board tests, no Game mock needed —
  plain data only. Registry module-level `let` state must be reset in `beforeEach`.
- **AD-10 enforcement**: 2.1 verified via grep — no Game read calls outside `world/` and `game.ts`.
  Story 2.2 must grep `src/board/` for zero `Game.`, `FIND_`, `getObjectById`, `look`.
- **Review learnings**: 6 patch findings applied in 2.1 (stale guard, readonly arrays, test
  cleanups, type alignment, constant removal). Carry forward by default.

### Architecture Compliance (AD-1..AD-10 are binding)

- **AD-1 (blackboard roles)**: `board/` is a role directory. Board types + registry live *only*
  in `board/`. Producers in `world/producers/` write via `addJob()`; `control/` and `agents/` read
  via `getBoard()`. No Board logic in `world/` or `control/`.
- **AD-2 (writes owned)**: Only `world/` (via Producers) writes the Board. `board/` exposes the
  registry API; does not read Game state. Only `control/` sets Contracts (Story 3.1); `board/`
  defines the Contract *type* only.
- **AD-3 (per-Tick derived)**: Board is recomputed every Tick, never persisted. `resetBoard()`
  discards everything — do **not** mutate jobs in place across Ticks; do **not** write to `Memory`
  or `global`.
- **AD-4 (Contract grammar)**: `Contract = jobId string`, grammar `type:targetId`. `makeJobId`/
  `parseJobId` enforce this. Validators (Story 3.1) parse this same grammar.
- **AD-5 (zero colony persistence)**: No `Memory` keys set in `board/`. No `global` caching.
- **AD-9 (control-cycle order)**: `resetBoard()` called in `generate()`, the first phase. Producers
  (Story 2.3) add jobs after the reset. `main.ts` order unchanged: generate → taken-set → validate
  → match → spawn.
- **AD-10 (Game reads only through world/)**: `board/` contains zero Game API calls.

### Library & Framework Requirements

- **TypeScript 7.0.2** (strict, `moduleResolution: Bundler`). String-union types, `readonly`
  arrays, type-only imports (`import type { ... }`).
- **vitest 4.1.10** — `describe`, `it`, `expect`, `beforeEach`.
- **@types/screeps@3.4.0** — `BodyPartConstant` is a **global** type (tsconfig `types: ["screeps"]`).
  No import needed.
- **esbuild 0.28.1** — Board must be reachable from `main.ts` via `generate()` import.
- **biome 2.5.7** — `npm run lint`. 2-space indent, double quotes, no semicolons.

### File Structure Requirements

No `index.ts` barrel files in `src/` — direct file imports only:

- **NEW** `src/board/job.ts` — Job types + id helpers (JobType, PriorityTier, AssignmentMode,
  LifetimeClass, JobId, JobRequirements, Job, JobInput, makeJobId, parseJobId, makeJob)
- **NEW** `src/board/contract.ts` — `Contract` type alias
- **NEW** `src/board/registry.ts` — Board interface + registry state (resetBoard, addJob,
  getBoard, findJob)
- **MOD** `src/control/generate.ts` — import + call `resetBoard()`
- **NEW** `test/board/job.test.ts` — id grammar round-trip + makeJob
- **NEW** `test/board/registry.test.ts` — per-Tick rebuild + registry API

Do **not** modify `src/game.ts`, `src/world/snapshot.ts`, or `src/config.ts` in this story.

### config.ts Policy Note

Story 2.2 defines **type names and grammar only**. Policy *values* (tier assignments, maxWorkers,
Reserved-vs-Pulled, Body compositions, TTL floors) are pinned in `config.ts` by Story 2.3. Do not
add policy values to `config.ts` here. The `makeJob` factory accepts all values as explicit
parameters so Producers (Story 2.3) supply them from the policy table.

### Testing Standards

- **Plain-data tests**: Board types/ids need no Game mock. Construct `Job` objects as literal
  plain data (cf. `WorldSnapshot as plain data` test in snapshot.test.ts).
- **Module isolation**: Registry uses module-level `let` state. Reset in `beforeEach` to avoid
  cross-test contamination.
- **AD-10 gate**: Grep `src/board/` for `Game\.`, `FIND_`, `getObjectById`, `look` — expect zero.
- **Round-trip coverage**: `makeJobId`/`parseJobId` tested for **all four** JobTypes.

### Logging Convention

The logging convention is `console` only, prefixed by module (`[board] …` etc.). Story 2.2 adds
**no logging** — the `[board]` log line reporting open Jobs per Tick arrives in Story 2.4
(epics.md L263–280). Do not add console.log calls in this story.

## Dev Agent Record

### Agent Model Used

Cline `bm-dev` profile (per `.clinerules` model routing for dev-story/dev-auto).

### Debug Log References

- `npx tsc --noEmit` → exit 0 (no errors)
- `npx biome check src test scripts Gruntfile.js` → 0 errors, 0 warnings
- `npx vitest run` → 31/31 tests pass (14 job + 7 registry + 10 pre-existing)
- `npm run build` → `dist/main.js` produced (5.8kb)
- AD-10 grep: `grep -rn "Game" src/board/` → 0 actual Game API calls (only comment text)

### Completion Notes List

1. **T1 (job.ts):** Implemented all string-union types (`JobType`, `PriorityTier`, `AssignmentMode`, `LifetimeClass`, `JobId`), `JobRequirements`, `Job`, `JobInput` interfaces, and factory functions `makeJobId`/`parseJobId`/`makeJob`. `pos` reuses `RoomPositionData` from `src/game.ts`. `parseJobId` splits on first colon only via `indexOf(separator)`. `makeJob` computes `id` via `makeJobId` for determinism (FR-3).
2. **T2 (contract.ts):** Single `export type Contract = JobId` alias — aligns with `CreepMemory.contract` augmentation in `game.ts`. Pure type, zero runtime.
3. **T3 (registry.ts):** Mirrors `src/world/snapshot.ts` module-state + getter pattern. `let jobs: Job[]` + `let currentBoard: Board | undefined`. `resetBoard()` publishes empty board immediately (stale-state guard). `addJob()` throws if uninitialized. `getBoard()` returns current or undefined. `findJob()` convenience lookup. `Board.jobs` is `readonly` to consumers.
4. **T4 (generate.ts):** Added `resetBoard()` import + call at start of `generate()`, before `buildWorldSnapshot()`. Board reset to empty each Tick (Producers fill in Story 2.3).
5. **T5 (tests):** 14 tests in `job.test.ts` (round-trip for all 4 JobTypes, throws on malformed id, split-on-first-colon, makeJob field preservation). 7 tests in `registry.test.ts` (undefined before reset, empty after reset, addJob appends, per-Tick rebuild AC3, findJob lookup, addJob throws if uninitialized).
6. **Lint fixes:** Replaced all `getBoard()!.jobs` non-null assertions in `registry.test.ts` with optional chaining `getBoard()?.jobs` (biome `--unsafe` applied). Auto-sorted imports. Reformatted `parseJobId` throw to single line.
7. **No regressions:** All 10 pre-existing tests pass unchanged.

### File List

- `src/board/job.ts` (NEW) — Job types, JobId grammar, makeJobId/parseJobId/makeJob
- `src/board/contract.ts` (NEW) — Contract type alias (= JobId)
- `src/board/registry.ts` (NEW) — Board registry: resetBoard, addJob, getBoard, findJob
- `src/control/generate.ts` (MODIFIED) — added `resetBoard()` call at AD-9 position
- `test/board/job.test.ts` (NEW) — 14 tests for Job types + id helpers (AC1, AC2)
- `test/board/registry.test.ts` (NEW) — 7 tests for Board registry (AC3)

### Change Log

- **2026-08-12:** Created `src/board/job.ts`, `src/board/contract.ts`, `src/board/registry.ts` — canonical Job/Contract types + per-Tick Board registry (AC1, AC2, AC3). Wired `resetBoard()` into `generate()` at AD-9 position. Added 21 vitest tests covering all three acceptance criteria. Typecheck clean, lint clean, build produces dist/main.js, AD-10 verified.
- **2026-08-12 (code review):** Applied 2 patches — (1) `parseJobId` now validates the `type` union member + non-empty `targetId` (throwing on invalid names), with 3 new tests (17 total in `job.test.ts`); (2) retyped test helper `fullInput` to `JobInput`. All gates green: typecheck 0, lint 0, 34/34 tests. 1 finding deferred to Story 2.3 (addJob tick-staleness guard).

### Review Findings

- [x] [Review][Patch] `parseJobId` does not validate the `type` member of the union — the `as JobType` cast silently accepts arbitrary strings (e.g. `"bogus:123"` → type `"bogus"`, `":foo"` → empty type) [src/board/job.ts:83]
- [x] [Review][Patch] Test helper `fullInput` returns `any` (`ConstructorParameters<typeof Object>[0]`), so `makeJob` tests do not type-check the input shape [test/board/job.test.ts:62-64]
- [x] [Review][Defer] `addJob` uninitialized guard only catches the first-Tick case; a later missed `resetBoard()` silently serves stale Board data rather than throwing [src/board/registry.ts:39-46] — deferred, pre-existing until Producers land in Story 2.3

## References

- [Source: _bmad-output/planning-artifacts/epics.md L228–242] — Epic 2, Story 2.2 requirements and ACs
- [Source: epics.md L115–139] — Epic 2 overview (The Job Board)
- [Source: ARCHITECTURE-SPINE.md L30–95] — AD-1..AD-10 (all binding); Board = per-Tick derived
  projection (AD-3); world writes board (AD-1/AD-2); Contract = jobId string (AD-4)
- [Source: ARCHITECTURE-SPINE.md L97–108] — Consistency Conventions: Job ids `type:targetId`, string
  unions not enum, `config.ts` owns tunables, console-only prefixed logging
- [Source: ARCHITECTURE-SPINE.md L102] — Exact Job data format: `Job = { id, type, targetId, pos,
  tier, withinTierPriority, maxWorkers, assignmentMode, lifetimeClass, requirements { body,
  ttlFloor } }`
- [Source: ARCHITECTURE-SPINE.md L124–145] — Structural Seed: `board/` holds Job + Contract types
- [Source: ARCHITECTURE-SPINE.md L151–161] — Capability map: §4.1 Job Board → `world/producers +
  board/` (AD-1, AD-2, AD-3, AD-10); §4.3 Matching → `control/matching`
- [Source: prd.md L56–67] — Glossary: Job, Contract, Producer, Priority Tier, Reserved/Pulled
- [Source: prd.md L78–112] — FR-1 (Per-Tick regeneration), FR-2 (Independent Producers), FR-3
  (Deterministic identity), FR-4 (Complete Job metadata), FR-5 (Capacity-limited availability)
- [Source: prd.md L143–149] — FR-8 (Contract persistence in creep memory)
- [Source: prd.md L283–285] — FR-22: tier assignments (fill=critical, build=medium,
  upgrade=low) — policy table values, pinned in Story 2.3
- [Source: 2-1-world-snapshot-game-read-seam.md] — predecessor story: GameAdapter seam, WorldSnapshot
  pattern, test injection, AD-10 enforcement
- [Source: src/game.ts] — `RoomPositionData`, `CreepMemory.contract` augmentation
- [Source: src/world/snapshot.ts] — module-level mutable state + getter pattern to mirror
- [Source: src/world/snapshot.test.ts] — test patterns: `createMockGame()`, `setGame()`,
  plain-data construction, `beforeEach` reset
- [Source: src/control/generate.ts] — AD-9 generate phase, currently calls `buildWorldSnapshot()`
- [Source: src/main.ts] — AD-9 control cycle: generate → taken-set → validate → match → spawn
- [Source: src/config.ts] — MVP constants pattern (policy table added in Story 2.3, not here)
- [Source: reconcile-prd.md L16–20] — FR-1..FR-4 module homes: `maxWorkers` values homeless
  (Gap G3) — pinned in Story 2.3 policy table
- [Source: review-diff-2.1.txt] — Story 2.1 implementation diff; snapshot/buildWorldSnapshot
  wiring and test patterns to follow

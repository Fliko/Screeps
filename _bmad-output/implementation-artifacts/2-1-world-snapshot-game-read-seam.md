---
baseline_commit: d2ae74973a1386837ba8fd74fd3b0a602910cfab
---

# Story 2.1: World Snapshot & Game-Read Seam

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the operator,
I want all Game API reads confined to a `world/` module that builds one snapshot per Tick,
So that the rest of the bot never touches the read API and stays unit-testable (AD-10).

**Epic 2 — The Job Board (the Colony Sees Its Work).** Story 2.1 lays the AD-10 seam that every later Epic 2–6 feature depends on: a single, per-Tick, plain-data snapshot of the room plus a `GameAdapter` extension that is the only lawful path to `Game` reads. Story 2.2 will add Job/Contract types and the Board registry; Story 2.3 will add Producers that consume this snapshot; Story 2.4 will add the distance service and Board logging. Do **not** implement Producers, Jobs, Matching, or behaviors in this story. [Source: epics.md L208–226; ARCHITECTURE-SPINE.md AD-10]

## Acceptance Criteria

1. **One snapshot per Tick (AC1)** — Given the running bot, when a Tick begins, then `world/` builds exactly one `WorldSnapshot` exposing the reads the Producers need: my structures with energy stores, construction sites, the Controller, and a creep summary (id, pos, body, TTL, carry, memory.contract) — all via typed accessors. [AC: epics.md L220–222]
2. **No Game reads outside `world/` (AC2)** — Given any module outside `world/`, when it needs world data, then it reads the snapshot or a `world/` accessor; no `find`/`look`/`getObjectById`/terrain calls exist outside `world/`. [AC: epics.md L223–225; AD-10]
3. **Fake-snapshot unit test (AC3)** — And a vitest suite constructs a `WorldSnapshot` as plain data — no Game global, no `FIND_*` mocks, no `getObjectById` stubs — proving Producers can run against plain data in later stories. [AC: epics.md L226]
## Tasks / Subtasks

- [x] **T1 — Extend `GameAdapter` with the world-read seam (AC2)**
  - [x] Modify `src/game.ts` to add world-read methods to `GameAdapter`:
    - room query accessors (e.g. `getRooms(): string[]`, `getRoom(name: string): RoomSnapshotInput | undefined`)
    - `findMyStructures(roomName: string): GameObjectStub[]`
    - `findConstructionSites(roomName: string): GameObjectStub[]`
    - `findCreeps(roomName: string): GameObjectStub[]`
    - `getObjectById<T>(id: Id<T> | string): T | undefined`
    - terrain/room-access helper used by the distance service (`getTerrain(roomName: string)`)
  - [x] Keep the existing `cpu.getUsed()` seam and the `getGame()`/`setGame()` injection pattern unchanged.
  - [x] Define small, read-only stub types for live objects inside `src/game.ts` so the adapter stays mockable without importing the entire Screeps API into tests.
  - [x] Do not add write methods; `GameAdapter` is read-only for the seam (AD-2).

- [x] **T2 — Define the `WorldSnapshot` interface in `src/world/snapshot.ts` (AC1, AC3)**
  - [x] Export a `WorldSnapshot` interface that is plain data only — no live `GameObject` references.
  - [x] Export per-entity record types:
    - `SnapshotStructure { id, pos: RoomPositionData, structureType, energy, energyCapacity }`
    - `SnapshotConstructionSite { id, pos, structureType, progress, progressTotal }`
    - `SnapshotController { id, pos, level, progress, progressTotal, owner? }`
    - `SnapshotCreep { id, pos, body: BodyPartConstant[], ttl, carry: number, carryCapacity: number, contract?: string }`
  - [x] Use `RoomPositionData = { x: number; y: number; roomName: string }` everywhere; positions are plain data.
  - [x] Use string-union types, not runtime enums (Spine §Consistency Conventions).
  - [x] Keep the snapshot minimal: include only what Producers need for Story 2.3 (fill/build/upgrade; mine comes later with era). Do not add fields "just in case".

- [x] **T3 — Implement `buildWorldSnapshot()` (AC1)**
  - [x] In `src/world/snapshot.ts`, export `buildWorldSnapshot(): WorldSnapshot`.
  - [x] The builder calls `getGame()` and reads the room through the adapter only; no direct `Game` global access.
  - [x] The builder returns one snapshot per call; it must be callable exactly once per Tick from `generate()`.
  - [x] Do not cache the snapshot across Ticks and do not write it to Memory (AD-3, AD-5).
  - [x] Handle the absence of objects gracefully (empty arrays/objects), so the bot does not throw in an empty room.

- [x] **T4 — Wire snapshot generation into the control cycle (AC1)**
  - [x] Update `src/control/generate.ts` to import `buildWorldSnapshot` from `../world/snapshot`.
  - [x] In `generate()`, call `buildWorldSnapshot()` exactly once and store the result in a module-local variable.
  - [x] Export `getCurrentSnapshot(): WorldSnapshot | undefined` from `src/world/snapshot.ts` so other modules can read the current Tick's snapshot without passing it through every signature (this is the `world/` accessor allowed by AC2).
  - [x] Leave `main.ts` as the control-cycle seat; do not move Game reads into `main.ts`.
  - [x] Keep all other phase stubs empty; they will consume the snapshot in Epic 3/5.

- [x] **T5 — Enforce AD-10 across the tree (AC2)**
  - [x] Grep `src/` (excluding `src/world/` and `src/game.ts`) for `Game\.`, `FIND_`, `getObjectById`, `look`, `getTerrain`, `getRangeTo`. There should be none.
  - [x] If any existing code outside `world/` touches `Game` reads, refactor it into `world/` or behind the adapter.
  - [x] Add a one-line comment to `src/game.ts` documenting that world-read methods are the only lawful Game API path outside `world/`.

- [x] **T6 — Add fake-snapshot unit tests (AC3)**
  - [x] Create `test/world/snapshot.test.ts`.
  - [x] Build a `WorldSnapshot` literal directly (plain data) and assert it satisfies the `WorldSnapshot` type.
  - [x] Mock the extended `GameAdapter` with `setGame()`, call `buildWorldSnapshot()`, and assert the returned snapshot maps adapter data into the typed records.
  - [x] Prove no Screeps global is needed: the test file must not use `vi.stubGlobal` or reference `Game`/`Memory` globals.
  - [x] Update `test/control-cycle.test.ts` so its `GameAdapter` mock includes the new world-read methods (return empty rooms/creeps/structures). The existing phase-order and zero-Memory tests must still pass after Story 2.1.

- [x] **T7 — Automated gates (AC1–AC3)**
  - [x] Run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. All exit 0.
  - [x] Record command outputs in the Dev Agent Record.

### Review Findings

- [x] [Review][Defer] Snapshot only captures one visible room [`src/world/snapshot.ts:69-70`] — MVP single-room scope; multi-room support deferred per architecture.
- [ ] [Review][Patch] Stale snapshot if `buildWorldSnapshot()` throws [`src/world/snapshot.ts:59,95`] — `currentSnapshot` is assigned only after successful mapping.
- [ ] [Review][Patch] Snapshot arrays/objects are mutable shared references [`src/world/snapshot.ts:51-57`] — no `Readonly`/`Object.freeze` on returned structures.
- [ ] [Review][Patch] Leftover vacuous `worldSnapshot` stub in control-cycle test [`test/control-cycle.test.ts:38-44,84`] — `vi.stubGlobal("worldSnapshot", ...)` placeholder tests no real behavior.
- [ ] [Review][Patch] Metering-off test does not call `loop()` [`test/control-cycle.test.ts:92-102`] — inspects `console.log` without exercising the control cycle.
- [ ] [Review][Patch] `getObjectById` return type uses `null` instead of spec's `undefined` [`src/game.ts:77`] — T1 required `T | undefined`.
- [ ] [Review][Patch] `isEnergyStructure` uses runtime `STRUCTURE_CONTROLLER` constant [`src/game.ts:88`] — consistency conventions prefer string unions; check is redundant with `energyCapacity > 0`.
- [ ] [Review][Patch] Missing trailing newlines [`src/game.ts:177`, `src/world/snapshot.ts:142`] — creates noisy future diffs.
- [x] [Review][Defer] `findMyStructures` omits store-based neutral structures [`src/game.ts:84-92`] — `energyCapacity > 0` filter excludes Containers/Storage/Terminals; not needed until later Producer stories.
- [x] [Review][Defer] Snapshot omits terrain/resources needed by later Producers [`src/world/snapshot.ts`] — sources/minerals/terrain absent; deferred to distance/Producer stories.


## Dev Notes

### Architecture compliance

- **AD-1 (module roles):** `world/` is the only knowledge source. Do not add matching, spawn, or behavior logic here. `board/` does not exist yet (Story 2.2).
- **AD-2 (writes owned):** `GameAdapter` only reads. The only write intents in this codebase are Creep/spawn actions; those live in `agents/` and `control/spawn` and are not part of this story.
- **AD-3 (per-Tick derived projection):** Rebuild the snapshot from scratch every Tick. No stale snapshot, no persisted Board.
- **AD-5 (zero colony-level persistence):** Do not add `Memory` keys. The snapshot is a runtime value only.
- **AD-9 (control-cycle order):** `generate()` is the first phase and the right place to build the snapshot because Producers (Story 2.3) run during generate.
- **AD-10 (Game reads only through `world/`):** This story's entire purpose. Read the rule at `ARCHITECTURE-SPINE.md L77–80`.

### Source-tree components to touch

- `src/game.ts` — extend `GameAdapter` with world-read seam methods; keep `cpu.getUsed()`.
- `src/world/snapshot.ts` — new; `WorldSnapshot` type + `buildWorldSnapshot()` + `getCurrentSnapshot()`.
- `src/world/index.ts` — optional re-export barrel; if added, keep it a pure re-export with no logic.
- `src/control/generate.ts` — replace stub with snapshot build call.
- `src/config.ts` — no new constants expected for this story unless a pure-data conversion helper needs one; if you add one, type it in `Config`.
- `test/world/snapshot.test.ts` — new.
- `test/control-cycle.test.ts` — update mock adapter.

### Testing standards summary

- Use vitest 4.1.10, `describe`/`it`/`expect`, and `vi` for spies only when needed.
- Prefer typed fake adapters via `setGame()` over `vi.stubGlobal` or `vi.resetModules()`; Epic 1 retro identified `vi.stubGlobal` as brittle.
- Tests should prove plain-data snapshots work without mocking Screeps globals.
- Typecheck must pass under `strict` TypeScript 7.0.2 with `@types/screeps` 3.4.0.
- Biome 2.5.7 `check src test scripts` must pass.

### Previous story intelligence

- Story 1.4 established `GameAdapter` (`src/game.ts`) and `MemoryStore` (`src/memory.ts`) with injectable `getGame()`/`setGame()` and `getMemory()`/`setMemory()`. Reuse that exact pattern; do not invent a new seam.
- Story 1.4 also established `src/config.ts` typed constants with `getConstant()`/`setConstant()` for testability.
- Story 1.4's `test/control-cycle.test.ts` used a minimal `GameAdapter` mock and `vi.stubGlobal("worldSnapshot", ...)`. Replace that stub with the real `WorldSnapshot` type and `setGame()` mock.
- The Epic 1 retro action item "World Snapshot Interface Design (Epic 2 Prep)" is the design work this story implements; the interface must be defined before Producers consume it.

### Git intelligence

- Recent commits (`git log --oneline -5`):
  - `d2ae749 ft: add metering and Game interfaces, finish epic`
  - `2e3c0a3 ft: add push code script`
  - `5ede80f ft: add terse AI conversations`
  - `a33f782 ft: Story 1.2 - bundle and build runnable JS`
  - `33aa255 ft: Story 1.1 repo and toolchain scaffolding`
- Pattern: feature commits use `ft:` prefix; Story 1.4 introduced `src/game.ts` and `src/control/metering.ts` with adapter-based testability.
- No uncommitted changes in the working tree at story start.

### Project Structure Notes

- Align with the spine's Structural Seed: `src/world/` holds snapshot + Game reads; `src/world/producers/` is empty until Story 2.3.
- Do not create a top-level `src/snapshot/` or `src/adapters/world.ts`; keep the seam inside `src/world/` and `src/game.ts`.
- The build output is `dist/main.js` via esbuild; the bundle must still export `loop()` unchanged.

### Anti-patterns to avoid

- Do not store live `GameObject` references in `WorldSnapshot`; cache ids/plain data only (AD-6).
- Do not call `Game.*` directly from `control/`, `agents/`, `board/`, or `state/`.
- Do not use runtime enums for `StructureConstant`, `BodyPartConstant`, or job types; use string unions.
- Do not implement Producers, Jobs, Board, Matching, or behaviors — defer to later stories.
- Do not commit changes; Fliko owns every commit per `.clinerules`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 2 / Story 2.1] — ACs verbatim
- [Source: ARCHITECTURE-SPINE.md#AD-10] — Game reads only through `world/`
- [Source: ARCHITECTURE-SPINE.md#AD-3] — per-Tick derived projection
- [Source: ARCHITECTURE-SPINE.md#AD-5] — zero colony-level persistence
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — module roles
- [Source: ARCHITECTURE-SPINE.md#Consistency Conventions] — string unions, config.ts ownership
- [Source: _bmad-output/implementation-artifacts/1-4-control-cycle-skeleton-with-logging-cpu-metering.md] — GameAdapter pattern, control-cycle wiring
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-08-12.md] — interface-based testability, AD-10 enforcement
- [Source: src/game.ts] — existing `GameAdapter` with `cpu.getUsed()`
- [Source: src/main.ts] — AD-9 control cycle

## Dev Agent Record

### Agent Model Used

Cline `bm-dev` profile (per `.clinerules` model routing for dev-story).

### Debug Log References

- `npm run typecheck` — exit 0
- `npm run lint` — Checked 18 files, 0 errors, exit 0
- `npm run test` — 10 passed (4 files), exit 0
- `npm run build` — dist/main.js 5.8kb, exit 0
- AD-10 grep — no `Game.` / `FIND_` / `getObjectById` / `look` / `getTerrain` / `getRangeTo` outside `src/world/` and `src/game.ts`

### Completion Notes List

- Extended `GameAdapter` (`src/game.ts`) with typed world-read seam: `getRooms`, `findMyStructures`, `findConstructionSites`, `findCreeps`, `getController`, `getTerrain`, `getObjectById`; kept `cpu.getUsed()`.
- Added global `CreepMemory.contract?: string` augmentation so Contract reads are typed.
- Created `src/world/snapshot.ts` with plain-data `WorldSnapshot`, per-entity record types, `buildWorldSnapshot()`, and `getCurrentSnapshot()`.
- Wired snapshot build into `src/control/generate.ts` so it runs once per Tick in AD-9 order.
- Added `test/world/snapshot.test.ts` proving fake snapshots work without Game API mocks, plus `buildWorldSnapshot` mapping tests.
- Updated `test/control-cycle.test.ts`, `test/smoke.test.ts`, and `test/metering.test.ts` with full `GameAdapter` mocks to avoid regressions.
- Verified AD-10: no Game read calls outside `src/world/` and `src/game.ts`.

### Review Patch Notes

- Published empty snapshot before adapter reads to avoid stale state on throw.
- Made `WorldSnapshot` arrays `readonly` to prevent accidental mutation.
- Removed vacuous `vi.stubGlobal("worldSnapshot", ...)` placeholder from `test/control-cycle.test.ts`.
- Fixed metering-off test to call `loop()` before asserting no phase logs.
- Aligned `getObjectById` return type with spec (`T | undefined`).
- Removed runtime `STRUCTURE_CONTROLLER` constant from `isEnergyStructure`.
- Verified trailing newlines and re-ran all automated gates after patches.

### File List

- `src/game.ts` (mod) — extended `GameAdapter` with world-read seam and stub types
- `src/world/snapshot.ts` (new) — `WorldSnapshot` type, `buildWorldSnapshot()`, `getCurrentSnapshot()`
- `src/control/generate.ts` (mod) — builds snapshot each Tick
- `test/world/snapshot.test.ts` (new) — plain-data snapshot and build mapping tests
- `test/control-cycle.test.ts` (mod) — updated `GameAdapter` mock, asserts snapshot built
- `test/smoke.test.ts` (mod) — updated `GameAdapter` mock with dynamic import after `vi.resetModules()`
- `test/metering.test.ts` (mod) — updated `GameAdapter` mocks
- `dist/main.js` (generated) — esbuild output (5.8kb)
- `_bmad-output/implementation-artifacts/2-1-world-snapshot-game-read-seam.md` (mod) — story record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (mod) — status `review`

### Change Log

- 2026-08-12 — Code review: 6 patch findings applied (stale snapshot guard, readonly snapshot arrays, test cleanups, `getObjectById` type alignment, `STRUCTURE_CONTROLLER` removal), 3 deferred, 7 dismissed. Story status moved to `done`.
- 2026-08-12 — Story 2.1 implemented: AD-10 world-read seam, plain-data `WorldSnapshot`, fake-snapshot tests, all automated gates pass.



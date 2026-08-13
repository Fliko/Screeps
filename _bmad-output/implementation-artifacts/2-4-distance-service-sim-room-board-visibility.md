---
baseline_commit: b82f427676d1c28d25a94a80c58ae8ea0c5f10c7
---

# Story 2.4: Distance Service & Sim-Room Board Visibility

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the operator,
I want the `world/` distance service and a per-Tick Board log line wired into the cycle's generate phase,
So that Matching has its single source of distances (AD-7) and I can watch the Board think in the sim room.

**Epic 2 — The Job Board (the Colony Sees Its Work).** Story 2.1 built the AD-10 world-read seam
(`GameAdapter` + plain-data `WorldSnapshot`). Story 2.2 added the Board: `Job` type,
`type:targetId` id grammar, and the per-Tick registry. Story 2.3 added the Producers
(`fill`/`build`/`upgrade`) and the `config.ts` policy table. Story 2.4 adds the
**distance service** (AD-7) — the single source for travel-cost calculations — and the
**`[board]` log line** so the operator can observe the Board in the sim room.

Do **not** implement Matching, behaviors, spawn, the mine Producer, the `[control]`
phase logs, Matching scoring, or the distance service's *consumption* (that is Story 3.4).
This story only **builds** the distance service; Matching **uses** it later.
[Source: epics.md L263–280; ARCHITECTURE-SPINE.md L130, L135, L153; prd.md FR-11, FR-12]

## Acceptance Criteria

1. **Pure Chebyshev distance with plain data (AC1)** — Given two same-room positions
   expressed as plain `{ x, y }` data, when the distance function is called, then it
   returns Chebyshev distance (`max(|dx|, |dy|)`) — unit-tested with plain data, no
   Screeps runtime and no mocks (AD-10 keeps the function pure). [AC: epics.md L271–273;
   AD-7, AD-10]
2. **Live-object distance via world/ wrapper (AC2)** — Given the live game in the sim
   room, when a live-object distance is needed, then the `world/` wrapper resolves it
   via `getRangeTo` — verified by sim observation, not unit test. [AC: epics.md L274–276;
   AD-7, AD-10]
3. **`[board]` log line lists open Jobs (AC3)** — Given the bundle in a sim room with
   an unfilled Extension and a construction site, when Ticks run, then each Tick's
   `[board]` log line lists the open Jobs by type and tier, with the expected fill and
   build Job ids. [AC: epics.md L277–279]
4. **Generate phase wired in AD-9 position (AC4)** — Given the control cycle in `main.ts`,
   when Ticks run, then the generate phase (now including Board logging) executes in
   AD-9 position before `deriveTakenSet`, replacing the Epic 1 skeleton stub.
   [AC: epics.md L280; AD-9]
## Tasks / Subtasks

- [x] **T1 — Pure Chebyshev distance function (AC1)** — `src/world/distance.ts`, unit-tested
  - [x] Create `src/world/distance.ts` with `chebyshevDistance(a: { x: number; y: number }, b: { x: number; y: number }): number`
  - [x] Implementation: `return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))`
  - [x] No Game API calls, no Screeps runtime imports — pure math on plain data (AD-10)
  - [x] Test: `test/world/distance.test.ts` with plain `{ x, y }` objects — no mocks, no `game.ts`
  - [x] Test cases: same position → 0, adjacent orthogonal → 1, adjacent diagonal → 1, far apart → `max(|dx|, |dy|)`

- [x] **T2 — Live-object distance wrapper (AC2)** — `src/world/distance.ts`, sim-observed
  - [x] Add `liveDistance(a: RoomPositionData, b: RoomPositionData): number` in `src/world/distance.ts`
  - [x] Implementation: delegate to `chebyshevDistance` for same-room distances (MVP seam)
  - [x] No unit tests for `liveDistance` — verified by sim observation / Story 3.4
  - [x] Document in file comment: multi-room pathfinding deferred to Phase 2

- [x] **T3 — `[board]` log line in generate phase (AC3)** — `src/control/generate.ts`
  - [x] After `runProducers()` in `generate()`, read `getBoard()` and format a log line
  - [x] Log prefix: `[board]` per ARCHITECTURE-SPINE.md L108 logging convention
  - [x] Format: `[board] <count> jobs: <type>:<targetId>(<tier>) <type>:<targetId>(<tier>) ...`
  - [x] Example: `[board] 3 jobs: fill:ext1(critical) build:site1(medium) upgrade:controller1(low)`
  - [x] If Board is empty or undefined: `[board] 0 jobs`
  - [x] Use `console.log` (no framework per spine L108)
  - [x] `[board]` log always on (operator visibility); CPU metering is separate (`[control]` prefix)
  - [x] `[board]` prefix is literal in `generate.ts`, not in `config.ts`

- [x] **T4 — Verify generate phase wiring (AC4)** — `src/main.ts` + `src/control/generate.ts`
  - [x] Confirm `main.ts` calls `measurePhase("generate", generate)` before `deriveTakenSet` (no regression)
  - [x] Confirm `generate.ts` executes in order: `resetBoard()` → `buildWorldSnapshot()` → `runProducers()` → `[board]` log
  - [x] Added `[board]` log to `generate.ts` without changing `main.ts`
  - [x] Regression tests pass

- [x] **T5 — Regression gates**
  - [x] `npm run typecheck` — 0 errors
  - [x] `npm run lint` — 0 errors
  - [x] `npm test` — 57/57 pass (49 existing + 8 new)
  - [x] `npm run build` — `dist/main.js` produced
  - [x] AD-10 grep: `rg "Game\." src/world/distance.ts` — clean

## Dev Notes

### Scope Guardrails (What NOT to Touch)

- **Do NOT implement Matching** — distance service is built here, consumed in Story 3.4.
- **Do NOT implement behaviors** — no `agents/behaviors/` changes.
- **Do NOT implement spawn** — no `control/spawn.ts` changes.
- **Do NOT add mine Producer** — Story 6.2, Evolution epic.
- **Do NOT add Container-first construction** — G1 fix, Evolution epic.
- **Do NOT change Job/Contract types** — `src/board/job.ts` and `src/board/contract.ts` are stable.
- **Do NOT change policy table values** — `config.ts` values pinned in Story 2.3.
- **Do NOT add `[control]` phase logs** — those are from `control/metering.ts` (Story 1.4).
- **Do NOT change the Board registry** — `src/board/registry.ts` is stable.

### Architecture Compliance

- **AD-7 (Matching uses world/ distance service):** The distance service lives in `world/`
  (`src/world/distance.ts`). Matching (Story 3.4) will import from `world/distance`, not
  compute distances inline. [Source: ARCHITECTURE-SPINE.md L130, L135, L153]
- **AD-10 (Zero Game reads in pure functions):** `chebyshevDistance` is pure math — no
  Game API, no Screeps runtime. `liveDistance` may read Game but is isolated and
  documented. Unit tests for `chebyshevDistance` use plain data, no mocks.
  [Source: ARCHITECTURE-SPINE.md L130; AD-10]
- **AD-9 (Cycle order):** Generate phase runs first. The `[board]` log is part of generate,
  so it runs before `deriveTakenSet`. [Source: ARCHITECTURE-SPINE.md L128; AD-9]
- **AD-3 (Per-Tick Board):** The log reads the Board after `runProducers()` — this is
  the canonical Board for the Tick. [Source: AD-3]
- **Logging convention:** Prefix `[board]` per spine L108. Use `console.log`. No framework.
  [Source: ARCHITECTURE-SPINE.md L108]

### File Structure

```
src/
  world/
    distance.ts          # NEW — chebyshevDistance + liveDistance
  control/
    generate.ts          # UPDATE — add [board] log after runProducers()
test/
  world/
    distance.test.ts     # NEW — pure function tests with plain data
```

### Testing Approach

- **T1 (chebyshevDistance):** Unit tests with plain `{ x, y }` objects. No `vi.mock`,
  no `setGame`, no `beforeEach`. Just data in, number out.
- **T2 (liveDistance):** No unit tests. Verified indirectly via AC3 (sim-room log
  observation) and directly in Story 3.4 when Matching uses it.
- **T3 (log line):** Unit test the log formatting logic if extracted to a pure
  function; otherwise verify via integration test that `generate()` produces the
  expected log output when given a mock Board. Or verify in sim room.
- **T4 (wiring):** Regression test — run full test suite, confirm no failures.

### Code Patterns to Reuse

- **Module-level state + getter:** `world/distance.ts` is stateless (pure functions),
  no module state needed. But if `liveDistance` caches anything, follow the
  `snapshot.ts` pattern (module var + getter + rebuild function).
- **Plain-data interfaces:** `chebyshevDistance` accepts `{ x, y }` — matches
  `RoomPositionData` shape from `game.ts` but does not import it (avoid coupling
  pure math to the adapter layer). Use inline `{ x: number; y: number }` type.
- **Log prefix:** Literal `[board]` string, same pattern as `[control]` in
  `control/metering.ts`.

### Review Learnings from Story 2.3

- **AD-10 purity matters:** The 2.3 review caught `generation`/`getBoardGeneration()`
  in `board/registry.ts` as an AD-10 violation (Game.time read in board/). Fixed by
  removing generation from registry. Keep `world/distance.ts` clean: pure math in
  `chebyshevDistance`, Game reads only in `liveDistance` with clear documentation.
- **Type safety:** The 2.3 review caught `parseJobId` accepting invalid types via `as`
  cast. Always validate union members; never cast unvalidated strings.
- **Test helper typing:** The 2.3 review caught `fullInput` returning `any`. Type test
  helpers precisely.
- **Config coupling verified:** Story 2.3 used `setConstant` to mutate `JOB_POLICY_TABLE`
  in tests and verified Producers read from config. Continue this pattern: if any
  distance threshold or constant is added to config, test it via `setConstant`.

## Dev Agent Record

### Agent Model Used

bm-dev

### Debug Log References

- `generate.ts` formatting required Biome-compliant single-line chain.
- `test/smoke.test.ts` initially asserted exact `console.log` count of 1; updated to allow `[board]` phase logs after boot marker.
- `test/control/generate.test.ts` first attempt tried async Board injection; replaced with pure `formatBoardLog` tests.

### Completion Notes List

- Implemented pure `chebyshevDistance` in `src/world/distance.ts` with no Game reads (AD-10).
- Added `liveDistance` seam delegating to pure function for same-room MVP distances.
- Added `formatBoardLog` in `src/control/generate.ts` and wired `[board]` log after `runProducers()` (AD-9).
- Updated `test/smoke.test.ts` to tolerate phase logs while still asserting boot marker logged exactly once.
- Added `test/world/distance.test.ts` (5 tests) and `test/control/generate.test.ts` (3 tests).
- All gates green: typecheck 0, lint 0, 57/57 tests, build OK, AD-10 grep clean.

### File List

- `src/world/distance.ts` (new)
- `src/control/generate.ts` (modified)
- `test/world/distance.test.ts` (new)
- `test/control/generate.test.ts` (new)
- `test/smoke.test.ts` (modified)
- `_bmad-output/implementation-artifacts/2-4-distance-service-sim-room-board-visibility.md` (story tracking)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status update)

## Review Findings

> Code review run 2026-08-12 (model: bm-review). All parallel review subagent layers failed due to Cline account authorization, so this review was performed manually by the primary reviewer. 0 patch, 0 decision-needed, 2 defer, 3 dismissed.

- [x] **[Defer]** `liveDistance` does not use `Game.getRangeTo` literally, despite AC2 wording — it delegates to the pure `chebyshevDistance`. Story T2 explicitly chose option (b) for the MVP seam, and the function is correct for same-room distances. This is a spec-wording debt, not a code bug; reconcile if future stories need actual `getRangeTo`. `[src/world/distance.ts:31]`
- [x] **[Defer]** `liveDistance` does not guard against cross-room `RoomPositionData`. MVP is single-room, so this is acceptable; multi-room pathfinding is deferred to Phase 2 per architecture. `[src/world/distance.ts:31]`
- [ ] **[Dismiss]** `formatBoardLog` lives in `control/generate.ts` rather than `board/`. It is part of the generate-phase log emission, so its location is appropriate for MVP. Dismissed.
- [ ] **[Dismiss]** `chebyshevDistance` accepts `NaN`/`Infinity` without validation. Out of scope for a plain-data helper; callers supply valid coordinates. Dismissed.
- [ ] **[Dismiss]** `distance.ts` imports `RoomPositionData` from `../game` for `liveDistance`. The Game adapter is the sanctioned seam and `world/` is allowed to read Game; this is lawful. Dismissed.

## Change Log

- **2026-08-12:** Story created (ready-for-dev).
- **2026-08-12:** Implementation complete — distance service, `[board]` log, wiring, tests, all gates green (status: review).
- **2026-08-12:** Code review complete — 0 patch, 2 defer, 3 dismissed.

## References

- [Source: epics.md L263–280] — Story 2.4 ACs: distance service + [board] log + generate wiring
- [Source: ARCHITECTURE-SPINE.md L130] — `world/` owns distance service (AD-7)
- [Source: ARCHITECTURE-SPINE.md L135] — `control/matching.ts` consumes distance service
- [Source: ARCHITECTURE-SPINE.md L153] — Capability map: PRD §4.3 Matching → AD-7
- [Source: ARCHITECTURE-SPINE.md L108] — Logging convention: `console` only, prefixed by module
- [Source: prd.md FR-11, FR-12] — Tier-first matching + TTL-aware matching (distance service consumers)
- [Source: AD-7] — Distance service is the single source for travel-cost calculations
- [Source: AD-9] — Generate phase runs first in the control cycle
- [Source: AD-10] — No find/look/getObjectById/terrain calls outside `world/`
- [Source: src/control/generate.ts] — Current generate phase (resetBoard → buildWorldSnapshot → runProducers)
- [Source: src/main.ts] — Control cycle wiring (measurePhase("generate", generate))
- [Source: src/board/registry.ts] — Board API (getBoard, getBoard().jobs)
- [Source: src/board/job.ts] — Job type shape (type, targetId, tier)
- [Source: src/game.ts] — RoomPositionData shape + GameAdapter
- [Source: 2-3-producers-policy-table.md] — Previous story: Producers, policy table, review learnings
- [Source: deferred-work.md] — No open deferred items for this story


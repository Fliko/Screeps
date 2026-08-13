---
baseline_commit: b82f427676d1c28d25a94a80c58ae8ea0c5f10c7
---

# Story 3.1: Contract & Memory Schema

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the operator,
I want `state/` to own the `creep.memory` schema with typed accessors,
So that Contract reads/writes have exactly one shape and one owner per field (AD-2, FR-8).

**Epic 3 — Dispatch: Creeps Claim and Keep Work.** Epic 2 built the Job Board: snapshot, Board,
Producers, and distance service. Epic 3 adds the Contract lifecycle. Story 3.1 establishes the
**`creep.memory` schema** in `state/` — the single source of truth for what a Creep persists about
its Contract. Later stories add: taken-set derivation (3.2), per-type validators (3.3), Matching with
claim lock (3.4), movement choke point (3.5), and cycle wiring/wipe recovery (3.6).

Do **not** implement Matching, scoring, claim lock, behaviors, movement, spawn, or the full validate
phase logic here. This story only defines the schema and accessors. Matching/validators will read
and write through these accessors, never touching `creep.memory` directly.
[Source: epics.md L286–294; prd.md FR-8; ARCHITECTURE-SPINE.md L135–142; reconcile-prd.md L23–24]

## Acceptance Criteria

1. **Schema type defined in `state/` (AC1)** — Given the Contract schema module, when a developer
   inspects it, then it exports a TypeScript type describing `creep.memory.contract` as a Job id
   (`jobId: JobId`) plus any fields required for Contract state, with no direct `creep.memory`
   shapes duplicated elsewhere. [AC: epics.md L292–294; FR-8]
2. **Typed read/write accessors (AC2)** — Given a Creep stub (test) or live Creep, when code calls
   `getContract(creep)` and `setContract(creep, contract)`, then reads and writes go through the
   schema module and preserve the typed shape. [AC: epics.md L292–294; AD-2]
3. **Clear/delete accessors (AC3)** — Given a Creep with a Contract, when `clearContract(creep)` is
   called, then the Contract field is removed and subsequent `getContract(creep)` returns undefined.
   [AC: FR-10 idle-only assignment; AD-4]
4. **Deserialization guard (AC4)** — Given a `creep.memory.contract` string that is malformed or
   references an unknown Job id, when `getContract(creep)` is called, then it returns undefined
   (treats invalid persisted data as "no Contract") rather than throwing or returning garbage.
   [AC: AD-4 Contract grammar; `parseJobId` validation from Story 2.2]
5. **No direct `creep.memory` access outside `state/` (AC5)** — Given a grep across `src/`, when
   searching for `.memory.contract` assignments/reads outside `state/`, then there are zero hits
   (except inside `state/` accessors and `game.ts` adapter mapping). [AC: AD-2 single owner]
## Tasks / Subtasks

- [ ] **T1 — Define Contract state type in `src/state/contract.ts` (AC1)**
  - [ ] Create `src/state/contract.ts`
  - [ ] Define and export `ContractState` interface: `{ jobId: JobId }`
  - [ ] Import `JobId` as type-only from `../board/job` (`import type { JobId } from "../board/job"`)
  - [ ] Add file header comment: "AD-2: single owner of creep.memory.contract schema"
  - [ ] Do **not** add extra fields (no `phase`, no `targetId` duplication, no TTL cache) — keep it minimal; more fields arrive in later stories if needed

- [ ] **T2 — Implement read/write/clear accessors (AC2, AC3)**
  - [ ] Export `getContract(creep: { memory: { contract?: string } }): ContractState | undefined`
  - [ ] Implementation: read `creep.memory.contract`, call `parseJobId` from `board/job`, return `{ jobId }` if valid, else `undefined`
  - [ ] Export `setContract(creep: { memory: { contract?: string } }, contract: ContractState): void`
  - [ ] Implementation: write `creep.memory.contract = makeJobId(contract.jobId)`
  - [ ] Export `clearContract(creep: { memory: { contract?: string } }): void`
  - [ ] Implementation: `delete creep.memory.contract`
  - [ ] Use minimal interface `{ memory: { contract?: string } }` so tests can pass plain objects, not full Creep stubs

- [ ] **T3 — Deserialization guard for malformed persisted data (AC4)**
  - [ ] Reuse `parseJobId` from `src/board/job.ts` (already validates JobType union and non-empty targetId from Story 2.2)
  - [ ] If `parseJobId` throws or returns invalid, `getContract` returns `undefined`
  - [ ] No exceptions escape `getContract` for bad persisted memory
  - [ ] Test cases: valid `fill:ext1`, invalid `bogus:123`, missing field, empty string

- [ ] **T4 — Update `game.ts` adapter to use schema accessor (AC5)**
  - [ ] Currently `mapCreep` in `src/game.ts` reads `stub.memory.contract` directly and copies it into `SnapshotCreep.contract?: string`
  - [ ] Keep `SnapshotCreep.contract?: string` (snapshot is plain data), but add a comment noting the string should be validated via `getContract` by consumers
  - [ ] Do **not** import `state/` into `game.ts` (adapter layer stays below business logic)
  - [ ] The grep in AC5 excludes `game.ts` adapter mapping by convention

- [ ] **T5 — Unit tests in `test/state/contract.test.ts`**
  - [ ] Test `getContract` returns `{ jobId }` for valid contract string
  - [ ] Test `getContract` returns `undefined` for missing contract
  - [ ] Test `getContract` returns `undefined` for malformed/invalid type/empty targetId
  - [ ] Test `setContract` writes expected string to `memory.contract`
  - [ ] Test `setContract` round-trips through `getContract`
  - [ ] Test `clearContract` removes contract and `getContract` returns undefined
  - [ ] All tests use plain `{ memory: { contract?: string } }` objects — no Screeps mocks

- [ ] **T6 — AD-2 ownership gate (AC5)**
  - [ ] Run `rg "\.memory\.contract" src/ --type ts`
  - [ ] Expected hits: `src/state/contract.ts` accessors, `src/game.ts` adapter mapping only
  - [ ] If any other `src/` file touches `.memory.contract`, refactor to use `state/contract.ts`

- [ ] **T7 — Regression gates**
  - [ ] `npm run typecheck` — 0 errors
  - [ ] `npm run lint` — 0 errors
  - [ ] `npm test` — all existing tests pass + new contract tests pass
  - [ ] `npm run build` — `dist/main.js` produced

## Dev Notes

### Scope Guardrails (What NOT to Touch)

- **Do NOT implement Matching** — Story 3.4.
- **Do NOT implement validators** — Story 3.3.
- **Do NOT implement taken-set derivation** — Story 3.2.
- **Do NOT implement behaviors** — Epic 4.
- **Do NOT implement spawn** — Epic 5.
- **Do NOT add movement logic** — Story 3.5.
- **Do NOT change Job/Contract types in `board/`** — `JobId`, `Contract` alias are stable.
- **Do NOT change Board registry** — stable.
- **Do NOT change Producers** — stable.
- **Do NOT add memory fields beyond `contract`** — if another field seems needed, defer it; this story pins only the schema shape.

### Architecture Compliance

- **AD-2 (Single owner per field):** `state/contract.ts` is the only module that knows the shape of
  `creep.memory.contract`. All reads/writes go through `getContract`/`setContract`/`clearContract`.
  [Source: ARCHITECTURE-SPINE.md AD-2; reconcile-prd.md L23–24]
- **AD-4 (Contract = jobId string):** The schema stores only the Job id. `parseJobId`/`makeJobId`
  enforce the `type:targetId` grammar. [Source: ARCHITECTURE-SPINE.md L102; AD-4]
- **AD-10 (No Game reads in business logic):** `state/contract.ts` only touches the `memory` object
  passed to it. It does not call `Game.getObjectById`, `find`, `look`, or terrain. Tests use plain
  objects. [Source: AD-10]
- **Data convention:** `creep.memory = { contract, move, _move(engine) }` — this story owns
  `contract`; `move`/`_move` arrive with the movement story (3.5). [Source: ARCHITECTURE-SPINE.md L102]

### File Structure

```
src/
  state/
    contract.ts          # NEW — ContractState + getContract/setContract/clearContract
  game.ts                # UPDATE — comment only (optional)
test/
  state/
    contract.test.ts     # NEW — schema accessor tests
```

### Code Patterns to Reuse

- **Minimal input interface:** Accept `{ memory: { contract?: string } }` instead of `CreepStub` so
  tests can pass plain objects. This mirrors how `board/registry.ts` accepts `Job` objects and how
  `world/producers/` accept `WorldSnapshot`.
- **Reuse `parseJobId`/`makeJobId`:** Do not reimplement id parsing. Import from `../board/job`.
  Story 2.2 already added validation for invalid types and empty targetIds.
- **Deserialization guard:** Return `undefined` on invalid persisted data. Do not throw. This lets
  validators/Matching treat a bad Contract as "no Contract" and reassign the Creep.
- **No runtime enums:** Use string-union types (`JobType`) and string ids, per spine convention
  L102.

### Review Learnings from Story 2.4

- **AD-10 purity matters:** Keep `state/contract.ts` free of Game API calls. It only manipulates the
  passed `memory` object.
- **Plain-data tests:** `distance.test.ts` proved pure functions can be tested with plain objects,
  no mocks. Apply the same here.
- **Log prefix consistency:** `[board]` log in `generate.ts` uses module prefix. No logging needed
  in this story.
- **Type imports:** Use `import type { JobId } from "../board/job"` to avoid runtime imports where
  only types are needed.

## Dev Agent Record

### Agent Model Used

bm-dev (cheap model) — record here for audit.

### Debug Log References

### Completion Notes List

### File List

## Change Log

- **2026-08-12:** Story created (ready-for-dev).

## References

- [Source: epics.md L286–294] — Story 3.1 ACs: creep.memory schema with typed accessors
- [Source: prd.md FR-8] — Contract persistence in Creep memory
- [Source: ARCHITECTURE-SPINE.md L102] — Data convention: `creep.memory = { contract, move, _move(engine) }`
- [Source: ARCHITECTURE-SPINE.md L135–142] — Structural seed: `state/` owns creep.memory schema
- [Source: ARCHITECTURE-SPINE.md AD-2] — Single owner per field
- [Source: ARCHITECTURE-SPINE.md AD-4] — Contract grammar and stickiness
- [Source: ARCHITECTURE-SPINE.md AD-10] — No Game reads outside `world/`
- [Source: reconcile-prd.md L23–24] — FR-8 homed in `state/`
- [Source: src/board/job.ts] — `JobId`, `parseJobId`, `makeJobId` (reuse)
- [Source: src/game.ts] — CreepStub.memory shape; adapter mapping
- [Source: src/control/{match,validate,taken,spawn}.ts] — Empty stubs that will consume state/contract in later stories
- [Source: 2-4-distance-service-sim-room-board-visibility.md] — Previous story: distance service + [board] log


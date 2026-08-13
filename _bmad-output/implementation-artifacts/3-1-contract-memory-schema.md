---
baseline_commit: b82f427676d1c28d25a94a80c58ae8ea0c5f10c7
baseline_revision: 5ac634ed96684f6a33a42352086f60f12af80fa2
status: done
followup_review_recommended: false
final_revision: 5ac634ed96684f6a33a42352086f60f12af80fa2
---

# Story 3.1: Contract & Memory Schema

Status: done



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

- [x] **T1 — Define Contract state type in `src/state/contract.ts` (AC1)**
  - [x] Create `src/state/contract.ts`
  - [x] Define and export `ContractState` interface: `{ jobId: JobId }`
  - [x] Import `JobId` as type-only from `../board/job` (`import type { JobId } from "../board/job"`)
  - [x] Add file header comment: "AD-2: single owner of creep.memory.contract schema"
  - [x] Do **not** add extra fields (no `phase`, no `targetId` duplication, no TTL cache) — keep it minimal; more fields arrive in later stories if needed

- [x] **T2 — Implement read/write/clear accessors (AC2, AC3)**
  - [x] Export `getContract(creep: { memory: { contract?: string } }): ContractState | undefined`
  - [x] Implementation: read `creep.memory.contract`, call `parseJobId` from `board/job`, return `{ jobId }` if valid, else `undefined`
  - [x] Export `setContract(creep: { memory: { contract?: string } }, contract: ContractState): void`
  - [x] Implementation: write `creep.memory.contract = makeJobId(contract.jobId)`
  - [x] Export `clearContract(creep: { memory: { contract?: string } }): void`
  - [x] Implementation: `delete creep.memory.contract`
  - [x] Use minimal interface `{ memory: { contract?: string } }` so tests can pass plain objects, not full Creep stubs

- [x] **T3 — Deserialization guard for malformed persisted data (AC4)**
  - [x] Reuse `parseJobId` from `src/board/job.ts` (already validates JobType union and non-empty targetId from Story 2.2)
  - [x] If `parseJobId` throws or returns invalid, `getContract` returns `undefined`
  - [x] No exceptions escape `getContract` for bad persisted memory
  - [x] Test cases: valid `fill:ext1`, invalid `bogus:123`, missing field, empty string

- [x] **T4 — Update `game.ts` adapter to use schema accessor (AC5)**
  - [x] Currently `mapCreep` in `src/game.ts` reads `stub.memory.contract` directly and copies it into `SnapshotCreep.contract?: string`
  - [x] Keep `SnapshotCreep.contract?: string` (snapshot is plain data), but add a comment noting the string should be validated via `getContract` by consumers
  - [x] Do **not** import `state/` into `game.ts` (adapter layer stays below business logic)
  - [x] The grep in AC5 excludes `game.ts` adapter mapping by convention

- [x] **T5 — Unit tests in `test/state/contract.test.ts`**
  - [x] Test `getContract` returns `{ jobId }` for valid contract string
  - [x] Test `getContract` returns `undefined` for missing contract
  - [x] Test `getContract` returns `undefined` for malformed/invalid type/empty targetId
  - [x] Test `setContract` writes expected string to `memory.contract`
  - [x] Test `setContract` round-trips through `getContract`
  - [x] Test `clearContract` removes contract and `getContract` returns undefined
  - [x] All tests use plain `{ memory: { contract?: string } }` objects — no Screeps mocks

- [x] **T6 — AD-2 ownership gate (AC5)**
  - [x] Run `rg "\.memory\.contract" src/ --type ts`
  - [x] Expected hits: `src/state/contract.ts` accessors, `src/game.ts` adapter mapping only
  - [x] If any other `src/` file touches `.memory.contract`, refactor to use `state/contract.ts`

- [x] **T7 — Regression gates**
  - [x] `npm run typecheck` — 0 errors
  - [x] `npm run lint` — 0 errors
  - [x] `npm test` — all existing tests pass + new contract tests pass
  - [x] `npm run build` — `dist/main.js` produced

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

- Created `src/state/contract.ts` as the single AD-2 owner of the `creep.memory.contract` schema.
- `ContractState` is intentionally minimal: `{ jobId: JobId }`; no phase, targetId duplication, or TTL cache.
- `getContract` parses the persisted string via `parseJobId` and returns `undefined` for any invalid/missing value (no throw).
- `setContract` canonicalizes the stored string through `parseJobId`/`makeJobId`.
- `clearContract` deletes `memory.contract`; subsequent `getContract` returns `undefined`.
- `src/game.ts` received a comment only — no `state/` import in the adapter layer.
- `src/world/snapshot.ts` was refactored to read the Creep's Contract through `getContract` so the only actual `.memory.contract` reads/assignments live in `state/contract.ts` and `game.ts`.
- Remaining `rg "\.memory\.contract" src/ --type ts` hits are documentation comments in `src/board/contract.ts` and `src/board/job.ts`; there are no other reads or assignments.
- All regression gates pass: `typecheck`, `lint`, `test` (66 tests), and `build` (`dist/main.js` 10.9kb).

### File List

- `src/state/contract.ts` — created
- `test/state/contract.test.ts` — created
- `src/game.ts` — updated (adapter comment only)
- `src/world/snapshot.ts` — updated (use `getContract` for snapshot contract field)
- `_bmad-output/implementation-artifacts/3-1-contract-memory-schema.md` — updated task checkboxes and completion notes

## Review Triage Log

### 2026-08-12 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 0, low 6)
- defer: 0
- reject: 9
- addressed_findings:
  - `[low] [patch]` Strengthened `getContract` to explicitly reject non-string persisted values (`null`, numbers, etc.) instead of relying solely on `parseJobId` throwing.
  - `[low] [patch]` Clarified ownership comment in `src/state/contract.ts` to note the permitted adapter read in `src/game.ts`.
  - `[low] [patch]` Reworded `src/game.ts` adapter comment to reflect that `world/snapshot.ts` performs validation via `getContract`.
  - `[low] [patch]` Added edge-case tests for `null`, non-string, uppercase type, and target ids containing colons.
  - `[low] [patch]` Added explicit test documenting that `setContract` throws on a malformed `jobId`.
  - `[low] [patch]` Added `test/world/snapshot.test.ts` coverage verifying that missing/invalid creep contracts are dropped from `SnapshotCreep.contract`.

## Auto Run Result

- **Status:** done
- **Summary:** Implemented Story 3.1 — `state/contract.ts` is now the single AD-2 owner of the `creep.memory.contract` schema, providing typed `getContract`, `setContract`, and `clearContract` accessors. `world/snapshot.ts` reads contracts through the accessor, and `src/game.ts` remains a raw adapter mapping with an ownership comment.
- **Files changed:**
  - `src/state/contract.ts` — created: `ContractState`, `getContract`, `setContract`, `clearContract`.
  - `test/state/contract.test.ts` — created: 13 accessor edge-case tests.
  - `test/world/snapshot.test.ts` — updated: added invalid/missing contract mapping test.
  - `src/game.ts` — updated: adapter ownership/validation comment.
  - `src/world/snapshot.ts` — updated: `mapCreep` uses `getContract` to populate snapshot contract.
- **Review findings breakdown:** 6 low-severity patches applied; 0 deferred; 9 rejected (design-by-spec, false positives, or unsubstantiated claims).
- **Follow-up review recommended:** false
- **Verification performed:**
  - `npm run typecheck` — 0 errors
  - `npm run lint` — 0 errors
  - `npm test` — 71 tests passed
  - `npm run build` — `dist/main.js` produced
  - `rg "\.memory\.contract" src/ --type ts` — only `src/state/contract.ts` accessors and `src/game.ts` adapter mapping
- **Residual risks:** None identified.
- **Git note:** No commit was made per project git-governance rules (AI agents never run git-mutating commands). `final_revision` captured as current HEAD.


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


---
title: 'Node Tagging and Amended Job/Contract Id Grammar'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'fbc7226d222f4c310e73d9fd1eac8e277f123585'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Job/Contract ids use the flat `type:targetId` grammar with no sub-type pool concept, which blocks Stage 2's Node/Pool scheduler (SPEC.md CAP-1/CAP-2 amendment, node-pool-model.md) — nothing can key occupancy, priority, or config below the `JobType` level yet.

**Approach:** Add a `NodeName` string-union to `board/job.ts` alongside `JobType`, add a required `node: NodeName` field to `Job`/`JobInput`, have every Producer tag its Jobs with a Node, and widen the id grammar from `type:targetId` to `type:node:targetId` (`makeJobId`/`parseJobId`), propagating `node` through every call site that builds or parses a Contract.

## Boundaries & Constraints

**Always:**
- `NodeName` is defined exactly once in `board/job.ts` alongside `JobType` — story 4's config table keys off this same union; no second free-string naming scheme.
- Every Producer tags every Job it emits with a `NodeName` — no Job may omit `node`.
- `parseJobId` splits on the first two colons — type, then node, then the remainder is `targetId` (a colon-bearing `targetId` must still round-trip).
- Existing `{ type, targetId }` / `{ type }` / `{ targetId }` destructuring of `parseJobId`'s return keeps compiling unchanged.

**Ask First:** None — `NodeName`'s initial membership is this story's design surface, called out at Checkpoint 1 for confirmation rather than mid-implementation.

**Never:** No `config.ts` per-Node table yet (story 4) — Producers hardcode `NodeName` the way they hardcode policy lookups today. No change to `tier`/`withinTierPriority`/Matching (story 5) or Era gating (story 8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| mine / build / upgrade Producer | any Source / site / Controller | `Job.node` = `"mines"` / `"build"` / `"upgrade"` | N/A |
| fill Producer | `structureType` = `"spawn"` or `"extension"` | `Job.node` = `"spawns"` or `"extensions"` | N/A |
| round-trip | `parseJobId(makeJobId(type, node, targetId))` | returns `{ type, node, targetId }` exactly | N/A |
| colon-bearing targetId | `makeJobId("fill", "spawns", "spawn:123")` | `targetId` round-trips as `"spawn:123"` (first two colons only) | N/A |
| malformed id | id with fewer than 2 colons | rejected | throws `Error` |

</frozen-after-approval>

## Code Map

- `src/board/job.ts` -- add `NodeName`, add `node` to `Job`/`JobInput`, widen `makeJobId`/`parseJobId`/`makeJob` to 3-segment grammar (L60-98).
- `src/board/contract.ts`, `src/board/registry.ts` -- grammar doc comments (L5-6, L57) -- update to `type:node:targetId`.
- `src/world/producers/{mine,fill,build,upgrade}.ts` -- each `makeJob` call -- add `node` (mine→`"mines"`, fill→`structureType`-keyed, build→`"build"`, upgrade→`"upgrade"`).
- `src/state/contract.ts` -- `setContract` (L57-58) destructures `{ type, targetId }`, calls `makeJobId(type, targetId)` -- widen to include `node`.
- No-change, confirmed: `control/{match,spawn,taken,validate}.ts`, `agents/validators.ts`, `agents/behaviors/*.ts` — consume `JobId` opaquely or destructure only `{ type }`/`{ targetId }`, both keep compiling.
- `test/board/job.test.ts` -- rewrite 2-segment `makeJobId`/`parseJobId` calls to 3-segment, add colon-splitting-order case.
- `test/world/producers/{mine,fill,build,upgrade}.test.ts` -- assert emitted `Job.node`.
- `test/state/contract.test.ts` -- update raw jobId fixtures to 3 segments.

## Tasks & Acceptance

**Execution:**
- [x] `src/board/job.ts` -- add `NodeName = "spawns" | "extensions" | "mines" | "build" | "upgrade"`; add `node: NodeName` to `Job`/`JobInput`; widen `makeJobId`/`parseJobId` to 3 segments; thread `node` through `makeJob` -- foundation everything else depends on.
- [x] `src/world/producers/{mine,fill,build,upgrade}.ts` -- tag each `makeJob` call with its `node` per the I/O Matrix -- gives every emitted Job a pool.
- [x] `src/state/contract.ts` -- widen `setContract` to destructure and re-pass `node` -- keeps canonicalization on the new grammar.
- [x] `src/board/contract.ts`, `src/board/registry.ts` -- update grammar doc comments.
- [x] `test/board/job.test.ts` -- rewrite to 3-segment grammar; add colon-bearing-`targetId` round-trip case.
- [x] `test/world/producers/{mine,fill,build,upgrade}.test.ts` -- assert `Job.node` per Producer.
- [x] `test/state/contract.test.ts` -- update raw jobId fixtures to 3 segments.

**Acceptance Criteria:**
- Given a fresh Tick's Board, when any Producer emits a Job, then `Job.node` is set and `Job.id` follows `type:node:targetId`.
- Given a Contract read via `getContract`/`setContract`, when the underlying Job's `targetId` contains colons, then the Contract still round-trips to the identical string.
- Given the full test suite plus this story's additions, when `npm run typecheck && npm run lint && npm run test` runs, then all pass with zero new failures.

## Design Notes

`NodeName` membership mirrors node-pool-model.md's worked example (`spawns`, `extensions`, `mines`), extended 1:1 to `build`/`upgrade` so every current Producer has exactly one Node without inventing unneeded splits. Story 4 can still route `build`/`upgrade` to a shared or split Node later via config alone.

## Verification

**Commands:**
- `npm run typecheck` -- expected: 0 errors
- `npm run lint` -- expected: 0 errors
- `npm run test` -- expected: all pass, including the updated `job.ts`/producer/`contract` tests

## Suggested Review Order

**Schema & grammar change**

- Entry point: `NodeName` union added alongside `JobType` — the new closed set every Producer tags Jobs with.
  [`job.ts:21`](../../../../src/board/job.ts#L21)

- `makeJobId`/`parseJobId` widen from 2 to 3 segments, splitting on the first two colons only.
  [`job.ts:106`](../../../../src/board/job.ts#L106)

- Review-round hardening: rejects a well-formed-but-mismatched pairing (e.g. `upgrade:mines:x`) instead of silently parsing it.
  [`job.ts:87`](../../../../src/board/job.ts#L87)

**Producer tagging**

- `fill` is the only Producer with a real branch — node keyed off `structureType`, typed to admit a miss rather than lying.
  [`fill.ts:20`](../../../../src/world/producers/fill.ts#L20)

- `mine`, `build`, `upgrade` each hardcode their single Node — no config table yet (that's story 4).
  [`mine.ts:17`](../../../../src/world/producers/mine.ts#L17)

**Contract canonicalization**

- `setContract` re-derives and re-passes `node` through the widened grammar so persisted Contracts stay canonical.
  [`contract.ts:57`](../../../../src/state/contract.ts#L57)

**Peripherals**

- Doc comments updated to the new grammar; no behavior change.
  [`contract.ts:5`](../../../../src/board/contract.ts#L5)

- Round-trip, colon-splitting-order, and type/node-pairing coverage for the new grammar.
  [`job.test.ts:32`](../../../../test/board/job.test.ts#L32)

- Documents the exact pre-migration Contract shape (`fill:spawn1`) any live Creep's Memory holds right after this ships.
  [`contract.test.ts:37`](../../../../test/state/contract.test.ts#L37)

- Shared `NODE_BY_TYPE`/`PULLED_NODE_BY_TYPE` fixture, replacing seven hand-duplicated copies across test files.
  [`node-fixtures.ts:8`](../../../../test/helpers/node-fixtures.ts#L8)

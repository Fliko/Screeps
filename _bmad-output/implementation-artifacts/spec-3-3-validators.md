---
title: 'Story 3.3: Validators'
type: 'feature'
created: '2026-08-13'
status: 'done'
review_loop_iteration: 2
context: []
baseline_commit: 'c09f65d63ca3c09f56306ce1ecf15c436d9bb6ba'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Contracted Creeps never re-check whether their Contract is still worth holding — a Creep can serve a fulfilled or vanished target forever, or outlive its Job's TTL floor, because `control/validate.ts` is still the Story 1.4 stub.

**Approach:** Each Tick, for every Contracted Creep, clear the Contract iff its Job's target is gone from the freshly-derived Board (reusing `findJob`, not re-deriving fulfillment logic) or the Creep's TTL is below that Job's `ttlFloor`; return the cleared Contracts so Story 3.2's `releaseContracts` can un-count them before match runs.

## Boundaries & Constraints

**Always:**
- Invalidity is exactly two conditions: `findJob(contract.jobId)` returns nothing on this Tick's Board (target vanished or fulfilled — Producers already omit fulfilled targets, so absence covers both), or `creep.ttl < job.requirements.ttlFloor`.
- `mine`-type Contracts are exempt from all validation this story — always kept valid (FR-9's explicit depleted-Source exception). No mine Jobs exist yet (Epic 6 scope) and no Source snapshot read exists; extending real mine checks is Epic 6's job, not this story's.
- Carry state (`creep.carry`) is never read by the validator.
- All Memory writes route through `state/contract.ts`; `control/validate.ts` never touches `Memory` or `Game` directly (AD-2, AD-10).

**Ask First:** none anticipated.

**Never:**
- Do not add Source/mine world-snapshot plumbing — out of scope until Epic 6 defines it.
- Do not touch `match.ts`, `spawn.ts`, `taken.ts`, `metering.ts`, or `main.ts`'s phase wiring — Story 3.2 already wired `validate`/`releaseContracts` correctly.
- Do not re-implement "structure full" / "site exists" checks independently of the Board — reuse `findJob`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vanished/fulfilled target | Contracted Creep, `findJob(contract.jobId)` returns `undefined` | Contract cleared, jobId in returned array | N/A |
| TTL floor breach | Job found, `creep.ttl < job.requirements.ttlFloor` | Contract cleared | N/A |
| Still valid | Job found, TTL sufficient | Contract untouched, not in returned array | N/A |
| Mine exception | `mine:*` Contract, no Board Job for it | Contract stays valid regardless | N/A |
| Carry state | Two otherwise-identical Creeps differing only in `carry` | Same outcome for both | N/A |
| No snapshot | `getCurrentSnapshot()` returns `undefined` | Returns `[]`, clears nothing | N/A |

</frozen-after-approval>

## Code Map

- `src/agents/validators.ts` -- currently a one-line placeholder (`// per-type Contract validation (AD-4)`). The architecture spine's Capability→Architecture Map assigns "Contract Lifecycle" here explicitly, and its module tree names this file for exactly this. Implement `isContractValid(type, job, ttl): boolean` here as a **pure** function (no Game/Memory/Board mutation), mirroring `world/producers/*`'s purity convention. Per-type rules live in a `Record<Exclude<JobType, "mine">, ...>` table (same shape as `config.ts`'s `JOB_POLICY_TABLE`), giving Epic 6 a natural slot to add a real `mine` rule later without restructuring.
- `src/control/validate.ts` -- stub; already typed `(_takenSet: TakenSet) => readonly ContractState[]` from Story 3.2, wired into `main.ts` with `releaseContracts` — do not touch signature or `main.ts`. Becomes a **thin AD-9 phase orchestrator**: loop over Contracted Creeps in the snapshot, ask `agents/validators.ts` for the verdict, clear via `world/creeps.ts` on `false`. Mirrors `control/generate.ts`'s existing shape (thin orchestrator calling into pure rule modules).
- `src/board/registry.ts` -- `findJob(id): Job | undefined` (Board is fresh before validate runs, AD-9); also `getBoard(): Board | undefined` — guard on this being undefined before treating job-absence as invalidity, so an unreset Board (defensive-only case) can't mass-clear every Contract.
- `src/board/job.ts` -- `parseJobId(id)` → `{ type, targetId }`; `Job.requirements.ttlFloor`.
- `src/world/snapshot.ts` -- `getCurrentSnapshot()?.creeps` gives `{ id, ttl, contract? }`; `contract` is already grammar-validated at snapshot-build time, so `parseJobId` here cannot throw. Note: `ttl` is `creep.ticksToLive ?? 0` (`src/game.ts`), so `0` is ambiguous between "still Spawning" and "about to die of old age" — `agents/validators.ts`'s rules must treat `ttl === 0` as valid (do not clear), or a just-written Reserved Contract on a Spawning Creep gets cleared every Tick (FR-16, FR-29). Flagged for this exact story in Story 3.2's Dev Notes.
- `src/world/creeps.ts` (new, unchanged from loop 1) -- `clearCreepContract(creepId: string): boolean` via `getGame().getObjectById(creepId)` + `state/contract.ts#clearContract`. Add one defensive guard: confirm the resolved object has a `memory` property before delegating (Screeps ids are unique across all object types so this is belt-and-suspenders, not a live risk, but cheap).
- `src/state/contract.ts` -- **no changes**.
- `test/agents/validators.test.ts` (new), `test/world/creeps.test.ts` (new), `test/control/validate.test.ts`, `test/control-cycle.test.ts` -- new/existing suites; stage Creeps via `getObjectById` mocks, not a hand-keyed `Memory.creeps` object.

## Tasks & Acceptance

**Execution:**
- [x] `src/agents/validators.ts` -- implement `isContractValid(type: JobType, job: Job | undefined, ttl: number): boolean`: `mine` always `true`; otherwise `false` if `job` is absent, else the type's rule — `ttl === 0 || ttl >= job.requirements.ttlFloor`
- [x] `test/agents/validators.test.ts` (new) -- unit-test `isContractValid` directly: mine always valid regardless of job/ttl; job absent → invalid; ttl below floor (nonzero) → invalid; ttl at/above floor → valid; `ttl === 0` → valid even below floor (the Spawning-Creep case), for each of fill/build/upgrade
- [x] `src/world/creeps.ts` (new) -- `clearCreepContract(creepId: string): boolean` -- resolves via `getGame().getObjectById(creepId)`, guards the result has a `memory` property, calls `state/contract.ts`'s `clearContract`, returns whether a Creep was found; the only file that touches `Game`/`Memory` for this story (AD-10)
- [x] `test/world/creeps.test.ts` (new) -- `getObjectById` mock returns a Creep-shaped object → cleared, returns `true`; mock returns `undefined` → no-op, returns `false`; mock returns a memory-less object → no-op, returns `false`
- [x] `src/control/validate.ts` -- implement as a thin orchestrator: bail `[]` (with a log) if no snapshot or no Board; else for each Contracted Creep, call `isContractValid(type, findJob(jobId), creep.ttl)`, and on `false` call `clearCreepContract(creep.id)`, collecting the jobId only when it returns `true`
- [x] `test/control/validate.test.ts` (new) -- cover every I/O Matrix row directly against `validate()`, plus: a `ttl === 0` Creep with an open non-mine Job keeps its Contract; no-Board bails with `[]`; multiple Contracted Creeps mixed valid/invalid in one call; returned array matches cleared jobIds exactly; a `getObjectById` mock proves the resolved Creep's memory was actually mutated
- [x] `test/control-cycle.test.ts` -- one new case: `loop()` with a fill Contract whose target is absent this Tick clears the mocked Creep's `memory.contract` for real; assert the taken-set `validate` receives counts the Contract (1) and the taken-set `match` receives does not (0), proving the release actually happened rather than the Contract never having been counted

**Acceptance Criteria:**
- Given a Contracted Creep whose Job is still open on the fresh Board and whose TTL meets the floor, when `validate` runs, then the Contract is untouched and absent from the returned array.
- Given `loop()` runs, when `validate` clears a Contract, then `match` receives the taken-set with that Contract already released (Story 3.2's `releaseContracts`, unchanged).

## Spec Change Log

- **2026-08-13, loop 1 (bad_spec):** Three independent review layers (blind-hunter, edge-case-hunter, verification-gap) converged on the same finding: the original Code Map's `clearContractById(creepId)` indexed `Memory.creeps` by Screeps object id. Verified against `node_modules/@types/screeps/index.d.ts:1771,3722` — `Memory.creeps`/`Game.creeps` are keyed by Creep **name**, not id, and `SnapshotCreep`/`CreepStub` carry no `name`. Every lookup would have missed in production; `validate` would still have reported the Contract as cleared while Memory stayed untouched — the whole story silently a no-op, undetectable by tests because every fixture used one string for both id and name.
  **Amended:** replaced the `state/contract.ts`-owned, Memory-indexing `clearContractById` with `world/creeps.ts`'s `clearCreepContract`, which resolves the live Creep via the already-existing, already-mocked `GameAdapter.getObjectById(id)` (previously unused anywhere in `src/`) and delegates to the unchanged `state/contract.ts#clearContract`. This sidesteps the id/name mismatch entirely — the engine resolves `.memory` correctly regardless of the Memory key — and, as a side effect, eliminates two more review findings for free: an unchecked-cast/`TypeError` risk on a corrupted `Memory.creeps` entry (no longer indexes Memory by hand), and an unverified-clear problem (the new function returns `boolean`, so `validate` only reports a jobId as cleared when a Creep was actually found).
  **Known-bad state avoided:** shipping a validator that reports success while never touching real `Memory`, and a colony that appears to work in every unit test while every Contract clear silently fails in the Screeps runtime.
  **KEEP:** the `findJob`-reuse design for "vanished/fulfilled" (no reviewer found fault with it); the `mine`-type exemption from all validation including TTL (deliberate — no `ttlFloor` policy exists for `mine` yet, so there is nothing to check); the TTL comparison `creep.ttl >= job.requirements.ttlFloor`; the `test/control/validate.test.ts` matrix-row/mixed-cohort/carry-invariance test structure (restage via `getObjectById` mocks instead of a hand-keyed Memory object, but keep the same scenarios); the `test/control-cycle.test.ts` end-to-end wiring test (strengthen with a pre-clear count assertion via a `validate` spy, per the verification-gap finding that the original only checked the post-release count).
  **Also folded in** (cheap, bundled with this re-derivation, not separate findings requiring their own loopback): one-line doc clarity on `_takenSet` being unused; a `[control]`-prefixed log line on the no-snapshot early return, matching `taken.ts`'s existing pattern.
  **Deferred** (real but not this story's blocking scope — see `deferred-work.md`): `validate` clears Memory but leaves the current Tick's `snapshot.creep.contract` set, which could matter once Story 3.4's `match` reads snapshot Contracts for idleness; a Spawning Creep's `ttl` mapping to `0` could prematurely clear a non-mine Contract, though structurally no such Contract exists yet (only mine Reserved Contracts are written at spawn time, and those are exempt); `findJob`'s linear scan (pre-existing since Story 2.2, not introduced here); test fixture duplication of `createCreep`/`createMockGame` across test files.
  **Rejected:** a `Record<JobType, Validator>` dispatch table (premature abstraction for three branches at MVP scale); narrowing the `mine` exemption to skip only the depletion check (the spec already says "exempt from all validation," and there is no TTL policy value to check against for `mine` yet).

- **2026-08-13, loop 2 (bad_spec):** Re-review of the loop-1 fix surfaced two findings, one architectural and one correctness:
  1. **Wrong module.** `_bmad-output/planning-artifacts/architecture/.../ARCHITECTURE-SPINE.md`'s Capability→Architecture Map assigns "PRD §4.2 Contract Lifecycle" to `agents/validators + state/`, and its module tree explicitly names `agents/validators.ts` for "per-type Contract validation (AD-4)". That file already exists in the repo as a one-line stub — never investigated during loop-1 planning, since the original Code Map searched only `control/`, `board/`, `world/`, and `state/`. Presented to Fliko as a decision (spine-mandated placement vs. the already-wired `control/validate.ts` precedent from Story 1.4/3.2, given the spine's file tree is also missing `control/taken.ts` and `control/metering.ts` — both real, committed modules); resolved as **relocate to `agents/validators.ts`**.
  2. **Spawning-Creep false-clear**, independently found by all three review layers again: `game.ts` maps `ttl: creep.ticksToLive ?? 0`, so a Creep still Spawning reports `ttl: 0` — indistinguishable, in the current snapshot shape, from a Creep in its last tick of natural life. The naive `ttl < ttlFloor` check (`0 < 200` for fill/build) would clear a just-written Reserved Contract on a Spawning Creep every Tick, precisely the FR-16/FR-29 failure the taken-set phase exists to prevent. This was flagged in Story 3.2's own Dev Notes ("Story 3.3 ttlFloor checks must account for this") and missed in loop 1's spec.
  **Amended:** per-type rules move into `agents/validators.ts` as a pure `isContractValid(type, job, ttl)` function over a `Record<JobType, rule>` table (mirrors `config.ts`'s `JOB_POLICY_TABLE` shape); `control/validate.ts` becomes a thin orchestrator that calls it and performs the clear, mirroring `control/generate.ts` + `world/producers/*`'s existing orchestrator/pure-rule split. Every non-mine rule treats `ttl === 0` as valid rather than clearable.
  **Known-bad state avoided:** shipping code that lives in a module the architecture explicitly assigns elsewhere (confusing future stories that follow the spine), and a validator that revokes Reserved Contracts from Creeps the instant they're spawned.
  **KEEP:** everything loop 1 kept, plus `world/creeps.ts`'s `getObjectById`-based resolution (unchanged, only gained a `"memory" in creep` guard) and the `getBoard()` no-Board defensive bail-out (new, cheap, same shape as the existing no-snapshot guard).
  **Deferred** (unchanged from loop 1, plus): `findJob`'s linear scan; test fixture duplication; `validate` leaving `snapshot.creep.contract` set post-clear (Story 3.4's concern).
  **Rejected:** over-subscription enforcement in `validate` (explicitly Matching/claim-lock territory, Story 3.4); comparing the resolved live Creep's current `memory.contract` against the jobId being cleared before deleting (no writer can race `validate` within a single synchronous `loop()` call under the established AD-9 ordering — spawn, the only other Contract-writing phase, runs after validate).

- **2026-08-13, loop 3 review (patch, no revert):** Third round of review found no architectural or frozen-intent issues — the `agents/validators.ts` relocation and `world/creeps.ts` seam both held. Applied as in-place patches rather than a spec amendment: replaced the `ttl === 0` Spawning-Creep proxy with the real `Creep.spawning: boolean` signal (three independent reviewer mentions across loops 2–3 converged on this; the old proxy also wrongly spared a genuinely-dying, non-spawning Creep at `ttl === 0`); corrected `clearCreepContract`'s doc comment (its boolean means "id resolved," not "Memory changed"); added a warning log for an unresolvable Contracted Creep; removed a redundant no-snapshot log already emitted by `main.ts`'s `deriveTakenSet` phase; trimmed `agents/validators.ts`'s header to stop overclaiming forward-compatibility the `(job, ttl, spawning)` rule signature can't deliver (a real `mine` rule needs Source data) and to match its "conditions" enumeration to the actual three-way logic; documented that a post-clear `snapshot.creeps[i].contract` stays stale for the rest of the Tick. Five findings judged real but out of this story's scope were appended to `deferred-work.md` (FR-4 body-capability checks, snapshot staleness for Story 3.4, test-fixture duplication, an integration-level test for `releaseContracts`' partial-decrement path, and orphaned malformed-Contract strings in Memory). No task list or Boundaries changes.

## Design Notes

`findJob` already encodes "target still needs work": `produceFill` skips full structures, `produceBuild` posts one Job per site (finished sites vanish from `FIND_CONSTRUCTION_SITES` on their own), `produceUpgrade` posts iff the controller exists. So "vanished" and "fulfilled" collapse into one check — `findJob(contract.jobId) === undefined` — no need to re-read `energy`/`progress`. TTL floor comes from the same `Job.requirements.ttlFloor`, so one Board lookup answers both AC conditions.

Two small additions while implementing: give `validate`'s docstring one line noting `_takenSet` is unused (kept only for phase-signature uniformity with `match`), and log a `[control]`-prefixed line on the no-snapshot early return, matching the existing pattern in `taken.ts`'s deriveTakenSet.

## Verification

**Commands:**
- `npm run typecheck` -- expected: clean
- `npm run lint` -- expected: clean
- `npm test` -- expected: all pass, story's new tests included
- `npm run build` -- expected: `dist/main.js` builds without error

## Suggested Review Order

**Per-type validation rules**

- Entry point: the pure decision function every Contract passes through — mine exempt, job-absent invalid, else the type's rule.
  [`validators.ts:55`](../../src/agents/validators.ts#L55)

- The rule itself — `spawning` (not `ttl === 0`) is what spares a still-spawning Creep; a genuinely dying Creep at ttl 0 still clears.
  [`validators.ts:33`](../../src/agents/validators.ts#L33)

**Control-cycle orchestration**

- Thin AD-9 phase shim: reads the snapshot, asks `validators.ts` for a verdict, clears via `world/creeps.ts`, returns what it released.
  [`validate.ts:23`](../../src/control/validate.ts#L23)

- Defensive bail-outs — no snapshot or no Board means nothing was validated, not that every Contract vanished.
  [`validate.ts:28`](../../src/control/validate.ts#L28)

**Memory-write seam**

- Resolves the live Creep by id via `getObjectById`, not by indexing `Memory.creeps` (which Screeps keys by name, not id).
  [`creeps.ts:24`](../../src/world/creeps.ts#L24)

**Spawning signal plumbing**

- `Creep.spawning` flows from the Game adapter into the snapshot so `validate` doesn't have to infer it from `ttl`.
  [`game.ts:131`](../../src/game.ts#L131)
  [`snapshot.ts:140`](../../src/world/snapshot.ts#L140)

**Tests**

- Per-type rule matrix, including the spawning/dying-at-ttl-0 distinction that motivated the `spawning` signal.
  [`validators.test.ts`](../../test/agents/validators.test.ts)

- `validate()` against every I/O-matrix row plus the no-Board guard and mixed-cohort case.
  [`validate.test.ts`](../../test/control/validate.test.ts)

- The Memory-write seam in isolation — resolved vs. unresolvable vs. memory-less objects.
  [`creeps.test.ts`](../../test/world/creeps.test.ts)

- End-to-end: `loop()` clears a real Contract and releases it from the taken-set before `match` runs.
  [`control-cycle.test.ts:263`](../../test/control-cycle.test.ts#L263)

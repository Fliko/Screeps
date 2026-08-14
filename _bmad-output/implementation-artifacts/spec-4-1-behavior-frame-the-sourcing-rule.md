---
title: 'Story 4.1: Behavior Frame & the Sourcing Rule'
type: 'feature'
created: '2026-08-13'
status: 'done'
baseline_revision: 45ab53b5e1cd6ed1c0bf2fed77d882898dbbcbce
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Epic 4's behaviors (fill/build/upgrade, Stories 4.2-4.4) each need to decide, every
Tick, whether a Contracted Generalist should harvest energy or serve its Contract's target. Without
one shared, pure decision function, each behavior file would re-derive this "source iff empty,
serve otherwise" rule independently, risking drift and the anti-ping-pong bug (a partially-loaded
Creep bouncing back to the Source instead of finishing its delivery).

**Approach:** Add one pure, shared sourcing-decision helper in `agents/` that every future
behavior file will call: given a Creep's current carry amount, derive whether it should source
(harvest, when carry is exactly `0`) or serve (any nonzero carry) — never stored, always
recomputed from live carry state each Tick.

## Boundaries & Constraints

**Always:**
- The decision is a pure function of `carry` alone (a single `number`) — no Game reads, no Memory
  access, no Job/Contract awareness. Mirrors `agents/validators.ts`'s and
  `world/producers/*`'s established pure-module convention in this codebase.
- "Source" fires only when `carry === 0` exactly — not "below some threshold." A Creep at 45/50
  capacity must derive "serve," never "source" (the anti-ping-pong predicate named in the AC).
- Live in `src/agents/` (sibling to `movement.ts` and `validators.ts`), not inside
  `agents/behaviors/` — this is shared infrastructure future behavior files will import, not a
  per-Job-type behavior itself.

**Block If:** None — this is a small, mechanical, pure-function addition with one unambiguous
shape given the epic context's Technical Decisions.

**Never:**
- Do not create `agents/behaviors/` or any per-Job-type behavior file (`fill.ts`, `build.ts`,
  `upgrade.ts`) — those are Stories 4.2-4.4.
- Do not call `agents/movement.ts#moveCreep` or any Screeps intent (`harvest`, `transfer`,
  `build`, `upgradeController`) from this story's code — this story adds the pure decision only;
  wiring it to real actions and movement is each subsequent behavior story's job.
- Do not wire this helper into `main.ts` or the control cycle — `agents/` behaviors have no
  caller until Epic 4's behavior files exist.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty carry | `carry: 0` | Derives "source" | No error expected |
| Partial carry (anti-ping-pong) | `carry: 45` (of e.g. 50 capacity) | Derives "serve" | No error expected |
| Full carry | `carry: 50` | Derives "serve" | No error expected |
| Minimum nonzero carry | `carry: 1` | Derives "serve" | No error expected |

</intent-contract>

## Code Map

- `src/agents/validators.ts` -- the pure-module convention to mirror: no Game reads, plain-data
  input, JSDoc explaining the rule's rationale (lines 1-21 for the module-level pattern).
- `src/agents/movement.ts` -- sibling `agents/` module; confirms the `agents/` directory's role
  (executors) and that pure helpers alongside stateful ones is the established shape.
- `test/agents/validators.test.ts` -- test-file convention to mirror for
  `test/agents/sourcing.test.ts` (plain-data assertions, no `setGame`/`setMemory`).

## Tasks & Acceptance

**Execution:**
- `src/agents/sourcing.ts` -- new file exporting a `SourcingPhase` string-union type (`"source" |
  "serve"`, no runtime enum per project convention) and a `deriveSourcingPhase(carry: number):
  SourcingPhase` pure function implementing `carry === 0 ? "source" : "serve"` -- the single
  shared decision every future behavior file will call
- `test/agents/sourcing.test.ts` -- new file; unit-test all four I/O matrix rows directly against
  `deriveSourcingPhase` with plain numbers, explicitly naming the `carry: 45` case as pinning the
  anti-ping-pong predicate per the story's AC

**Acceptance Criteria:**
- Given a Creep with `carry === 0`, when `deriveSourcingPhase` runs, then it returns `"source"`
- Given a Creep with any `carry > 0` (including a partially-loaded Creep, e.g. `45`), when
  `deriveSourcingPhase` runs, then it returns `"serve"` -- never "source" -- with no stored phase
  anywhere (the function takes no Memory-backed state)
- Given `src/agents/sourcing.ts`, when grepped for `Game`, `Memory`, `moveCreep`, or any Screeps
  intent name, then zero matches remain (purity, AD-1/AD-4 role discipline)

## Spec Change Log

<!-- Empty until the first bad_spec loopback. -->

## Review Triage Log

### 2026-08-13 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1 (low 1, medium 0, high 0)
- defer: 0
- reject: 11
- addressed_findings:
  - `[low]` `[patch]` Added `@returns` JSDoc tag to `deriveSourcingPhase`, describing what the
    returned `SourcingPhase` value represents.

## Design Notes

The function name and union type intentionally echo "phase" language used elsewhere in this
codebase for values that are derived, never stored (e.g. Contract validation, era derivation).
`SourcingPhase` is not persisted to `creep.memory` anywhere — it exists only as a return value
computed fresh each call, which is the entire point of the anti-ping-pong AC: there is no state to
get stuck in a bad phase, only a carry number to re-read every Tick.

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with no errors
- `npm run lint` -- expected: `biome check` passes on all touched files
- `npm run test` -- expected: all tests pass, including the new `sourcing.test.ts` suite
- `npm run build` -- expected: `dist/main.js` builds successfully

## Auto Run Result

**Summary:** Added `src/agents/sourcing.ts`, exporting a `SourcingPhase` string-union type
(`"source" | "serve"`) and the pure `deriveSourcingPhase(carry: number): SourcingPhase` function —
the single shared decision every Epic 4 behavior (Stories 4.2-4.4) will call to decide whether a
Contracted Generalist should harvest or serve, derived fresh from carry state each Tick with no
stored phase. Mirrors `agents/validators.ts`'s established pure-module convention.

**Files changed:**
- `src/agents/sourcing.ts` (new) -- `SourcingPhase` type + `deriveSourcingPhase` pure function
- `test/agents/sourcing.test.ts` (new) -- 4 tests covering all I/O matrix rows, including the
  anti-ping-pong predicate (`carry: 45` → `"serve"`, not `"source"`)

**Review findings breakdown:**
- Patches applied: 1 (low severity) — added missing `@returns` JSDoc tag
- Items deferred: 0
- Items rejected: 11 — theoretical inputs outside the real Screeps domain (NaN, negative,
  fractional carry — `game.ts`'s `creep.carry.energy ?? 0` never produces these), integration
  points explicitly deferred to Stories 4.2-4.5 (multi-tick behavior test, consuming code,
  "shared" claim demonstration), and documentation conventions not used elsewhere in this codebase
  (`@see` cross-references, purity-verifying lint checks)

**Follow-up review recommendation:** `false` — 1 low-severity patch this pass, score = 3×0 + 1×1 =
1 (< 5 threshold), no high-severity patches.

**Verification performed:** `npm run typecheck` ✓, `npm run lint` ✓ (48 files), `npm run test` ✓
(209/209, 22 files), `npm run build` ✓ (`dist/main.js`, 17.6kb). All re-run and confirmed after the
patch pass.

**Residual risks:** None identified. This module is deliberately uncalled infrastructure — the
intent-alignment audit confirmed zero callers exist anywhere in the repo, consistent with the
spec's Never-section scope (no `agents/behaviors/`, no movement/intent calls, no control-cycle
wiring). Stories 4.2-4.4 will be the first consumers.

**Blocking condition:** `finalization left repository dirty` — not a git failure. This project's
persistent rule (loaded at session start, hook-enforced) forbids AI agents from running any
git-mutating command, including `commit`; the human performs every commit. The implementation work
above is complete, verified, and reviewed — only the commit ceremony is blocked pending human
action. Working tree at halt: `src/agents/sourcing.ts` and `test/agents/sourcing.test.ts` new/
untracked, this spec file and `epic-4-context.md` untracked. (The Story 3.6 blocked-result file
from earlier in this run remains untracked too — separate, unrelated artifact.)

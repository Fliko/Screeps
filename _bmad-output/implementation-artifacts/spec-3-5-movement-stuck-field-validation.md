---
title: 'Movement Choke Point — stuck Field Validation (Story 3.5, round 3)'
type: 'bugfix'
created: '2026-08-13'
status: 'blocked'
baseline_revision: 1144c4083cb2b620507486bc80cde097af694e59
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred:
  - summary: >-
      setMoveState has no write-time validation, asymmetric with getMoveState's read-time
      guards — a caller could persist an invalid stuck (negative/fractional) or lastPos, relying
      entirely on the next read to catch it.
    evidence: |-
      Blind-hunter lens flagged this on review of the stuck validation fix. Real design gap, but
      out of this spec's scope — the intent's Approach section explicitly scopes the change to
      getMoveState only ("Extend getMoveState's stuck validation..."), so extending setMoveState
      would exceed the stated approach, not merely a spec boundary choice.
    location: >-
      src/state/move.ts:66-71 (setMoveState)
    severity: medium
  - summary: >-
      moveCreep's stuck++/= 0 write logic in agents/movement.ts is not integration-tested to
      confirm it can never itself produce a negative or fractional stuck value that would then
      round-trip and get rejected by getMoveState's new guard.
    evidence: |-
      Blind-hunter lens and intent-alignment auditor both noted the justification for the stuck
      guard rests on moveCreep's behavior, but no test in test/agents/movement.test.ts exercises
      that claim directly. Pre-existing gap (moveCreep's increment/reset logic predates this
      spec and is already covered by its own existing tests), not caused by this narrow
      read-time-validation change.
    location: >-
      src/agents/movement.ts (moveCreep)
    severity: low
  - summary: >-
      No test exercises getMoveState with a non-number stuck (e.g. a string or null) to confirm
      the pre-existing typeof guard still behaves as documented after the new integer/range
      checks were added alongside it.
    evidence: |-
      Blind-hunter lens flagged this gap. The typeof check predates this spec (Story 3.5's
      original hardening pass); this spec only added the integer/non-negative checks next to it.
      Not caused by this diff, surfaced incidentally by the review.
    location: >-
      src/state/move.ts:45-48 (getMoveState)
    severity: low
---

<intent-contract>

## Intent

**Problem:** `getMoveState` in `src/state/move.ts` validates `lastPos` for finiteness, integer-
ness, and range (`[0, 2499]`), but its sibling field `stuck` is only checked for
`typeof === "number" && Number.isFinite(...)` — a corrupted `stuck` (negative or fractional)
still passes validation and is returned as a valid `MoveState`, unlike the now-hardened
`lastPos`. `stuck` is a Tick counter (`moveCreep` in `src/agents/movement.ts` only ever
increments it from `0` or resets it to `0`), so it has the same closed, well-defined valid range
as `lastPos` does — this was surfaced as a real gap by review but deferred as new scope.

**Approach:** Extend `getMoveState`'s `stuck` validation to also require `Number.isInteger(...)`
and `state.stuck >= 0`, mirroring the exact guard shape already used for `lastPos`.

## Boundaries & Constraints

**Always:**
- Keep `getMoveState`'s "malformed → return `undefined`" contract; an invalid `stuck` returns
  `undefined` exactly like an invalid `lastPos` already does — never clamp or round it.
- `stuck` has no upper bound (unlike `lastPos`'s `2499`) — `moveCreep` compares it against a
  config-driven, mutable `MOVEMENT_STUCK_THRESHOLD`, so only non-negative-integer is enforced,
  not a fixed ceiling.

**Block If:** None — this is a mechanical extension of an already-approved validation pattern.

**Never:**
- Do not touch `lastPos`'s validation, `moveCreep`, or any config shape — this spec's only
  surface is the `stuck` guard inside `getMoveState`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valid `stuck` | `stuck: 0` or `stuck: 5` | `getMoveState` returns the state unchanged | No error expected |
| Negative `stuck` | `stuck: -1` | `getMoveState` returns `undefined` | No error expected |
| Fractional `stuck` | `stuck: 2.5` | `getMoveState` returns `undefined` | No error expected |

</intent-contract>

## Code Map

- `src/state/move.ts` -- `getMoveState`'s `stuck` check (lines 44-47) currently requires only
  `typeof === "number" && Number.isFinite(...)`; extend in place with `Number.isInteger(...) &&
  state.stuck >= 0`, mirroring the `lastPos` guard shape at lines 52-59 in the same function. Also
  update the function's doc comment (lines 25-36) and the `MoveState` interface's doc comment
  (lines 10-19), which currently describe `stuck`'s validation as weaker than `lastPos`'s and need
  to state the new non-negative-integer requirement.
- `test/state/move.test.ts` -- `describe("getMoveState", ...)` block (lines 5-59) already has the
  `lastPos` boundary-case pattern to mirror for the new `stuck` cases.

## Tasks & Acceptance

**Execution:**
- `src/state/move.ts` -- extend the `stuck` validation `if` to also require
  `Number.isInteger(state.stuck) && state.stuck >= 0`
- `src/state/move.ts` -- update the `getMoveState` and `MoveState` doc comments to state that
  `stuck` must be a non-negative integer, not just a finite number
- `test/state/move.test.ts` -- add cases: `stuck: -1` returns `undefined`; `stuck: 2.5` returns
  `undefined`; `stuck: 0` (existing coverage — confirm it survives) and a large valid `stuck`
  (e.g. `stuck: 100`) both return the state unchanged

**Acceptance Criteria:**
- Given `creep.memory.move.stuck` is `-1` or `2.5`, when `getMoveState` runs, then it returns
  `undefined`
- Given `creep.memory.move.stuck` is `0` or any positive integer, when `getMoveState` runs, then
  it returns the state unchanged
- Given the existing movement/state test suite, when it runs after this change, then all prior
  assertions still pass unmodified in behavior

## Spec Change Log

<!-- Empty until the first bad_spec loopback. -->

## Review Triage Log

### 2026-08-13 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (low 2, medium 0, high 0)
- defer: 3 (medium 1, low 2)
- reject: 5
- addressed_findings:
  - `[low]` `[patch]` Added `stuck: NaN` and `stuck: Infinity` test cases to `test/state/move.test.ts`, mirroring the existing `lastPos` NaN/Infinity coverage.
  - `[low]` `[patch]` Updated the `MoveState` interface JSDoc to note `stuck: 0` is a valid steady-state value, mirroring `lastPos`'s existing "falsy but valid" callout.

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with no errors
- `npm run lint` -- expected: `biome check` passes on all touched files
- `npm run test` -- expected: all tests pass, including new `stuck` validation cases
- `npm run build` -- expected: `dist/main.js` builds successfully

## Auto Run Result

**Summary:** Extended `getMoveState`'s `stuck` field validation to require a non-negative integer,
mirroring the guard shape already used for `lastPos` (Story 3.5's second hardening round). Closes
the last remaining item in `deferred-work.md` for the movement choke point's `lastPos` hardening
lineage. Review surfaced two low-severity gaps in this pass, both patched; three additional
findings were legitimately out of this spec's Approach-defined scope and deferred.

**Files changed:**
- `src/state/move.ts` -- extended `stuck` validation with `Number.isInteger(...) && >= 0`; updated
  `MoveState` interface and `getMoveState` doc comments to document the new requirement and that
  `0` is a valid steady-state value
- `test/state/move.test.ts` -- added 6 cases: `stuck` negative, non-integer, `0`, large valid
  integer, `NaN`, `Infinity`

**Review findings breakdown:**
- Patches applied: 2 (both low severity) — NaN/Infinity test parity, JSDoc `0`-is-valid note
- Items deferred: 3 — `setMoveState` write-time validation asymmetry (medium), `moveCreep`
  integration test for the self-heal claim (low), non-number `stuck` test gap (low)
- Items rejected: 5 — missing upper bound (resolved: no natural ceiling for a Tick counter, single
  dominant reading confirmed by intent-alignment audit), combined-corruption test (redundant,
  short-circuit already proven safe), two-guards style nit (intentional, matches `lastPos`
  pattern), changelog/migration note (no project convention, corruption self-heals harmlessly),
  `setMoveState` rejection test (folds into the deferred write-path design question)

**Follow-up review recommendation:** `false` — 2 low-severity patches this pass, score = 3×0 + 1×2
= 2 (< 5 threshold), no high-severity patches.

**Verification performed:** `npm run typecheck` ✓, `npm run lint` ✓ (46 files, no fixes needed),
`npm run test` ✓ (205/205, 21 files), `npm run build` ✓ (`dist/main.js`, 17.6kb). All commands
re-run and confirmed after the patch pass.

**Residual risks:** None identified for this change's own surface. The three deferred items are
real but independently scoped — see `deferred-work.md` and this spec's `deferred` frontmatter for
follow-up.

**Blocking condition:** `finalization left repository dirty` — not a git failure. This project's
persistent rule (loaded at session start, hook-enforced) forbids AI agents from running any
git-mutating command, including `commit`; the human performs every commit. The implementation work
above is complete, verified, and reviewed — only the commit ceremony is blocked pending human
action. Working tree at halt: `src/state/move.ts` and `test/state/move.test.ts` modified, this spec
file untracked.

---
title: 'Movement Choke Point — Deferred Cleanup (Story 3.5, round 2)'
type: 'bugfix'
created: '2026-08-13'
status: 'done'
baseline_commit: 3a8cd53bd887e43bdb36f5b6adddf715fd3dae44
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Two prior review rounds on the movement choke point (Story 3.5, then its own
hardening spec) deferred four small items to `deferred-work.md` rather than growing either spec
past its token budget: loose test assertions that wouldn't catch a `reusePath`/`packPos`
regression, an unused `_unpackPos` function, a missing README statement of `moveCreep`'s
single-call-site rule, and `lastPos` accepting any finite number instead of only valid packed
positions.

**Approach:** Close all four. Tighten `test/agents/movement.test.ts`'s `objectContaining`/
`expect.any(Number)` assertions to exact values. Delete `_unpackPos`. Add one sentence to
README's Movement note. Extend `getMoveState`'s `lastPos` validation to also require an integer
in `[0, 2499]` (the full packed-position range for a 50×50 room).

## Boundaries & Constraints

**Always:**
- Keep `getMoveState`'s "malformed → return `undefined`" contract; an out-of-range or fractional
  `lastPos` returns `undefined` exactly like NaN/Infinity already does — never silently clamp or
  round it into range.
- Preserve every existing test's asserted behavior — tightening an assertion changes what it
  checks, not what the code under test does.
- No change to `moveCreep`'s public signature, escalation state machine, or config shape.

**Ask First:** None.

**Never:**
- Do not wire `moveCreep` into `main.ts` or any behavior — still zero callers.
- Do not add a lint rule enforcing the single-call-site rule — README documentation only, per the
  original deferred scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| `lastPos` at range boundary | `lastPos: 0` (x=0,y=0) or `lastPos: 2499` (x=49,y=49) | `getMoveState` returns the state unchanged | N/A |
| `lastPos` out of range | `lastPos: 2500` or `lastPos: -1` | `getMoveState` returns `undefined` | N/A |
| `lastPos` non-integer | `lastPos: 12.5` | `getMoveState` returns `undefined` | N/A |

</frozen-after-approval>

## Code Map

- `src/state/move.ts` -- `getMoveState`'s `lastPos` check (lines 44-47) currently only requires
  `typeof === "number" && Number.isFinite(...)`; extend with `Number.isInteger(...)` and a
  `0 <= lastPos <= 2499` range check, mirroring the existing two-guard style in the same function.
- `src/agents/movement.ts` -- `_unpackPos` (lines 26-37) is the dead code to delete; `packPos`
  (lines 16-24) and `moveCreep` (lines 60-110) are untouched.
- `test/agents/movement.test.ts` -- two assertions to tighten: "uses default opts" (line 114,
  `expect.objectContaining({ ignoreCreeps: false })` → exact `{ reusePath: 5, ignoreCreeps: false
  }`) and "escalates to repath opts" (line 133, same pattern → `{ reusePath: 5, ignoreCreeps: true
  }`); "ignores provided opts when escalation is triggered" (line 186) has the same pattern and
  should be tightened identically for consistency.
- `README.md` -- "Movement note" section (lines 23-25) is the anchor; append one sentence.
- `test/state/move.test.ts` -- add new range/integer test cases alongside the existing NaN/
  Infinity/`lastPos: 0` cases (that file's `describe("getMoveState", ...)` block).

## Tasks & Acceptance

**Execution:**
- [x] `src/state/move.ts` -- extend the `lastPos` validation to also require
  `Number.isInteger(state.lastPos) && state.lastPos >= 0 && state.lastPos <= 2499`
- [x] `test/state/move.test.ts` -- add cases: `lastPos: 2499` (max valid) returns state unchanged,
  `lastPos: 2500` returns `undefined`, `lastPos: -1` returns `undefined`, `lastPos: 12.5`
  (non-integer) returns `undefined`
- [x] `src/agents/movement.ts` -- delete `_unpackPos` (function + its doc comment) entirely
- [x] `test/agents/movement.test.ts` -- tighten the three `expect.objectContaining({ ignoreCreeps:
  ... })` assertions (lines ~114, ~133, ~186) to exact-value `toHaveBeenCalledWith(target, {
  reusePath: 5, ignoreCreeps: false })` / `{ reusePath: 5, ignoreCreeps: true }` as appropriate
- [x] `README.md` -- append to the existing Movement note: all creep movement must call
  `moveCreep` from `agents/movement.ts`; no direct `moveTo`/`move`/`moveByPath` calls elsewhere

**Acceptance Criteria:**
- Given `creep.memory.move.lastPos` is `2500`, `-1`, or `12.5`, when `getMoveState` runs, then it
  returns `undefined`
- Given `creep.memory.move.lastPos` is `0` or `2499`, when `getMoveState` runs, then it returns
  the state unchanged
- Given `src/agents/movement.ts`, when grepped for `_unpackPos`, then zero matches remain
- Given the existing movement test suite, when it runs after these changes, then all prior Story
  3.5 and hardening-pass assertions still pass unmodified in behavior

## Spec Change Log

<!-- Empty until the first bad_spec loopback. -->

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with no errors
- `npm run lint` -- expected: `biome check` passes on all touched files
- `npm run test` -- expected: all tests pass, including new range/integer cases for `lastPos`
- `npm run build` -- expected: `dist/main.js` builds successfully

## Suggested Review Order

**Range/Integer Validation (the correctness fix)**

- Entry point: extends the existing NaN/Infinity guard to reject out-of-range or fractional values.
  [`move.ts:52-59`](../../src/state/move.ts#L52)

- Interface doc now states the read-time contract explicitly, closing the doc-sync gap the review found.
  [`move.ts:10-19`](../../src/state/move.ts#L10)

**Dead Code Removal**

- `_unpackPos` deleted — confirmed zero references repo-wide before removal.
  [`movement.ts:23`](../../src/agents/movement.ts#L23)

**Documentation**

- One sentence closes AC1's single-call-site rule, previously only enforceable by manual grep.
  [`README.md:25`](../../README.md#L25)

**Verification**

- Four boundary cases (2499 valid, 2500/-1 invalid, 12.5 non-integer) pin the new range check.
  [`test/state/move.test.ts:35-58`](../../test/state/move.test.ts#L35)

- Three assertions tightened from `objectContaining` to exact values — closes a broken-verification gap.
  [`test/agents/movement.test.ts:111-137`](../../test/agents/movement.test.ts#L111)

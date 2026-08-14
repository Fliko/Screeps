---
title: 'Movement Choke Point — Review Hardening (Story 3.5 follow-up)'
type: 'bugfix'
created: '2026-08-13'
status: 'done'
baseline_commit: 9c5f8e7aa8bb63e2ea3cddd51afd7e569f812e84
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 3.5's movement choke point (commit 9c5f8e7) shipped with two correctness gaps
a three-lens review confirmed: `getMoveState` validates `stuck` but not `lastPos`, so corrupted
memory (`NaN`/`Infinity`) silently disables stuck detection forever instead of self-healing; and
`MOVEMENT_STUCK_THRESHOLD` and the two `MoveToOpts` constants are unguarded config, so a bad edit
(e.g. threshold `0`, a missing `reusePath`) breaks escalation with no signal until it misbehaves
in the sim room.

**Approach:** Harden `state/move.ts`'s `getMoveState` to validate `lastPos` the same way it
already validates `stuck`. Add an exported, testable guard in `config.ts` that fails fast at
module load if `MOVEMENT_STUCK_THRESHOLD` is not a positive integer, or if either `MoveToOpts`
constant is missing `reusePath`/`ignoreCreeps`.

## Boundaries & Constraints

**Always:**
- Preserve `moveCreep`'s existing public signature and return-value contract (unchanged from
  Story 3.5) — this is a hardening pass, not a redesign.
- Keep `getMoveState`'s "malformed → treat as absent" contract; a corrupted `lastPos` should
  make the function return `undefined` (self-heals to a fresh state next call), exactly like the
  existing `stuck` validation already does.
- Config guard runs at constant-definition time (module load), not on every `getConstant` call —
  match the fail-fast style already used for `Unknown config constant` in `getConstant`.
- No behavior change to the escalation state machine (AC1–AC6 of Story 3.5 remain satisfied
  unmodified) — only added validation.

**Ask First:** None — both fixes are mechanical hardening with a single correct shape.

**Never:**
- Do not add `lastPos` range-clamping (0–2499) as a *silent correction* — out-of-range is a
  validation failure (return `undefined`), not a value to coerce.
- Do not touch `_unpackPos`, test-assertion strictness, or README documentation — deferred to
  `deferred-work.md` to keep this spec to the critical correctness fixes only.
- Do not wire `moveCreep` into `main.ts` or any behavior — still zero callers per Story 3.5 scope.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Corrupted `lastPos` (NaN) | `creep.memory.move = { lastPos: NaN, stuck: 2 }` | `getMoveState` returns `undefined` | N/A (self-heals: `moveCreep` re-initializes state) |
| Corrupted `lastPos` (Infinity) | `creep.memory.move = { lastPos: Infinity, stuck: 0 }` | `getMoveState` returns `undefined` | N/A |
| Valid `lastPos` | `creep.memory.move = { lastPos: 1275, stuck: 1 }` | `getMoveState` returns the state unchanged | N/A |
| Config validation, threshold ≤ 0 or non-integer | `MOVEMENT_STUCK_THRESHOLD: 0`, `-1`, or `2.5` | `validateMovementConfig` throws | Thrown `Error` naming the bad constant |
| Config validation, opts missing a key | `MOVEMENT_DEFAULT_OPTS` missing `reusePath` | `validateMovementConfig` throws | Thrown `Error` naming the bad constant |
| Config validation, valid config | Current shipped `constants` object | `validateMovementConfig` does not throw | N/A |

</frozen-after-approval>

## Code Map

- `src/state/move.ts` -- `getMoveState` (lines 30-42) validates `stuck` only; add the same
  `Number.isFinite` guard for `lastPos` in the same `if` this function already has.
- `src/config.ts` -- `constants` object (lines 53-92) is the module-load site; add an *exported*
  guard function (testable directly with crafted input, per project convention of testing pure
  functions over plain data) called once against `constants` right after it's built.
- `test/state/move.test.ts` -- sibling file for new `getMoveState` invalid-`lastPos` tests,
  mirroring the existing invalid-`stuck` coverage pattern the validation already implies.
- `test/config.test.ts` -- new file; unit-tests `validateMovementConfig` directly.

## Tasks & Acceptance

**Execution:**
- [x] `src/state/move.ts` -- extend `getMoveState`'s validation `if` to also require
  `typeof state.lastPos === "number" && Number.isFinite(state.lastPos)` -- closes the
  cross-lens-confirmed gap (adversarial, edge-case-hunter, verification-gap all flagged it)
- [x] `src/config.ts` -- add an exported `validateMovementConfig(config: Config): void` (or
  similarly named) function; throws if `MOVEMENT_STUCK_THRESHOLD` is not a positive integer, or
  if `MOVEMENT_DEFAULT_OPTS`/`MOVEMENT_REPATH_OPTS` lack `reusePath`/`ignoreCreeps`; call it once
  against `constants` immediately after `constants` is built, so a bad literal fails at module
  load, while tests can also call it directly with crafted `Config`-shaped objects
- [x] `test/state/move.test.ts` -- add two cases: `getMoveState` returns `undefined` when
  `lastPos` is `NaN`; returns `undefined` when `lastPos` is `Infinity`
- [x] `test/config.test.ts` (new file — none exists yet) -- unit-test `validateMovementConfig`
  directly with crafted `Config`-shaped objects: threshold `0` throws, threshold `-1` throws,
  threshold `2.5` (non-integer) throws, `MOVEMENT_DEFAULT_OPTS` missing `reusePath` throws,
  `MOVEMENT_REPATH_OPTS` missing `ignoreCreeps` throws, a valid config does not throw

**Acceptance Criteria:**
- Given `creep.memory.move.lastPos` is `NaN` or `Infinity`, when `getMoveState` runs, then it
  returns `undefined` (matching existing `stuck`-invalid behavior)
- Given `MOVEMENT_STUCK_THRESHOLD` is set to `0` or a negative number, when the config module
  loads, then it throws with a message naming the offending constant
- Given either `MoveToOpts` constant is missing `reusePath` or `ignoreCreeps`, when the config
  module loads, then it throws with a message naming the offending constant
- Given the existing movement test suite, when it runs after these changes, then all prior Story
  3.5 assertions (AC1–AC6) still pass unmodified in behavior

## Spec Change Log

<!-- Empty until the first bad_spec loopback. -->

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes with no errors
- `npm run lint` -- expected: `biome check` passes on all touched files
- `npm run test` -- expected: all tests pass, including new cases for `lastPos` validation and
  config guards
- `npm run build` -- expected: `dist/main.js` builds successfully

## Suggested Review Order

**Config Validation (the second correctness fix)**

- Entry point: fails fast at module load, catching bad config before it ever reaches runtime.
  [`config.ts:147`](../../src/config.ts#L147)

- Positive-integer threshold check with actual-value error message for debuggability.
  [`config.ts:104-119`](../../src/config.ts#L104)

- Per-opts loop rejects non-object opts, NaN/negative/Infinity reusePath, and missing keys.
  [`config.ts:121-145`](../../src/config.ts#L121)

**Memory Validation (the first correctness fix)**

- Extends the existing `stuck` guard to `lastPos`, self-healing corrupted memory to `undefined`.
  [`move.ts:44-47`](../../src/state/move.ts#L44)

**Verification**

- New file: exhaustive `validateMovementConfig` coverage — valid, shipped, and 9 invalid shapes.
  [`test/config.test.ts`](../../test/config.test.ts)

- `lastPos: 0` boundary case proves the falsy-but-valid position isn't misclassified as corrupt.
  [`test/state/move.test.ts:18`](../../test/state/move.test.ts#L18)

- NaN/Infinity `lastPos` cases confirm the new guard actually returns `undefined`.
  [`test/state/move.test.ts:23-33`](../../test/state/move.test.ts#L23)

**Process Trail**

- Three secondary findings (test strictness, dead code, README note) carved off per user's split choice.
  [`deferred-work.md`](../../deferred-work.md)

/**
 * AD-2: single owner of creep.memory.move schema.
 *
 * `state/` owns the shape, (de)serialization, and typed accessors for
 * `creep.memory.move`. The helper module `agents/movement.ts` reads and writes
 * movement state through `getMoveState` and `setMoveState`. No other module
 * directly accesses `creep.memory.move`.
 */

/**
 * The persisted movement state stored in `creep.memory.move`.
 *
 * AD-8: tracks position and stuck counter for the movement choke point.
 * `lastPos` is packed as `y * 50 + x` to save memory; `stuck` counts consecutive
 * Ticks with unchanged position and zero fatigue, triggering escalation at the
 * configured threshold. `getMoveState` enforces at read time that `lastPos` is
 * an integer in `[0, 2499]` (the valid packed-position range for a 50x50 room);
 * an out-of-range or fractional value is rejected, not silently accepted.
 * `stuck` is a Tick counter (only ever incremented from `0` or reset to `0`),
 * so it must be a non-negative integer; `stuck: 0` is a normal, valid
 * steady-state value (not moving/stuck yet), and a negative or fractional
 * value is rejected the same way.
 */
export interface MoveState {
  lastPos: number;
  stuck: number;
}

/**
 * Reads `creep.memory.move`.
 *
 * Returns the typed MoveState if the persisted object exists and has the
 * expected shape (with valid numeric `stuck` and `lastPos`), otherwise
 * returns `undefined`. Validates that `stuck` is a finite non-negative
 * integer, and that `lastPos` is a finite number, an integer, and in
 * `[0, 2499]` (the valid packed-position range for a 50x50 room) to prevent
 * NaN/Infinity/negative/out-of-range/fractional values from malformed memory
 * silently disabling stuck detection or decoding to a bogus position; a
 * corrupted value self-heals by causing the caller to re-initialize state on
 * the next call.
 */
export function getMoveState(creep: {
  memory: { move?: MoveState };
}): MoveState | undefined {
  const state = creep.memory.move;
  if (!state) {
    return undefined;
  }
  // Validate stuck is a number (not null/undefined/NaN from malformed memory).
  if (typeof state.stuck !== "number" || !Number.isFinite(state.stuck)) {
    return undefined;
  }
  // Validate stuck is a non-negative integer (it's a Tick counter that only
  // ever starts at 0 or increments).
  if (!Number.isInteger(state.stuck) || state.stuck < 0) {
    return undefined;
  }
  // Validate lastPos is a number (not null/undefined/NaN/Infinity from malformed memory).
  if (typeof state.lastPos !== "number" || !Number.isFinite(state.lastPos)) {
    return undefined;
  }
  // Validate lastPos is an integer in the valid packed-position range for a 50x50 room.
  if (
    !Number.isInteger(state.lastPos) ||
    state.lastPos < 0 ||
    state.lastPos > 2499
  ) {
    return undefined;
  }
  return state;
}

/**
 * Persists movement state to `creep.memory.move`.
 */
export function setMoveState(
  creep: { memory: { move?: MoveState } },
  state: MoveState,
): void {
  creep.memory.move = state;
}

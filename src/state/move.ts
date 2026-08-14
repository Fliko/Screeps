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
 * configured threshold.
 */
export interface MoveState {
  lastPos: number;
  stuck: number;
}

/**
 * Reads `creep.memory.move`.
 *
 * Returns the typed MoveState if the persisted object exists and has the
 * expected shape (with valid numeric `stuck`), otherwise returns `undefined`.
 * Validates that `stuck` is a number to prevent NaN from arithmetic operations.
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

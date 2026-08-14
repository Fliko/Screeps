/**
 * The movement choke point (AD-8).
 *
 * Every move in the codebase routes through `moveCreep`, wrapping `Creep.moveTo`
 * with explicit options and fatigue-aware stuck detection. A Creep whose position
 * is unchanged for N consecutive Ticks (with fatigue === 0) gets one re-path with
 * `ignoreCreeps: true`, then reverts to default options.
 *
 * This helper is the single call site for all movement intents (move/moveTo/moveByPath).
 * Story 3.5: helper and unit tests only — no behavior (Epic 4) or wiring to main.ts yet.
 */

import { getConstant } from "../config";
import { getMoveState, setMoveState } from "../state/move";

/**
 * Packs a position into a single number for memory storage.
 *
 * Formula: y * 50 + x (AD-8). Screeps rooms are 50x50, so x and y are both
 * in [0, 49], making this encoding lossless and compact.
 */
function packPos(pos: { x: number; y: number }): number {
  return pos.y * 50 + pos.x;
}

/**
 * Routes all creep movement through one helper with explicit options and stuck escalation.
 *
 * On each call:
 * 1. Read the stored movement state (or initialize if missing).
 * 2. Compute the current packed position.
 * 3. Update stuck counter:
 *    - If fatigue === 0 and position is unchanged: increment stuck.
 *    - If fatigue !== 0: leave stuck unchanged (AC3).
 *    - If position changed: reset stuck to 0.
 * 4. Escalation: when stuck >= threshold, use MOVEMENT_REPATH_OPTS (with ignoreCreeps: true),
 *    then reset stuck to 0 so the next call reverts to default opts.
 * 5. Normal path: call moveTo with opts (default if not provided).
 * 6. Always persist the updated state before returning.
 * 7. Return the moveTo result unchanged for caller error handling.
 *
 * @param creep Live Creep object (obtained from world/ by the caller).
 * @param target Destination RoomPosition.
 * @param opts Optional overrides for default movement options.
 * @returns ScreepsReturnCode from creep.moveTo, unchanged.
 */
export function moveCreep(
  creep: Creep,
  target: RoomPosition,
  opts?: MoveToOpts,
): ScreepsReturnCode {
  const state = getMoveState(creep) ?? { lastPos: -1, stuck: 0 };
  const currentPacked = packPos(creep.pos);

  // Update stuck counter.
  if (creep.fatigue === 0) {
    if (currentPacked === state.lastPos) {
      // Position unchanged and not fatigued: increment stuck.
      state.stuck++;
    } else {
      // Position changed: reset stuck.
      state.stuck = 0;
    }
  }
  // If fatigue > 0: leave stuck unchanged (do not advance, do not reset).

  // Determine which options to use and apply escalation logic.
  let moveOpts: MoveToOpts;
  if (state.stuck >= getConstant("MOVEMENT_STUCK_THRESHOLD")) {
    // Escalate: use repath options to force ignoreCreeps.
    const repathOpts = getConstant("MOVEMENT_REPATH_OPTS");
    if (!repathOpts) {
      throw new Error(
        "MOVEMENT_REPATH_OPTS config constant is missing or undefined",
      );
    }
    moveOpts = repathOpts;
    // Reset stuck so next call reverts to default opts.
    state.stuck = 0;
  } else {
    // Normal path: use provided opts or default.
    const defaultOpts = getConstant("MOVEMENT_DEFAULT_OPTS");
    if (!defaultOpts) {
      throw new Error(
        "MOVEMENT_DEFAULT_OPTS config constant is missing or undefined",
      );
    }
    moveOpts = opts ?? defaultOpts;
  }

  // Persist state before calling moveTo (read-then-write happens once per call).
  state.lastPos = currentPacked;
  setMoveState(creep, state);

  // Call moveTo and return the result unchanged.
  return creep.moveTo(target, moveOpts);
}

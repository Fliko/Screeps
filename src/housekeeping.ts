/**
 * Memory housekeeping — maintains Memory.creeps by removing entries for dead creeps.
 * Story 7.1: dead creeps are erased on first pass after death.
 */

import { getMemory } from "./memory";

/**
 * Scan Memory.creeps for dead creeps (present in Memory but not in Game.creeps)
 * and erase their entries. Runs once per Tick before the control cycle.
 * Returns count of creeps cleaned up.
 */
export function cleanupDeadCreeps(): number {
  try {
    const memory = getMemory();
    const creepsMemory = memory.creeps as
      | Record<string, CreepMemory>
      | undefined;

    if (!creepsMemory || typeof creepsMemory !== "object") {
      return 0;
    }

    let cleanedCount = 0;
    for (const [creepName] of Object.entries(creepsMemory)) {
      if (!(creepName in Game.creeps)) {
        delete creepsMemory[creepName];
        cleanedCount++;
      }
    }
    return cleanedCount;
  } catch (error) {
    console.log(
      `[housekeeping] cleanupDeadCreeps error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 0;
  }
}

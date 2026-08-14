/**
 * AD-10 world seam for live Creep objects.
 *
 * The only module in the Contract-validation path that touches the Game adapter.
 * Resolution goes through `getObjectById` deliberately: `Game.creeps` and
 * `Memory.creeps` are keyed by Creep *name*, while the world snapshot carries
 * only Screeps object *ids*, so any Memory-indexed lookup would silently miss.
 * The engine resolves `.memory` correctly from the live object regardless of the
 * Memory key. All Memory mutation is delegated to `state/contract.ts` (AD-2).
 */
import type { JobId } from "../board/job";
import { getGame } from "../game";
import { clearContract, setContract } from "../state/contract";

/**
 * Clears the Contract on the live Creep with `creepId`.
 *
 * The boolean reports reachability, not mutation: `true` means the id resolved
 * to a live, memory-bearing object whose Contract is now absent (a Creep that
 * held no Contract still returns `true`); `false` means the id resolved to
 * nothing — the Creep died or is no longer visible — or to an object without
 * `memory`. Callers use it so a Contract is only reported as released when the
 * Creep was actually reachable.
 */
export function clearCreepContract(creepId: string): boolean {
  const creep = getGame().getObjectById<Creep>(creepId);
  // Screeps ids are unique across object types, so a non-Creep hit is not a live
  // risk — the guard is belt-and-suspenders against a bad id reaching us.
  if (!creep || !("memory" in creep) || !creep.memory) {
    return false;
  }
  clearContract(creep);
  return true;
}

/**
 * Assigns a Contract for `jobId` to the live Creep with `creepId`.
 *
 * Symmetric to `clearCreepContract`: the boolean reports reachability, not
 * mutation intent — `true` means the id resolved to a live, memory-bearing
 * object whose Contract is now `jobId`; `false` means the id resolved to
 * nothing or to an object without `memory`. Callers (Story 3.4's `match`)
 * use this so a Contract is only reported as assigned when the Creep was
 * actually reachable.
 */
export function assignCreepContract(creepId: string, jobId: JobId): boolean {
  const creep = getGame().getObjectById<Creep>(creepId);
  if (!creep || !("memory" in creep) || !creep.memory) {
    return false;
  }
  setContract(creep, { jobId });
  return true;
}

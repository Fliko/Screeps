/**
 * AD-10 world seam for generic live-object resolution.
 *
 * Behaviors (Epic 4, e.g. `agents/behaviors/fill.ts`) need live Creep, Source,
 * and Structure references to issue Screeps intents (`harvest`, `transfer`,
 * `moveCreep`), but AD-10 forbids them from calling `getObjectById` directly.
 * This is the seam they go through instead — separate from `world/creeps.ts`,
 * which is scoped to Contract mutation (see its header), not general object
 * resolution.
 *
 * Unlike `world/creeps.ts#clearCreepContract`/`assignCreepContract`, there is
 * no `memory` guard here: Source and Structure objects have no `memory`, and
 * the caller already knows which kind of object it asked for.
 */
import { getGame } from "../game";

/**
 * Resolves any live Screeps object by id (Creep, Source, Structure, ...).
 *
 * Returns `undefined` when the id no longer resolves to anything visible —
 * the object died, was destroyed, or left visibility. Callers treat this as
 * a routine, silent no-op for the Tick (AD-10: resolver misses are not
 * exceptional).
 */
export function resolveObject<T extends _HasId>(id: string): T | undefined {
  return getGame().getObjectById<T>(id);
}

/**
 * DYING unload behavior (Story 4.5) — runs instead of a Creep's normal Job
 * behavior once its `ttl` drops below `CREEP_DYING_TTL_THRESHOLD`, regardless
 * of whether it holds a Contract (dispatch happens in `agents/behaviors/run.ts`).
 *
 * Delivers any carried energy to the nearest Spawn/Extension below energy
 * capacity (same target set as `world/producers/fill.ts#FILL_STRUCTURE_TYPES`,
 * mirrored locally here — Producers stay decoupled from behaviors). Once
 * empty, or when no needy structure exists, the Creep is a silent no-op for
 * the Tick and idles until death.
 *
 * All live-object resolution goes through `world/objects.ts` (AD-10); all
 * movement goes through `agents/movement.ts#moveCreep` (AD-8). This story
 * never clears or mutates the Creep's Contract — `validate`/Board
 * regeneration already own Contract lifecycle (FR-9).
 */
import { liveDistance } from "../../world/distance";
import { resolveObject } from "../../world/objects";
import { getCurrentSnapshot } from "../../world/snapshot";
import { moveCreep } from "../movement";

const LOG_PREFIX = "[behavior:dying]";

/** Same target set as `world/producers/fill.ts#FILL_STRUCTURE_TYPES` (read-only mirror). */
const DYING_STRUCTURE_TYPES: readonly StructureConstant[] = [
  "spawn",
  "extension",
];

/**
 * Executes one Tick of DYING unload for `creepId`.
 *
 * Resolves the live Creep and, if it is carrying energy, finds the nearest
 * Spawn/Extension below energy capacity (from the current snapshot), moves
 * into range 1 if needed, else transfers into it. Silent no-op when the
 * Creep cannot be resolved, carries no energy, or no needy structure exists.
 *
 * @param creepId Screeps id of the dying Creep.
 */
export function runDyingUnload(creepId: string): void {
  const creep = resolveObject<Creep>(creepId);
  // Reachability guard mirrors fill.ts/build.ts/upgrade.ts: a resolved but
  // memory-less object is not a usable live Creep.
  if (!creep || !("memory" in creep) || !creep.memory) return;

  if ((creep.carry.energy ?? 0) <= 0) return;

  const structures = getCurrentSnapshot()?.structures ?? [];
  const needy = structures.filter(
    (structure) =>
      DYING_STRUCTURE_TYPES.includes(structure.structureType) &&
      structure.energy < structure.energyCapacity,
  );
  if (needy.length === 0) return;

  const nearest = needy.reduce((closest, candidate) =>
    liveDistance(creep.pos, candidate.pos) <
    liveDistance(creep.pos, closest.pos)
      ? candidate
      : closest,
  );

  const target = resolveObject<AnyStoreStructure>(nearest.id);
  if (!target) return;

  if (liveDistance(creep.pos, target.pos) > 1) {
    moveCreep(creep, target.pos);
    return;
  }

  const result = creep.transfer(target, RESOURCE_ENERGY);
  if (result !== OK && result !== ERR_FULL) {
    console.log(
      `${LOG_PREFIX} transfer(${target.id}) by ${creep.id} returned ${result}`,
    );
  }
}

/**
 * Withdraw behavior (Story 6.6) — executes a Collector's sourcing phase by
 * withdrawing energy from a Container instead of harvesting a Source.
 *
 * Collectors are CARRY/MOVE-heavy bodies with a single WORK part, dispatched
 * to fill/build/upgrade Jobs. Unlike Generalists (which harvest Sources),
 * Collectors withdraw from Containers. This behavior runs only when a
 * Collector's carry is empty — once any energy is collected, the normal
 * per-Job-type `runServe` half takes over (via the existing fill/build/upgrade
 * behaviors, unmodified).
 *
 * All live-object resolution goes through `world/objects.ts` (AD-10); all
 * movement goes through `agents/movement.ts#moveCreep` (AD-8). An unreachable
 * Creep or no qualifying Container is a silent no-op for the Tick.
 */
import { getConstant } from "../../config";
import { liveDistance } from "../../world/distance";
import { resolveObject } from "../../world/objects";
import { getCurrentSnapshot } from "../../world/snapshot";
import { moveCreep } from "../movement";

const LOG_PREFIX = "[behavior:withdraw]";

/**
 * Executes one Tick of Container withdrawal for `creepId`.
 *
 * Resolves the live Creep and, if it has no energy in carry, finds the nearest
 * Container with energy above the COLLECTOR_MIN_CONTAINER_ENERGY threshold
 * (from the current snapshot), moves into range 1 if needed, else withdraws
 * energy from it. Silent no-op when the Creep cannot be resolved, carries
 * nonzero energy, or no qualifying Container exists.
 *
 * @param creepId Screeps id of the Collector Creep.
 */
export function runWithdrawSource(creepId: string): void {
  const creep = resolveObject<Creep>(creepId);
  // Reachability guard mirrors fill.ts/build.ts/upgrade.ts: a resolved but
  // memory-less object is not a usable live Creep.
  if (!creep || !("memory" in creep) || !creep.memory) return;

  // Only source when carry is empty (mirroring fill.ts's deriveSourcingPhase logic).
  if ((creep.carry.energy ?? 0) > 0) return;

  const structures = getCurrentSnapshot()?.structures ?? [];
  const minEnergy = getConstant("COLLECTOR_MIN_CONTAINER_ENERGY");

  // Filter for Containers with sufficient energy.
  const validContainers = structures.filter(
    (structure) =>
      structure.structureType === "container" && structure.energy > minEnergy,
  );

  if (validContainers.length === 0) return;

  // Find the nearest Container.
  const nearest = validContainers.reduce((closest, candidate) =>
    liveDistance(creep.pos, candidate.pos) <
    liveDistance(creep.pos, closest.pos)
      ? candidate
      : closest,
  );

  const container = resolveObject<Structure>(nearest.id);
  if (!container) return;

  // Move into range 1 if needed.
  if (liveDistance(creep.pos, container.pos) > 1) {
    moveCreep(creep, container.pos);
    return;
  }

  // Withdraw energy from the Container.
  const result = creep.withdraw(
    container as AnyStoreStructure,
    RESOURCE_ENERGY,
  );
  if (
    result !== OK &&
    result !== ERR_NOT_IN_RANGE &&
    result !== ERR_NOT_ENOUGH_RESOURCES
  ) {
    console.log(
      `${LOG_PREFIX} withdraw(${container.id}) by ${creep.id} returned ${result}`,
    );
  }
}

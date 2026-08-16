/**
 * Harvest behavior (Story 6.5) — executes a Harvester's `mine` Job.
 *
 * Every Tick, a Harvester with a `mine:<sourceId>` Contract finds its Source's
 * adjacent Container, moves onto it (Containers are walkable), then harvests and
 * transfers until the Container is full or the Source depletes. The phase (movement
 * vs. harvest) is derived fresh from live distance every Tick — never stored (AD-4).
 *
 * All live-object resolution goes through `world/objects.ts` (AD-10); all movement
 * goes through `agents/movement.ts#moveCreep` (AD-8). An unreachable Creep, Source,
 * or adjacent Container is a silent no-op for the Tick — Story 6.5 does not clear
 * stale Contracts; AD-4's persistent exception covers `mine` (FR-9).
 */
import { parseJobId } from "../../board/job";
import { chebyshevDistance, liveDistance } from "../../world/distance";
import { resolveObject } from "../../world/objects";
import { getCurrentSnapshot } from "../../world/snapshot";
import { moveCreep } from "../movement";

const LOG_PREFIX = "[behavior:harvest]";

/**
 * Executes one Tick of a `mine` Contract for `creepId`.
 *
 * Resolves the live Creep and Source, finds an adjacent Container in the snapshot,
 * and either moves the Creep onto the Container's position (if not already there)
 * or harvests/transfers once positioned. Silent no-op when any of these cannot be
 * resolved, or when no adjacent Container is found.
 *
 * @param creepId Screeps id of the Harvester Creep.
 * @param jobId The Creep's Contract jobId (grammar: `mine:sourceId`).
 */
export function runHarvest(creepId: string, jobId: string): void {
  const creep = resolveObject<Creep>(creepId);
  // Reachability guard mirrors world/creeps.ts's clearCreepContract/
  // assignCreepContract: a resolved but memory-less object is not a usable
  // live Creep.
  if (!creep || !("memory" in creep) || !creep.memory) return;

  const { targetId } = parseJobId(jobId);
  const source = resolveObject<Source>(targetId);
  if (!source) return;

  const snapshot = getCurrentSnapshot();
  if (!snapshot) return;

  // Find the Container adjacent to the Source via Chebyshev distance <= 1
  const containerStub = snapshot.structures.find(
    (s) =>
      s.structureType === "container" &&
      chebyshevDistance(source.pos, s.pos) <= 1,
  );
  if (!containerStub) return;

  // Resolve the live Container to get its RoomPosition for movement and transfer
  const container = resolveObject<StructureContainer>(containerStub.id);
  if (!container) return;

  // If not yet at the Container's position, move there
  if (liveDistance(creep.pos, container.pos) > 0) {
    moveCreep(creep, container.pos);
    return;
  }

  // Once positioned on the Container, harvest from the Source and transfer into Container
  const harvestResult = creep.harvest(source);
  if (
    harvestResult !== OK &&
    harvestResult !== ERR_NOT_IN_RANGE &&
    harvestResult !== ERR_NOT_ENOUGH_RESOURCES
  ) {
    console.log(
      `${LOG_PREFIX} harvest(${source.id}) by ${creep.id} returned ${harvestResult}`,
    );
  }

  // Transfer any carried energy into the Container
  if (creep.carry.energy > 0) {
    const transferResult = creep.transfer(container, RESOURCE_ENERGY);
    if (transferResult !== OK && transferResult !== ERR_FULL) {
      console.log(
        `${LOG_PREFIX} transfer(${container.id}) by ${creep.id} returned ${transferResult}`,
      );
    }
  }
}

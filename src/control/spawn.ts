/**
 * AD-9: spawn phase — top up population toward SPAWN_TARGET_POPULATION.
 *
 * Reads only the WorldSnapshot (AD-1/AD-10) — never the Game global directly.
 * Population = snapshot.creeps.length (Spawning Creeps already appear there,
 * per world/snapshot.ts#mapCreep, so they count without extra bookkeeping).
 */
import { getConstant } from "../config";
import { resolveObject } from "../world/objects";
import { getCurrentSnapshot } from "../world/snapshot";

export function spawn(): void {
  const snapshot = getCurrentSnapshot();
  if (!snapshot) return;

  const target = getConstant("SPAWN_TARGET_POPULATION");
  const population = snapshot.creeps.length;

  // Proactive replacement (Story 5.2): a living, non-Spawning Creep whose
  // ttl has dropped below the threshold gets a replacement spawned even if
  // population is already at target, so the replacement is inbound before
  // the old Creep dies. effectiveTarget caps this override at one Creep
  // above target — derived fresh from the snapshot every Tick, with no
  // persistence of "who's being replaced" (AD-9, zero-colony-Memory). This
  // is deliberately NOT `population >= target && !hasNearDyingCreep`: that
  // form never clears while the same Creep stays near-dying, re-firing a
  // new spawnCreep every time the Spawn goes idle (see spec Design Notes).
  const ttlReplacementThreshold = getConstant(
    "SPAWN_TTL_REPLACEMENT_THRESHOLD",
  );
  const hasNearDyingCreep = snapshot.creeps.some(
    (c) => !c.spawning && c.ttl > 0 && c.ttl < ttlReplacementThreshold,
  );
  const effectiveTarget = hasNearDyingCreep ? target + 1 : target;
  if (population >= effectiveTarget) return;

  const idleSpawn = snapshot.structures.find(
    (structure) =>
      structure.structureType === STRUCTURE_SPAWN && !structure.spawning,
  );
  if (!idleSpawn) return;

  const liveSpawn = resolveObject<StructureSpawn>(idleSpawn.id);
  if (!liveSpawn) return;

  const name = `generalist-${snapshot.roomName}-${snapshot.tick}`;
  // Population top-up spawns get no Contract in initial memory — unlike
  // Epic 6's Reserved-slot spawning, this is not a case where AD-2
  // write-ownership requires a Contract written at spawnCreep time. The new
  // Creep is simply picked up by `match` next Tick like any other idle Creep.
  const result = liveSpawn.spawnCreep(
    getConstant("SPAWN_BODY_GENERALIST"),
    name,
    { memory: {} },
  );

  if (result === OK) {
    // A spawn can fire for either reason simultaneously (e.g. population
    // already below target while a Creep also happens to be near-dying) —
    // report both rather than collapsing to whichever check ran first.
    const reasons: string[] = [];
    if (population < target) reasons.push("population");
    if (hasNearDyingCreep) reasons.push("ttl-replacement");
    console.log(
      `[spawn] spawnCreep(${name}) issued (${reasons.join("+")}), population ${population}/${effectiveTarget}`,
    );
  } else {
    console.log(`[spawn] spawnCreep(${name}) failed: ${result}`);
  }
}

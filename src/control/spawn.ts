/**
 * AD-9: spawn phase — top up population toward SPAWN_TARGET_POPULATION.
 *
 * Reads only the WorldSnapshot (AD-1/AD-10) — never the Game global directly.
 * Population = snapshot.creeps.length (Spawning Creeps already appear there,
 * per world/snapshot.ts#mapCreep, so they count without extra bookkeeping).
 */
import type { SpawnPriorityReason } from "../config";
import { getConstant } from "../config";
import { resolveObject } from "../world/objects";
import { getCurrentSnapshot } from "../world/snapshot";

/**
 * Selects a spawn reason from a list of present reasons using the fixed
 * priority order (Story 5.4). Returns the first reason in SPAWN_PRIORITY_ORDER
 * that exists in the present list, or undefined if none are present.
 *
 * Pure function — independently unit-testable with fabricated reason arrays.
 */
export function selectSpawnReason(
  present: readonly SpawnPriorityReason[],
): SpawnPriorityReason | undefined {
  const priorityOrder = getConstant("SPAWN_PRIORITY_ORDER");
  for (const reason of priorityOrder) {
    if (present.includes(reason)) {
      return reason;
    }
  }
  return undefined;
}

export function spawn(): void {
  const snapshot = getCurrentSnapshot();
  if (!snapshot) return;

  const { parts, cost } = getConstant("BODY_COMPOSITIONS").generalist;
  if (snapshot.energyAvailable < cost) return;

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

  // Build present reasons from existing population/TTL-replacement computation
  // (Story 5.4: Epic 5 never adds "reserved-vacancy"/"demand-pressure" here,
  // that's Epic 6's job on this same function).
  const present: SpawnPriorityReason[] = [];
  if (population < effectiveTarget) {
    present.push("population-topup");
  }

  // Select the highest-priority reason via the shared selection function,
  // proving the ordering machinery without changing observable Generalist-era
  // behavior (all Ticks with any present reason pass here, no new early-returns).
  const selectedReason = selectSpawnReason(present);
  if (!selectedReason) return;

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
  const result = liveSpawn.spawnCreep(parts, name, { memory: {} });

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

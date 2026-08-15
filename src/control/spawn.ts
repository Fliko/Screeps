/**
 * AD-9: spawn phase — issues at most one spawnCreep per Tick, selecting a
 * reason via the fixed priority order (Story 5.4): a vacant Reserved mine
 * slot ("reserved-vacancy", Story 6.4) beats Specialist-era delivery demand
 * ("demand-pressure", Story 6.4), which beats population/TTL top-up
 * ("population-topup", Story 5.1/5.2). Each reason spawns its own body kind
 * (harvester / collector / generalist); only "reserved-vacancy" writes a
 * Contract into the new Creep's initial memory (AD-2), bypassing Matching.
 *
 * Reads only the WorldSnapshot and Board (AD-1/AD-10) — never the Game global
 * directly. Population = snapshot.creeps.length (Spawning Creeps already
 * appear there, per world/snapshot.ts#mapCreep, so they count without extra
 * bookkeeping).
 */

import { getBoard } from "../board/registry";
import type { SpawnPriorityReason } from "../config";
import { getConstant } from "../config";
import { setContract } from "../state/contract";
import { resolveObject } from "../world/objects";
import { getCurrentSnapshot } from "../world/snapshot";
import { hasDemandPressure, hasReservedVacancy } from "./evolution";
import { hasCapacity, type TakenSet } from "./taken";

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

export function spawn(takenSet: TakenSet): void {
  const snapshot = getCurrentSnapshot();
  if (!snapshot) return;

  const board = getBoard();
  if (!board) return;

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

  // Build present reasons: Epic 6's reserved-vacancy and demand-pressure
  // (Story 6.4) plus existing population/TTL-replacement computation
  // (Story 5.4). Pass to selectSpawnReason which picks by fixed priority order.
  const present: SpawnPriorityReason[] = [];

  if (hasReservedVacancy(board.jobs, takenSet)) {
    present.push("reserved-vacancy");
  }

  if (hasDemandPressure(board.jobs, takenSet, snapshot.era)) {
    present.push("demand-pressure");
  }

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

  // Branch logic per selected reason: pick body kind, name pattern, and memory setup
  let bodyKind: "generalist" | "harvester" | "collector";
  let name: string;
  let namePrefix: string;
  let memorySetup: { memory: { contract?: string } };
  const reasons: string[] = [];

  if (selectedReason === "reserved-vacancy") {
    bodyKind = "harvester";
    namePrefix = "harvester";
    // Find the vacant mine Job and write its Contract to initial memory
    const vacantMineJob = board.jobs.find(
      (job) => job.type === "mine" && hasCapacity(takenSet, job),
    );
    if (!vacantMineJob) return; // Safety check (should not happen if hasReservedVacancy is true)
    memorySetup = { memory: {} };
    setContract(memorySetup, { jobId: vacantMineJob.id });
    reasons.push("reserved-vacancy");
  } else if (selectedReason === "demand-pressure") {
    bodyKind = "collector";
    namePrefix = "collector";
    memorySetup = { memory: {} };
    reasons.push("demand-pressure");
  } else {
    // "population-topup"
    bodyKind = "generalist";
    namePrefix = "generalist";
    memorySetup = { memory: {} };
    if (population < target) reasons.push("population");
    if (hasNearDyingCreep) reasons.push("ttl-replacement");
  }

  // Affordability check per body kind (Story 5.3 pattern)
  const { parts, cost } = getConstant("BODY_COMPOSITIONS")[bodyKind];
  if (snapshot.energyAvailable < cost) return;

  name = `${namePrefix}-${snapshot.roomName}-${snapshot.tick}`;
  const result = liveSpawn.spawnCreep(parts, name, memorySetup);

  if (result === OK) {
    console.log(
      `[spawn] spawnCreep(${name}) issued (${reasons.join("+")}), population ${population}/${effectiveTarget}`,
    );
  } else {
    console.log(`[spawn] spawnCreep(${name}) failed: ${result}`);
  }
}

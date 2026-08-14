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
  if (population >= target) return;

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
    console.log(
      `[spawn] spawnCreep(${name}) issued, population ${population}/${target}`,
    );
  } else {
    console.log(`[spawn] spawnCreep(${name}) failed: ${result}`);
  }
}

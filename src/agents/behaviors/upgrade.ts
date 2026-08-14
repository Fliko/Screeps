/**
 * Upgrade behavior (Story 4.4) — executes a Contracted Generalist's `upgrade`
 * Job.
 *
 * Every Tick, a Contracted Creep either sources (harvests the nearest active
 * Source) or serves (travels to and upgrades its Contract's target
 * Controller), per the anti-ping-pong rule in `agents/sourcing.ts`. The phase
 * is derived fresh from live carry each Tick — never stored (AD-4).
 *
 * All live-object resolution goes through `world/objects.ts` (AD-10); all
 * movement goes through `agents/movement.ts#moveCreep` (AD-8). An unreachable
 * Creep or target Controller is a silent no-op for the Tick — Story 4.4 does
 * not clear stale Contracts; `validate`/Board regeneration owns that next
 * Tick (FR-1).
 */
import { deriveSourcingPhase } from "../../agents/sourcing";
import { parseJobId } from "../../board/job";
import { liveDistance } from "../../world/distance";
import { resolveObject } from "../../world/objects";
import { getCurrentSnapshot } from "../../world/snapshot";
import { moveCreep } from "../movement";

const LOG_PREFIX = "[behavior:upgrade]";

/** Screeps' `upgradeController()` action range: 3 tiles (same as `build`). */
const UPGRADE_RANGE = 3;

/**
 * Executes one Tick of an `upgrade` Contract for `creepId`.
 *
 * Resolves the live Creep and, based on its current carry, either harvests
 * the nearest active Source (moving into range first if needed) or moves to
 * and upgrades the Contract's target Controller (parsed from `jobId`).
 * Silent no-op when the Creep, Source, or target cannot be resolved, or when
 * no active Source is visible.
 *
 * @param creepId Screeps id of the Contracted Creep.
 * @param jobId The Creep's Contract jobId (grammar: `type:targetId`).
 */
export function runUpgrade(creepId: string, jobId: string): void {
  const creep = resolveObject<Creep>(creepId);
  // Reachability guard mirrors world/creeps.ts's clearCreepContract/
  // assignCreepContract: a resolved but memory-less object is not a usable
  // live Creep.
  if (!creep || !("memory" in creep) || !creep.memory) return;

  const phase = deriveSourcingPhase(creep.carry.energy ?? 0);

  if (phase === "source") {
    runSource(creep);
    return;
  }

  runServe(creep, jobId);
}

// Identical to fill.ts#runSource / build.ts#runSource — the sourcing half of
// every Epic 4 behavior is byte-for-byte the same nearest-active-Source logic
// (harvest range 1, same ERR exclusions). See Story 4.4's intent contract.
function runSource(creep: Creep): void {
  const sources = getCurrentSnapshot()?.sources ?? [];
  if (sources.length === 0) return;

  const nearest = sources.reduce((closest, candidate) =>
    liveDistance(creep.pos, candidate.pos) <
    liveDistance(creep.pos, closest.pos)
      ? candidate
      : closest,
  );

  const source = resolveObject<Source>(nearest.id);
  if (!source) return;

  if (liveDistance(creep.pos, source.pos) > 1) {
    moveCreep(creep, source.pos);
    return;
  }

  const result = creep.harvest(source);
  if (
    result !== OK &&
    result !== ERR_NOT_IN_RANGE &&
    result !== ERR_NOT_ENOUGH_RESOURCES
  ) {
    console.log(
      `${LOG_PREFIX} harvest(${source.id}) by ${creep.id} returned ${result}`,
    );
  }
}

function runServe(creep: Creep, jobId: string): void {
  const { targetId } = parseJobId(jobId);
  const target = resolveObject<StructureController>(targetId);
  if (!target) return;

  if (liveDistance(creep.pos, target.pos) > UPGRADE_RANGE) {
    moveCreep(creep, target.pos);
    return;
  }

  const result = creep.upgradeController(target);
  // Unlike fill's ERR_FULL and build's ERR_INVALID_TARGET exclusions (both
  // cover a target satisfied mid-Tick by another Creep), a Controller never
  // "completes" or disappears mid-Tick — every non-range ERR code here is a
  // genuine, worth-logging condition.
  if (result !== OK && result !== ERR_NOT_IN_RANGE) {
    console.log(
      `${LOG_PREFIX} upgradeController(${target.id}) by ${creep.id} returned ${result}`,
    );
  }
}

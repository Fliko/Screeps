/**
 * AD-9: match phase — match idle Creeps to available Jobs.
 *
 * Thin AD-9 phase orchestrator, mirroring `control/validate.ts`: bail on no
 * snapshot/no Board, walk the idle Creeps in this Tick's snapshot, delegate
 * scoring to the pure `selectJob`, and write through `world/creeps.ts` (the
 * only Game/Memory seam here, AD-10/AD-2).
 *
 * The within-Tick claim lock (FR-13): capacity is tracked in a local
 * `Map<JobId, number>` copied from `takenSet.entries` at the start of this
 * call, mutated only here, and never returned or persisted (AD-5, AD-9) — so
 * the second idle Creep processed in the same call sees the first's claim.
 */
import type { Job, JobId } from "../board/job";
import { getBoard } from "../board/registry";
import { getConstant } from "../config";
import { assignCreepContract } from "../world/creeps";
import { liveDistance } from "../world/distance";
import type { SnapshotCreep } from "../world/snapshot";
import { getCurrentSnapshot } from "../world/snapshot";
import type { TakenSet } from "./taken";

/** Tier rank for sorting — lower sorts first. No numeric rank exists elsewhere (Design Notes). */
const TIER_RANK: Record<Job["tier"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Pure selection: picks the best eligible open Job for `creep`, or
 * `undefined` if none qualify.
 *
 * Eligibility: `assignmentMode === "pulled"` AND `creep.ttl >=
 * job.requirements.ttlFloor` AND `counts.get(job.id) ?? 0 < job.maxWorkers`.
 * Ordering: tier (critical > high > medium > low) → `withinTierPriority`
 * descending → `liveDistance(creep.pos, job.pos)` ascending. On a full tie
 * (equal tier, equal `withinTierPriority`, equal distance) the first Job
 * encountered in `jobs` wins — no further tiebreaker is defined.
 */
export function selectJob(
  creep: SnapshotCreep,
  jobs: readonly Job[],
  counts: ReadonlyMap<JobId, number>,
): Job | undefined {
  let best: Job | undefined;
  let bestDistance = Infinity;

  for (const job of jobs) {
    if (job.assignmentMode !== "pulled") {
      continue;
    }
    if (creep.ttl < job.requirements.ttlFloor) {
      continue;
    }
    if ((counts.get(job.id) ?? 0) >= job.maxWorkers) {
      continue;
    }

    if (!best) {
      best = job;
      bestDistance = liveDistance(creep.pos, job.pos);
      continue;
    }

    const tierRank = TIER_RANK[job.tier];
    const bestTierRank = TIER_RANK[best.tier];
    if (tierRank !== bestTierRank) {
      if (tierRank < bestTierRank) {
        best = job;
        bestDistance = liveDistance(creep.pos, job.pos);
      }
      continue;
    }

    if (job.withinTierPriority !== best.withinTierPriority) {
      if (job.withinTierPriority > best.withinTierPriority) {
        best = job;
        bestDistance = liveDistance(creep.pos, job.pos);
      }
      continue;
    }

    const distance = liveDistance(creep.pos, job.pos);
    if (distance < bestDistance) {
      best = job;
      bestDistance = distance;
    }
  }

  return best;
}

/**
 * Matches idle Creeps (no Contract, not Spawning) to open Jobs this Tick.
 *
 * Bails quietly on no snapshot (main.ts's deriveTakenSet phase already
 * reports the missing snapshot earlier the same Tick, NFR-1). A missing
 * Board is logged and skipped — it means generate did not run, not that
 * there is no work.
 */
export function match(takenSet: TakenSet): void {
  const prefix = getConstant("LOG_PHASE_PREFIX");
  const snapshot = getCurrentSnapshot();
  if (!snapshot) {
    return;
  }

  const board = getBoard();
  if (!board) {
    console.log(`${prefix} match: no Board this Tick — no Job matched`);
    return;
  }

  // The within-Tick claim lock: a fresh Map, mutated only within this call,
  // never returned or persisted (AD-5, AD-9).
  const counts = new Map<JobId, number>(takenSet.entries);

  for (const creep of snapshot.creeps) {
    if (creep.contract !== undefined) {
      continue;
    }
    if (creep.spawning === true) {
      continue;
    }

    const job = selectJob(creep, board.jobs, counts);
    if (!job) {
      continue;
    }

    if (assignCreepContract(creep.id, job.id)) {
      counts.set(job.id, (counts.get(job.id) ?? 0) + 1);
    } else {
      console.log(
        `${prefix} match: could not resolve Creep ${creep.id} to assign ${job.id}`,
      );
    }
  }
}

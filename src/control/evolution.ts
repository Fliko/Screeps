/**
 * AD-9: evolution phase - pure functions to compute Spawn priority reasons.
 *
 * Exported by `spawn()` (Story 6.4) to determine whether to spawn a Specialist-era
 * body (Harvester/Collector) or fall back to population top-up. No Game API calls,
 * no Memory writes — pure functions over injected Board and taken-set.
 */

import type { Job } from "../board/job";
import type { TakenSet } from "./taken";
import { hasCapacity } from "./taken";

/**
 * Returns true iff any mine Job on the Board has capacity for another worker.
 *
 * Mine Jobs are Reserved-slot and have maxWorkers: 1 per the policy (Story 6.2).
 * A mine has capacity iff it is untaken (no Creep holds its Contract yet).
 */
export function hasReservedVacancy(
  jobs: readonly Job[],
  takenSet: TakenSet,
): boolean {
  return jobs.some((job) => job.type === "mine" && hasCapacity(takenSet, job));
}

/**
 * Returns true iff we are in the Specialist era AND any Pulled Job has capacity.
 *
 * Collector bodies (Story 6.4) spawn only when Specialist era is active and when
 * there is genuine demand from untaken Pulled-assignment Jobs. Falls back to
 * population top-up when no such demand exists.
 */
export function hasDemandPressure(
  jobs: readonly Job[],
  takenSet: TakenSet,
  era: "generalist" | "specialist",
): boolean {
  if (era !== "specialist") {
    return false;
  }
  return jobs.some(
    (job) => job.assignmentMode === "pulled" && hasCapacity(takenSet, job),
  );
}

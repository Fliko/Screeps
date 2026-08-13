/**
 * AD-9: taken-set phase — per-Tick count of active Contracts per Job.
 *
 * Pure functions over an injected Contract array: no Game reads, no Memory
 * writes, no module state. `main.ts` collects the Contracts from the world
 * snapshot and calls `deriveTakenSet` once per Tick, per AD-9's rule that the
 * taken-set is derived in the control cycle and never stored.
 *
 * Consumers use `getTakenCount` and `hasCapacity` to decide whether a Job has
 * open capacity. `releaseContracts` produces the post-validation set so the
 * match phase does not count Contracts that validate cleared this Tick.
 */

import type { Job, JobId } from "../board/job";
import type { ContractState } from "../state/contract";

/**
 * Per-Tick count of active Contracts for each Job id.
 *
 * The wrapper object is frozen. `entries` is typed `ReadonlyMap`, which is a
 * compile-time guarantee only — the underlying Map remains mutable through a
 * cast, so consumers must treat it as read-only by convention.
 */
export interface TakenSet {
  readonly entries: ReadonlyMap<JobId, number>;
}

/**
 * Derives a fresh `TakenSet` from an array of Contracts.
 *
 * Duplicate `jobId`s increment the count so capacity checks can enforce
 * `maxWorkers`. Creeps still Spawning are included by the caller — `spawnCreep`
 * writes their Reserved Contract immediately, so they appear in the snapshot
 * like any other Creep (FR-16, FR-29).
 */
export function deriveTakenSet(contracts: readonly ContractState[]): TakenSet {
  const counts = new Map<JobId, number>();
  for (const contract of contracts) {
    counts.set(contract.jobId, (counts.get(contract.jobId) ?? 0) + 1);
  }
  return Object.freeze({ entries: counts });
}

/** Returns how many Creeps currently hold a Contract for `jobId`. */
export function getTakenCount(takenSet: TakenSet, jobId: JobId): number {
  return takenSet.entries.get(jobId) ?? 0;
}

/** Returns true if the Job still has capacity for another assignment. */
export function hasCapacity(takenSet: TakenSet, job: Job): boolean {
  return getTakenCount(takenSet, job.id) < job.maxWorkers;
}

/**
 * Returns a taken-set with the `cleared` Contracts removed from the counts.
 *
 * AD-9 derives the taken-set before the validate phase, so Contracts that
 * validate clears this Tick would otherwise still consume capacity when match
 * runs — a Job would read as full while its worker is being released. Returns
 * the original instance when nothing was cleared.
 */
export function releaseContracts(
  takenSet: TakenSet,
  cleared: readonly ContractState[],
): TakenSet {
  if (cleared.length === 0) {
    return takenSet;
  }
  const counts = new Map(takenSet.entries);
  for (const contract of cleared) {
    const remaining = (counts.get(contract.jobId) ?? 0) - 1;
    if (remaining > 0) {
      counts.set(contract.jobId, remaining);
    } else {
      counts.delete(contract.jobId);
    }
  }
  return Object.freeze({ entries: counts });
}

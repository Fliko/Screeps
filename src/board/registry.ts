/**
 * AD-3: Board registry — the per-Tick derived projection of work.
 *
 * The Board is rebuilt from scratch every Tick; no Job survives across Ticks.
 * Producers (world/producers/) call resetBoard() at cycle start and addJob()
 * to populate; control/ and agents/ read via getBoard().
 *
 * No Game API calls live here (AD-10) — pure TypeScript registry management.
 * Mirrors the snapshot.ts module-level-state + getter pattern.
 */

import type { Job, JobId } from "./job";

/** The Board: a readonly view of the current Tick's open Jobs. */
export interface Board {
  readonly jobs: readonly Job[];
}

let jobs: Job[] = [];
let currentBoard: Board | undefined;

/**
 * Resets the Board to an empty state for a new Tick.
 * AD-3: the Board is recomputed from world state every Tick — no Jobs survive.
 * Mirrors snapshot.ts: publish empty state immediately so no stale data is
 * observable if a later call throws.
 */
export function resetBoard(): void {
  jobs = [];
  currentBoard = { jobs };
}

/**
 * Adds a Job to the current Board.
 * Called by Producers (world/producers/) during the generate phase.
 * Throws if the Board has not been initialized via resetBoard() this Tick —
 * catches a Producer calling before the cycle's reset.
 */
export function addJob(job: Job): void {
  if (!currentBoard) {
    throw new Error(
      "Board not initialized — call resetBoard() before adding jobs",
    );
  }
  jobs.push(job);
}

/**
 * Returns the current Board, or undefined if no resetBoard() has been called.
 * Consumers (control/matching, agents/) call this to read open Jobs.
 */
export function getBoard(): Board | undefined {
  return currentBoard;
}

/**
 * Convenience lookup: finds a Job by its id (type:node:targetId grammar, AD-4/AD-11).
 * Returns undefined if no Job with that id is on the current Board.
 * Used later by validators (Story 3.1+) and Matching (Story 3.4).
 */
export function findJob(id: JobId): Job | undefined {
  if (!currentBoard) {
    return undefined;
  }
  return jobs.find((job) => job.id === id);
}

/**
 * AD-4: Contract type for the per-Tick Board.
 *
 * A Contract is the jobId string stored in `creep.memory.contract` — the sole unit of
 * scheduling persistence (FR-8). It is exactly one string: the jobId `type:node:targetId`
 * (AD-11) of the Job this Creep currently holds.
 *
 * Stored as a type alias (not a class) so it imposes zero runtime cost and parses
 * trivially via parseJobId (Story 3.1 validators).
 */

import type { JobId } from "./job";

export type Contract = JobId;

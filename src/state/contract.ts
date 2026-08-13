/**
 * AD-2: single owner of creep.memory.contract schema.
 *
 * `state/` owns the shape, (de)serialization, and typed accessors for
 * `creep.memory.contract`. All business-logic modules read and write Contracts
 * through `getContract`, `setContract`, and `clearContract`. The only direct
 * `creep.memory.contract` read lives in `src/game.ts`, which is the permitted
 * adapter mapping (see AC5 and the comment there).
 */

import type { JobId } from "../board/job";
import { makeJobId, parseJobId } from "../board/job";

/**
 * The persisted Contract state stored in `creep.memory.contract`.
 *
 * AD-4: a Contract is exactly the Job id string `type:targetId`. This typed
 * wrapper lets consumers pass and receive a structured object while memory
 * stores only the compact Job id.
 */
export interface ContractState {
  jobId: JobId;
}

/**
 * Reads and validates `creep.memory.contract`.
 *
 * Returns the typed Contract if the persisted string is a valid Job id,
 * otherwise returns `undefined`. Malformed or stale memory is treated as
 * "no Contract" so callers can reassign the Creep.
 */
export function getContract(creep: {
  memory: { contract?: string };
}): ContractState | undefined {
  const raw = creep.memory.contract;
  if (typeof raw !== "string") {
    return undefined;
  }
  try {
    parseJobId(raw);
    return { jobId: raw };
  } catch {
    return undefined;
  }
}

/**
 * Persists a Contract to `creep.memory.contract`.
 *
 * The Job id is canonicalized through `parseJobId`/`makeJobId` so the stored
 * string always follows the `type:targetId` grammar.
 */
export function setContract(
  creep: { memory: { contract?: string } },
  contract: ContractState,
): void {
  const { type, targetId } = parseJobId(contract.jobId);
  creep.memory.contract = makeJobId(type, targetId);
}

/**
 * Removes the Contract from `creep.memory.contract`.
 *
 * After clearing, `getContract` returns `undefined`.
 */
export function clearContract(creep: { memory: { contract?: string } }): void {
  delete creep.memory.contract;
}

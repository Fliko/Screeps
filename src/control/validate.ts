/** AD-9: validate phase — validate working Creeps' Contracts */

import { isContractValid } from "../agents/validators";
import { parseJobId } from "../board/job";
import { findJob, getBoard } from "../board/registry";
import { getConstant } from "../config";
import type { ContractState } from "../state/contract";
import { clearCreepContract } from "../world/creeps";
import { getCurrentSnapshot } from "../world/snapshot";
import type { TakenSet } from "./taken";

/**
 * Validates working Creeps' Contracts and returns the Contracts it cleared.
 *
 * Thin AD-9 phase orchestrator: it walks the Contracted Creeps in this Tick's
 * snapshot, asks the pure `agents/validators.ts` rules for the verdict, and
 * clears through `world/creeps.ts` (the only Game/Memory seam here, AD-10/AD-2).
 *
 * AD-9 derives the taken-set before this phase runs, so the returned Contracts
 * are released from it before match reads capacity. `_takenSet` itself is
 * unused — it is kept only for phase-signature uniformity with `match`.
 */
export function validate(_takenSet: TakenSet): readonly ContractState[] {
  const prefix = getConstant("LOG_PHASE_PREFIX");
  const snapshot = getCurrentSnapshot();
  // No log here: main.ts's deriveTakenSet phase already reports the missing
  // snapshot earlier in the same Tick, and a quiet Tick is the goal (NFR-1).
  if (!snapshot) {
    return [];
  }
  // Defensive: without a Board, every findJob would miss and mass-clear every
  // Contract. A missing Board means generate did not run, not that work vanished.
  if (!getBoard()) {
    console.log(
      `${prefix} validate: no Board this Tick — no Contract validated`,
    );
    return [];
  }

  const cleared: ContractState[] = [];
  for (const creep of snapshot.creeps) {
    const jobId = creep.contract;
    if (jobId === undefined) {
      continue;
    }
    // Contracts in the snapshot are already grammar-validated by getContract at
    // snapshot-build time, so parseJobId cannot throw here.
    const { type } = parseJobId(jobId);
    if (
      isContractValid(type, findJob(jobId), creep.ttl, creep.spawning ?? false)
    ) {
      continue;
    }
    // Clearing writes Memory only — this Tick's snapshot keeps the now-stale
    // `creep.contract` string for the rest of the Tick. Later phases (Story 3.4's
    // match) must treat the returned array, not the snapshot, as the truth.
    // Only report a release when the Creep was actually reachable to clear.
    if (clearCreepContract(creep.id)) {
      cleared.push({ jobId });
    } else {
      console.log(
        `${prefix} validate: could not resolve Creep ${creep.id} to clear ${jobId}`,
      );
    }
  }
  return cleared;
}

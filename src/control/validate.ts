/** AD-9: validate phase — validate working Creeps' Contracts */
import type { ContractState } from "../state/contract";
import type { TakenSet } from "./taken";

/**
 * Validates working Creeps' Contracts and returns the Contracts it cleared.
 *
 * AD-9 derives the taken-set before this phase runs, so the returned Contracts
 * are released from it before match reads capacity.
 */
// TODO(Story 3.3): validate Contracts against live snapshot state; clear
// invalid Contracts per FR-9.
export function validate(_takenSet: TakenSet): readonly ContractState[] {
  // Empty implementation — logic arrives in Story 3.3
  return [];
}

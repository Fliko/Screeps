// the control cycle ONLY (AD-9) — implemented in Story 1.4
import { runBehaviors } from "./agents/behaviors/run";
import { getConstant } from "./config";
import { generate } from "./control/generate";
import { match } from "./control/match";
import { measurePhase } from "./control/metering";
import { spawn } from "./control/spawn";
import { deriveTakenSet, releaseContracts } from "./control/taken";
import { validate } from "./control/validate";
import { cleanupDeadCreeps } from "./housekeeping";
import type { ContractState } from "./state/contract";
import { getCurrentSnapshot } from "./world/snapshot";

// Module state persists across Ticks in Screeps, so this boolean guard fires
// the boot marker once per module load — a fresh deploy or a shard/isolate
// restart re-evaluates the module and logs again; every Tick it stays silent
// (NFR-1).
let booted = false;

/**
 * Screeps main-module entry: called by the engine every Tick. Story 1.4 adds
 * the full six-phase AD-9 control cycle: generate → taken-set → validate →
 * match → spawn → execute. The boot marker fires once per deploy (Story 1.2).
 */
export function loop(): void {
  // Housekeeping: cleanup dead creeps from Memory before control cycle
  const cleanedCount = measurePhase("housekeeping", cleanupDeadCreeps);
  if (cleanedCount > 0) {
    console.log(`[housekeeping] cleaned ${cleanedCount} dead creep entries`);
  }

  if (!booted) {
    console.log(getConstant("LOG_BOOT"));
    booted = true;
  }

  // AD-9: five phases in order, wrapped with CPU metering
  measurePhase("generate", generate);
  const takenSet = measurePhase("deriveTakenSet", () => {
    const snapshot = getCurrentSnapshot();
    if (!snapshot) {
      console.log(
        `${getConstant("LOG_PHASE_PREFIX")} deriveTakenSet: no snapshot this Tick — every Job will read as open`,
      );
      return deriveTakenSet([]);
    }
    // Creeps still Spawning are in the snapshot like any other Creep —
    // spawnCreep writes their Reserved Contract immediately — so they count
    // toward capacity and a Reserved slot never looks vacant (FR-16, FR-29).
    const contracts: ContractState[] = [];
    for (const creep of snapshot.creeps) {
      if (creep.contract !== undefined) {
        contracts.push({ jobId: creep.contract });
      }
    }
    return deriveTakenSet(contracts);
  });
  // Contracts validate cleared this Tick must not still consume capacity when
  // match runs — the taken-set was derived before validate (AD-9).
  const cleared = measurePhase("validate", () => validate(takenSet));
  const released = releaseContracts(takenSet, cleared);
  measurePhase("match", () => match(released));
  measurePhase("spawn", () => spawn(released));
  measurePhase("execute", runBehaviors);
}

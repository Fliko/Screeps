// the control cycle ONLY (AD-9) — implemented in Story 1.4
import { getConstant } from "./config";
import { generate } from "./control/generate";
import { match } from "./control/match";
import { measurePhase } from "./control/metering";
import { spawn } from "./control/spawn";
import { deriveTakenSet } from "./control/taken";
import { validate } from "./control/validate";

// Module state persists across Ticks in Screeps, so this boolean guard fires
// the boot marker once per module load — a fresh deploy or a shard/isolate
// restart re-evaluates the module and logs again; every Tick it stays silent
// (NFR-1).
let booted = false;

/**
 * Screeps main-module entry: called by the engine every Tick. Story 1.4 adds
 * the full five-phase AD-9 control cycle: generate → taken-set → validate →
 * match → spawn. The boot marker fires once per deploy (Story 1.2).
 */
export function loop(): void {
  if (!booted) {
    console.log(getConstant("LOG_BOOT"));
    booted = true;
  }

  // AD-9: five phases in order, wrapped with CPU metering
  measurePhase("generate", generate);
  measurePhase("deriveTakenSet", deriveTakenSet);
  measurePhase("validate", validate);
  measurePhase("match", match);
  measurePhase("spawn", spawn);
}

// the control cycle ONLY (AD-9) — implemented in Story 1.4
import { LOG_BOOT } from "./config";

// Module state persists across Ticks in Screeps, so this boolean guard fires
// the boot marker once per module load — a fresh deploy or a shard/isolate
// restart re-evaluates the module and logs again; every Tick it stays silent
// (NFR-1).
let booted = false;

/**
 * Screeps main-module entry: called by the engine every Tick. Story 1.2 adds
 * only the minimal bootable seam (an exported `loop()` and a one-time boot
 * marker); the full five-phase AD-9 control cycle is Story 1.4.
 */
export function loop(): void {
  if (!booted) {
    console.log(LOG_BOOT);
    booted = true;
  }
}

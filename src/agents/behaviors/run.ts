/**
 * Behavior dispatch coordinator (AD-9 execute phase) — the only place that
 * calls behaviors. Reads this Tick's snapshot via getCurrentSnapshot() (AD-10
 * seam; no Game reads here), and for each Contracted Creep dispatches to the
 * behavior registered for its Contract's Job type. A Job type with no table
 * entry is a silent no-op this Tick (Story 4.4 adds `upgrade` with zero
 * changes to this table's shape). A Creep whose ttl drops below
 * CREEP_DYING_TTL_THRESHOLD is intercepted before this Job-type dispatch and
 * routed to the DYING unload behavior instead, whether or not it holds a
 * Contract (Story 4.5).
 */
import type { JobType } from "../../board/job";
import { parseJobId } from "../../board/job";
import { getConstant } from "../../config";
import { getCurrentSnapshot } from "../../world/snapshot";
import { runBuild } from "./build";
import { runDyingUnload } from "./dying";
import { runFill } from "./fill";
import { runUpgrade } from "./upgrade";

type Behavior = (creepId: string, jobId: string) => void;

const BEHAVIORS: Partial<Record<JobType, Behavior>> = {
  fill: runFill,
  build: runBuild,
  upgrade: runUpgrade,
};

export function runBehaviors(): void {
  const snapshot = getCurrentSnapshot();
  if (!snapshot) return;

  for (const creep of snapshot.creeps) {
    // A Creep still Spawning cannot act — dispatching it wastes CPU and
    // produces spurious ERR logs (mirrors validate.ts's spawning handling).
    // Its ttl reads 0 regardless of actual lifecycle, so this guard must run
    // before the DYING check below to avoid misclassifying it as dying.
    if (creep.spawning) continue;

    // DYING interceptor (Story 4.5): a Creep whose ttl drops below threshold
    // unloads any carried energy instead of running its normal Job behavior
    // this Tick, whether or not it holds a Contract.
    if (creep.ttl < getConstant("CREEP_DYING_TTL_THRESHOLD")) {
      try {
        runDyingUnload(creep.id);
      } catch (err) {
        console.log(
          `[behavior:run] runDyingUnload threw for Creep ${creep.id}: ${String(err)}`,
        );
      }
      continue;
    }

    const jobId = creep.contract;
    if (jobId === undefined) continue;

    // Contracts in the snapshot are already grammar-validated by getContract at
    // snapshot-build time, so parseJobId cannot throw here.
    const { type } = parseJobId(jobId);
    const behavior = BEHAVIORS[type];
    if (!behavior) continue;

    try {
      behavior(creep.id, jobId);
    } catch (err) {
      // One Creep's behavior throwing must not abort dispatch for every other
      // Contracted Creep this Tick (also guards the parseJobId invariant above).
      console.log(
        `[behavior:run] behavior threw for Creep ${creep.id} (${jobId}): ${String(err)}`,
      );
    }
  }
}

/**
 * Fill Producer — emits one fill Job per energy-storing structure below
 * capacity (Spawn / Extension), read at MVP. Consumes the per-Tick snapshot;
 * no Game API reads here (AD-10). One Job per object, never aggregates (FR-2,
 * FR-5). Policy values come from the config.ts policy table (FR-22) — never
 * hardcoded. Pure: returns Jobs, does not write the Board (run.ts addJobs).
 */
import type { Job, NodeName } from "../../board/job";
import { makeJob } from "../../board/job";
import { getConstant } from "../../config";
import type { WorldSnapshot } from "../snapshot";

/** MVP fill targets (FR-2 "Spawn/Extensions below capacity"). */
const FILL_STRUCTURE_TYPES: readonly StructureConstant[] = [
  "spawn",
  "extension",
];

/** Node per fill structureType (AD-11): spawn → "spawns", extension → "extensions". */
const FILL_NODE_BY_STRUCTURE_TYPE: Readonly<
  Partial<Record<StructureConstant, NodeName>>
> = {
  spawn: "spawns",
  extension: "extensions",
};

export function produceFill(snapshot: WorldSnapshot): Job[] {
  const policy = getConstant("JOB_POLICY_TABLE").fill;
  const jobs: Job[] = [];
  for (const structure of snapshot.structures) {
    if (!FILL_STRUCTURE_TYPES.includes(structure.structureType)) continue;
    if (structure.energy >= structure.energyCapacity) continue;
    const node = FILL_NODE_BY_STRUCTURE_TYPE[structure.structureType];
    if (!node) continue;
    jobs.push(
      makeJob({
        type: "fill",
        node,
        targetId: structure.id,
        pos: structure.pos,
        tier: policy.tier,
        withinTierPriority: policy.withinTierPriority,
        maxWorkers: policy.maxWorkers,
        assignmentMode: policy.assignmentMode,
        lifetimeClass: policy.lifetimeClass,
        requirements: policy.requirements,
      }),
    );
  }
  return jobs;
}

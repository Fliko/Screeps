/**
 * Build Producer — emits one build Job per construction site from the snapshot.
 * No Game API reads here (AD-10). One Job per object (FR-2). Container-first
 * within-tier precedence (FR-24): Container construction sites get a higher
 * withinTierPriority than other structure types, allowing them to outrank
 * nearer ordinary sites via the tier→priority→distance cascade (Story 3.4, AD-7).
 * Pure: returns Jobs, does not write the Board.
 */
import type { Job } from "../../board/job";
import { makeJob } from "../../board/job";
import { getConstant } from "../../config";
import type { WorldSnapshot } from "../snapshot";

export function produceBuild(snapshot: WorldSnapshot): Job[] {
  const policy = getConstant("JOB_POLICY_TABLE").build;
  const priorityTable = getConstant("BUILD_STRUCTURE_PRIORITY");
  return snapshot.constructionSites.map((site) =>
    makeJob({
      type: "build",
      node: "build",
      targetId: site.id,
      pos: site.pos,
      tier: policy.tier,
      withinTierPriority:
        priorityTable[site.structureType] ?? priorityTable.default,
      maxWorkers: policy.maxWorkers,
      assignmentMode: policy.assignmentMode,
      lifetimeClass: policy.lifetimeClass,
      requirements: policy.requirements,
    }),
  );
}

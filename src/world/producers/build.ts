/**
 * Build Producer — emits one build Job per construction site from the snapshot.
 * No Game API reads here (AD-10). One Job per object (FR-2). Container-first
 * within-tier precedence (FR-24, reconcile G1) is a later Evolution-era shift;
 * all sites are priority 0 here. Pure: returns Jobs, does not write the Board.
 */
import type { Job } from "../../board/job";
import { makeJob } from "../../board/job";
import { getConstant } from "../../config";
import type { WorldSnapshot } from "../snapshot";

export function produceBuild(snapshot: WorldSnapshot): Job[] {
  const policy = getConstant("JOB_POLICY_TABLE").build;
  return snapshot.constructionSites.map((site) =>
    makeJob({
      type: "build",
      targetId: site.id,
      pos: site.pos,
      tier: policy.tier,
      withinTierPriority: policy.withinTierPriority,
      maxWorkers: policy.maxWorkers,
      assignmentMode: policy.assignmentMode,
      lifetimeClass: policy.lifetimeClass,
      requirements: policy.requirements,
    }),
  );
}

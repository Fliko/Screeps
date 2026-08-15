/**
 * Mine Producer — emits one mine Job per Source from the snapshot when era is "specialist".
 * Gated on specialist era: returns empty array when era is "generalist".
 * Consumes the snapshot; no Game API reads here (AD-10). Pure: returns Jobs.
 */
import type { Job } from "../../board/job";
import { makeJob } from "../../board/job";
import { getConstant } from "../../config";
import type { WorldSnapshot } from "../snapshot";

export function produceMine(snapshot: WorldSnapshot): Job[] {
  if (snapshot.era !== "specialist") return [];
  const policy = getConstant("JOB_POLICY_TABLE").mine;
  return snapshot.sources.map((source) =>
    makeJob({
      type: "mine",
      targetId: source.id,
      pos: source.pos,
      tier: policy.tier,
      withinTierPriority: policy.withinTierPriority,
      maxWorkers: policy.maxWorkers,
      assignmentMode: policy.assignmentMode,
      lifetimeClass: policy.lifetimeClass,
      requirements: policy.requirements,
    }),
  );
}

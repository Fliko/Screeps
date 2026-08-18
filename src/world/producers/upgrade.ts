/**
 * Upgrade Producer — the Backfill default (FR-21): always posts one upgrade Job
 * (unlimited workers, lowest tier, persistent) whenever the Controller exists.
 * Consumes the snapshot; no Game API reads here (AD-10). Pure: returns Jobs.
 */
import type { Job } from "../../board/job";
import { makeJob } from "../../board/job";
import { getConstant } from "../../config";
import type { WorldSnapshot } from "../snapshot";

export function produceUpgrade(snapshot: WorldSnapshot): Job[] {
  const controller = snapshot.controller;
  if (!controller) return [];
  const policy = getConstant("JOB_POLICY_TABLE").upgrade;
  return [
    makeJob({
      type: "upgrade",
      node: "upgrade",
      targetId: controller.id,
      pos: controller.pos,
      tier: policy.tier,
      withinTierPriority: policy.withinTierPriority,
      maxWorkers: policy.maxWorkers,
      assignmentMode: policy.assignmentMode,
      lifetimeClass: policy.lifetimeClass,
      requirements: policy.requirements,
    }),
  ];
}

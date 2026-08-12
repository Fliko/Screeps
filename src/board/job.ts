/**
 * AD-4: Job type, id grammar, and Contract type for the per-Tick Board.
 *
 * These types are the canonical, freshly-derived representation of work each Tick.
 * The Board is rebuilt from scratch every Tick (AD-3); no Job survives across Ticks.
 * No Game API calls live here (AD-10) — these are pure TypeScript types and functions.
 */

import type { RoomPositionData } from "../game";

// ── String-union types (Consistency Conventions: no runtime enums) ──────────

export type JobType = "mine" | "fill" | "build" | "upgrade";
export type PriorityTier = "critical" | "high" | "medium" | "low";
export type AssignmentMode = "reserved" | "pulled";
export type LifetimeClass = "persistent" | "transient";

/** JobId grammar: `type:targetId` (AD-4). Stored in creep.memory.contract as the Contract. */
export type JobId = string;

// ── Job schema (exact field order per ARCHITECTURE-SPINE.md L102) ────────────

/**
 * Requirements a Creep must satisfy to be offered this Job (FR-4).
 * - `body`: the minimum Body part composition (e.g. Generalist / Harvester / Collector).
 *   Values come from config.ts MVP Body compositions (pinned in Story 2.3).
 * - `ttlFloor`: minimum ticks-to-live a Creep must have to be assigned this Job (FR-4, FR-12).
 */
export interface JobRequirements {
  body: BodyPartConstant[];
  ttlFloor: number;
}

export interface Job {
  id: JobId;
  type: JobType;
  targetId: string;
  pos: RoomPositionData;
  tier: PriorityTier;
  withinTierPriority: number;
  maxWorkers: number;
  assignmentMode: AssignmentMode;
  lifetimeClass: LifetimeClass;
  requirements: JobRequirements;
}

/** All Job fields except `id` — Producers supply these; `makeJob` computes `id`. */
export interface JobInput {
  type: JobType;
  targetId: string;
  pos: RoomPositionData;
  tier: PriorityTier;
  withinTierPriority: number;
  maxWorkers: number;
  assignmentMode: AssignmentMode;
  lifetimeClass: LifetimeClass;
  requirements: JobRequirements;
}

// ── Id grammar (AD-4: Contract = jobId string, type:targetId) ────────────────

const ID_SEPARATOR = ":";

/** The closed set of Job types — used for runtime validation of parsed ids. */
const JOB_TYPES: readonly JobType[] = ["mine", "fill", "build", "upgrade"];

function isJobType(value: string): value is JobType {
  return JOB_TYPES.includes(value as JobType);
}

/**
 * Builds a deterministic JobId from a Job type and target id.
 * Grammar: `${type}:${targetId}`. Stable across Ticks (FR-3).
 */
export function makeJobId(type: JobType, targetId: string): JobId {
  return `${type}${ID_SEPARATOR}${targetId}`;
}

/**
 * Parses a JobId into its type and target.
 * Splits on the first colon only — target ids may contain colons.
 * Throws on malformed ids: no colon present, unknown type, or empty targetId.
 */
export function parseJobId(id: JobId): { type: JobType; targetId: string } {
  const separatorIndex = id.indexOf(ID_SEPARATOR);
  if (separatorIndex === -1) {
    throw new Error(`Invalid JobId "${id}": must follow grammar type:targetId`);
  }
  const type = id.slice(0, separatorIndex);
  const targetId = id.slice(separatorIndex + 1);
  if (!isJobType(type)) {
    throw new Error(`Invalid JobId "${id}": unknown Job type "${type}"`);
  }
  if (targetId.length === 0) {
    throw new Error(`Invalid JobId "${id}": empty targetId`);
  }
  return { type, targetId };
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Constructs a fully-formed Job, computing `id` from `type` and `targetId`
 * so Producers never forget or miscompute the id (FR-3 determinism).
 */
export function makeJob(input: JobInput): Job {
  return {
    id: makeJobId(input.type, input.targetId),
    type: input.type,
    targetId: input.targetId,
    pos: input.pos,
    tier: input.tier,
    withinTierPriority: input.withinTierPriority,
    maxWorkers: input.maxWorkers,
    assignmentMode: input.assignmentMode,
    lifetimeClass: input.lifetimeClass,
    requirements: input.requirements,
  };
}

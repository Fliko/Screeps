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

/**
 * Node: a config-defined pool of work, finer-grained than JobType (AD-11,
 * node-pool-model.md). A single shared typed union defined exactly once here
 * — Producers tag every Job with a NodeName, and Story 4's per-Node config
 * table is keyed by this same union. No second free-string naming scheme.
 */
export type NodeName = "spawns" | "extensions" | "mines" | "build" | "upgrade";
export type PriorityTier = "critical" | "high" | "medium" | "low";
export type AssignmentMode = "reserved" | "pulled";
export type LifetimeClass = "persistent" | "transient";

/** JobId grammar: `type:node:targetId` (AD-4, amended AD-11). Stored in creep.memory.contract as the Contract. */
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
  node: NodeName;
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
  node: NodeName;
  targetId: string;
  pos: RoomPositionData;
  tier: PriorityTier;
  withinTierPriority: number;
  maxWorkers: number;
  assignmentMode: AssignmentMode;
  lifetimeClass: LifetimeClass;
  requirements: JobRequirements;
}

// ── Id grammar (AD-4/AD-11: Contract = jobId string, type:node:targetId) ────

const ID_SEPARATOR = ":";

/** The closed set of Job types — used for runtime validation of parsed ids. */
const JOB_TYPES: readonly JobType[] = ["mine", "fill", "build", "upgrade"];

/** The closed set of Node names — used for runtime validation of parsed ids. */
const NODE_NAMES: readonly NodeName[] = [
  "spawns",
  "extensions",
  "mines",
  "build",
  "upgrade",
];

/** Nodes each Job type may legally carry (AD-11) — every Producer's current node choice. */
const VALID_NODES_BY_TYPE: Record<JobType, readonly NodeName[]> = {
  mine: ["mines"],
  fill: ["spawns", "extensions"],
  build: ["build"],
  upgrade: ["upgrade"],
};

function isJobType(value: string): value is JobType {
  return JOB_TYPES.includes(value as JobType);
}

function isNodeName(value: string): value is NodeName {
  return NODE_NAMES.includes(value as NodeName);
}

/**
 * Builds a deterministic JobId from a Job type, Node, and target id.
 * Grammar: `${type}:${node}:${targetId}`. Stable across Ticks (FR-3).
 */
export function makeJobId(
  type: JobType,
  node: NodeName,
  targetId: string,
): JobId {
  return `${type}${ID_SEPARATOR}${node}${ID_SEPARATOR}${targetId}`;
}

/**
 * Parses a JobId into its type, node, and target.
 * Splits on the first two colons only — target ids may contain colons.
 * Throws on malformed ids: fewer than two colons, unknown type, unknown
 * node, a node not valid for the parsed type, or empty targetId.
 */
export function parseJobId(id: JobId): {
  type: JobType;
  node: NodeName;
  targetId: string;
} {
  const firstSeparatorIndex = id.indexOf(ID_SEPARATOR);
  if (firstSeparatorIndex === -1) {
    throw new Error(
      `Invalid JobId "${id}": must follow grammar type:node:targetId`,
    );
  }
  const secondSeparatorIndex = id.indexOf(
    ID_SEPARATOR,
    firstSeparatorIndex + 1,
  );
  if (secondSeparatorIndex === -1) {
    throw new Error(
      `Invalid JobId "${id}": must follow grammar type:node:targetId`,
    );
  }
  const type = id.slice(0, firstSeparatorIndex);
  const node = id.slice(firstSeparatorIndex + 1, secondSeparatorIndex);
  const targetId = id.slice(secondSeparatorIndex + 1);
  if (!isJobType(type)) {
    throw new Error(`Invalid JobId "${id}": unknown Job type "${type}"`);
  }
  if (!isNodeName(node)) {
    throw new Error(`Invalid JobId "${id}": unknown Node "${node}"`);
  }
  if (!VALID_NODES_BY_TYPE[type].includes(node)) {
    throw new Error(
      `Invalid JobId "${id}": node "${node}" invalid for type "${type}"`,
    );
  }
  if (targetId.length === 0) {
    throw new Error(`Invalid JobId "${id}": empty targetId`);
  }
  return { type, node, targetId };
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Constructs a fully-formed Job, computing `id` from `type`, `node`, and
 * `targetId` so Producers never forget or miscompute the id (FR-3 determinism).
 */
export function makeJob(input: JobInput): Job {
  return {
    id: makeJobId(input.type, input.node, input.targetId),
    type: input.type,
    node: input.node,
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

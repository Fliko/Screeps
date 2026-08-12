// typed MVP constants — values pinned at the first story that uses them
//
// Story 1.2: the boot-marker string logged once per deploy by src/main.ts.
// Story 1.4: CPU metering configuration for control-cycle phases.
// Story 2.3: the Job policy table (FR-22 one-place rule, reconcile G2/G3) —
//   tier / within-tier priority / maxWorkers / assignment mode / lifetime class
//   / requirements per active Job type. Producers read this, never literals.

import type {
  AssignmentMode,
  JobType,
  LifetimeClass,
  PriorityTier,
} from "./board/job";

/** Policy for one Job type — everything Producers must read from config (FR-22). */
export interface JobTypePolicy {
  tier: PriorityTier;
  withinTierPriority: number;
  maxWorkers: number;
  assignmentMode: AssignmentMode;
  lifetimeClass: LifetimeClass;
  requirements: { body: BodyPartConstant[]; ttlFloor: number };
}

/**
 * Per-type policy table, keyed over the three active Generalist-era Job types.
 * `mine` is intentionally absent — the mine Producer + its policy (maxWorkers 1,
 * reserved) land with the Evolution epic (Story 6.2; PRD FR-29; reconcile G4).
 */
export type JobPolicyTable = Record<Exclude<JobType, "mine">, JobTypePolicy>;

/** MVP Generalist body composition (reconcile M2) — all three Jobs require it. */
const GENERALIST_BODY: BodyPartConstant[] = ["work", "carry", "move"];

export interface Config {
  /** Boot marker logged once on the first Tick of a deploy (Story 1.2, AC3). */
  LOG_BOOT: string;
  /** CPU metering flag — when true, phase CPU costs are logged (Story 1.4, AC1). */
  CPU_METERING_ENABLED: boolean;
  /** Log prefix for control-cycle phase metering (Story 1.4, AC1). */
  LOG_PHASE_PREFIX: string;
  /** Per-Job-type policy table — the single tuning home for the Board (Story 2.3). */
  JOB_POLICY_TABLE: JobPolicyTable;
}

const constants: Config = {
  LOG_BOOT: "screeps_ai booted",
  CPU_METERING_ENABLED: false,
  LOG_PHASE_PREFIX: "[control]",
  JOB_POLICY_TABLE: {
    fill: {
      tier: "critical",
      withinTierPriority: 0,
      maxWorkers: 1,
      assignmentMode: "pulled",
      lifetimeClass: "transient",
      requirements: { body: GENERALIST_BODY, ttlFloor: 200 },
    },
    build: {
      tier: "medium",
      withinTierPriority: 0,
      maxWorkers: 1,
      assignmentMode: "pulled",
      lifetimeClass: "transient",
      requirements: { body: GENERALIST_BODY, ttlFloor: 200 },
    },
    upgrade: {
      tier: "low",
      withinTierPriority: 0,
      maxWorkers: Infinity,
      assignmentMode: "pulled",
      lifetimeClass: "persistent",
      requirements: { body: GENERALIST_BODY, ttlFloor: 0 },
    },
  },
};

/**
 * Retrieves a configuration constant by name.
 * Story 1.4: enables test mocking of config values.
 */
export function getConstant<K extends keyof Config>(name: K): Config[K] {
  const value = constants[name];
  if (value === undefined) {
    throw new Error(`Unknown config constant: ${name}`);
  }
  return value;
}

/**
 * Sets a configuration constant by name (for testing).
 * Story 1.4: enables test mutation of config values.
 */
export function setConstant<K extends keyof Config>(
  name: K,
  value: Config[K],
): void {
  constants[name] = value;
}

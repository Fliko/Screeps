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
  /** Board-summary log toggle — when true, `generate` logs the per-Tick Job Board (mirrors CPU_METERING_ENABLED). */
  LOG_BOARD_ENABLED: boolean;
  /** Per-Job-type policy table — the single tuning home for the Board (Story 2.3). */
  JOB_POLICY_TABLE: JobPolicyTable;
  /** Stuck detection threshold — number of consecutive Ticks position must be unchanged (with fatigue === 0) to trigger re-path escalation (Story 3.5, AC2, AC5). */
  MOVEMENT_STUCK_THRESHOLD: number;
  /** Default moveTo options for normal movement — explicit reusePath, no ignoreCreeps (Story 3.5, AC5). */
  MOVEMENT_DEFAULT_OPTS: MoveToOpts;
  /** Re-path moveTo options for escalation — includes ignoreCreeps: true to break stuck (Story 3.5, AC2, AC5). */
  MOVEMENT_REPATH_OPTS: MoveToOpts;
  /** DYING-check threshold — a Creep whose ttl drops below this runs the DYING unload behavior instead of its Job (Story 4.5). */
  CREEP_DYING_TTL_THRESHOLD: number;
  /** Population-maintenance target — control/spawn tops up to this Creep count (Story 5.1). Pinned to 4; see spec Design Notes. */
  SPAWN_TARGET_POPULATION: number;
  /** Body composition control/spawn requests for population top-up (Story 5.1) — reuses the Generalist Body all three Jobs require. */
  SPAWN_BODY_GENERALIST: BodyPartConstant[];
  /** Near-dying replacement threshold — a living, non-Spawning Creep with ttl below this triggers a proactive replacement spawn (Story 5.2). Matches the fill/build Job policy ttlFloor of 200. */
  SPAWN_TTL_REPLACEMENT_THRESHOLD: number;
}

const constants: Config = {
  LOG_BOOT: "screeps_ai booted",
  CPU_METERING_ENABLED: false,
  LOG_PHASE_PREFIX: "[control]",
  LOG_BOARD_ENABLED: false,
  JOB_POLICY_TABLE: {
    fill: {
      tier: "critical",
      withinTierPriority: 0,
      maxWorkers: 6,
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
      lifetimeClass: "transient",
      requirements: { body: GENERALIST_BODY, ttlFloor: 0 },
    },
  },
  MOVEMENT_STUCK_THRESHOLD: 3,
  MOVEMENT_DEFAULT_OPTS: {
    reusePath: 5,
    ignoreCreeps: false,
  },
  MOVEMENT_REPATH_OPTS: {
    reusePath: 5,
    ignoreCreeps: true,
  },
  CREEP_DYING_TTL_THRESHOLD: 50,
  SPAWN_TARGET_POPULATION: 10,
  SPAWN_BODY_GENERALIST: GENERALIST_BODY,
  SPAWN_TTL_REPLACEMENT_THRESHOLD: 200,
};

/**
 * Validates the movement-related slice of a Config object, throwing on the
 * first violation found. Fails fast at module load (called once against
 * `constants` below) so a bad literal (e.g. threshold `0`, a `MoveToOpts`
 * missing `reusePath`) breaks the build instead of misbehaving silently at
 * runtime (Story 3.5 review hardening).
 *
 * Exported so tests can call it directly with crafted `Config`-shaped
 * objects without mutating module-level state.
 */
export function validateMovementConfig(config: Config): void {
  const {
    MOVEMENT_STUCK_THRESHOLD,
    MOVEMENT_DEFAULT_OPTS,
    MOVEMENT_REPATH_OPTS,
  } = config;

  if (
    typeof MOVEMENT_STUCK_THRESHOLD !== "number" ||
    !Number.isInteger(MOVEMENT_STUCK_THRESHOLD) ||
    MOVEMENT_STUCK_THRESHOLD <= 0
  ) {
    throw new Error(
      `Invalid config constant MOVEMENT_STUCK_THRESHOLD: must be a positive integer, got ${MOVEMENT_STUCK_THRESHOLD}`,
    );
  }

  for (const [name, opts] of [
    ["MOVEMENT_DEFAULT_OPTS", MOVEMENT_DEFAULT_OPTS],
    ["MOVEMENT_REPATH_OPTS", MOVEMENT_REPATH_OPTS],
  ] as const) {
    if (!opts || typeof opts !== "object") {
      throw new Error(
        `Invalid config constant ${name}: expected an object, got ${opts}`,
      );
    }
    if (
      typeof opts.reusePath !== "number" ||
      !Number.isFinite(opts.reusePath) ||
      opts.reusePath < 0
    ) {
      throw new Error(
        `Invalid config constant ${name}: missing "reusePath", got ${opts.reusePath}`,
      );
    }
    if (typeof opts.ignoreCreeps !== "boolean") {
      throw new Error(
        `Invalid config constant ${name}: missing "ignoreCreeps", got ${opts.ignoreCreeps}`,
      );
    }
  }
}

validateMovementConfig(constants);

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

// typed MVP constants — values pinned at the first story that uses them
//
// Story 1.2: the boot-marker string logged once per deploy by src/main.ts.
// Story 1.4: CPU metering configuration for control-cycle phases.

export interface Config {
  /** Boot marker logged once on the first Tick of a deploy (Story 1.2, AC3). */
  LOG_BOOT: string;
  /** CPU metering flag — when true, phase CPU costs are logged (Story 1.4, AC1). */
  CPU_METERING_ENABLED: boolean;
  /** Log prefix for control-cycle phase metering (Story 1.4, AC1). */
  LOG_PHASE_PREFIX: string;
}

const constants: Config = {
  LOG_BOOT: "screeps_ai booted — Story 1.2 walking skeleton up",
  CPU_METERING_ENABLED: true,
  LOG_PHASE_PREFIX: "[control]",
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

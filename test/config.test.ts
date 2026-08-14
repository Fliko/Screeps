import { describe, expect, it } from "vitest";
import type { Config } from "../src/config";
import { getConstant, validateMovementConfig } from "../src/config";

/** Builds a valid Config-shaped object, overridable per test. */
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    LOG_BOOT: getConstant("LOG_BOOT"),
    CPU_METERING_ENABLED: getConstant("CPU_METERING_ENABLED"),
    LOG_PHASE_PREFIX: getConstant("LOG_PHASE_PREFIX"),
    JOB_POLICY_TABLE: getConstant("JOB_POLICY_TABLE"),
    MOVEMENT_STUCK_THRESHOLD: 3,
    MOVEMENT_DEFAULT_OPTS: { reusePath: 5, ignoreCreeps: false },
    MOVEMENT_REPATH_OPTS: { reusePath: 5, ignoreCreeps: true },
    CREEP_DYING_TTL_THRESHOLD: getConstant("CREEP_DYING_TTL_THRESHOLD"),
    ...overrides,
  };
}

describe("validateMovementConfig", () => {
  it("does not throw for a valid config", () => {
    expect(() => validateMovementConfig(makeConfig())).not.toThrow();
  });

  it("does not throw for the current shipped constants", () => {
    expect(() =>
      validateMovementConfig({
        LOG_BOOT: getConstant("LOG_BOOT"),
        CPU_METERING_ENABLED: getConstant("CPU_METERING_ENABLED"),
        LOG_PHASE_PREFIX: getConstant("LOG_PHASE_PREFIX"),
        JOB_POLICY_TABLE: getConstant("JOB_POLICY_TABLE"),
        MOVEMENT_STUCK_THRESHOLD: getConstant("MOVEMENT_STUCK_THRESHOLD"),
        MOVEMENT_DEFAULT_OPTS: getConstant("MOVEMENT_DEFAULT_OPTS"),
        MOVEMENT_REPATH_OPTS: getConstant("MOVEMENT_REPATH_OPTS"),
        CREEP_DYING_TTL_THRESHOLD: getConstant("CREEP_DYING_TTL_THRESHOLD"),
      }),
    ).not.toThrow();
  });

  it("throws when MOVEMENT_STUCK_THRESHOLD is 0", () => {
    expect(() =>
      validateMovementConfig(makeConfig({ MOVEMENT_STUCK_THRESHOLD: 0 })),
    ).toThrow(/MOVEMENT_STUCK_THRESHOLD/);
  });

  it("throws when MOVEMENT_STUCK_THRESHOLD is negative", () => {
    expect(() =>
      validateMovementConfig(makeConfig({ MOVEMENT_STUCK_THRESHOLD: -1 })),
    ).toThrow(/MOVEMENT_STUCK_THRESHOLD/);
  });

  it("throws when MOVEMENT_STUCK_THRESHOLD is non-integer", () => {
    expect(() =>
      validateMovementConfig(makeConfig({ MOVEMENT_STUCK_THRESHOLD: 2.5 })),
    ).toThrow(/MOVEMENT_STUCK_THRESHOLD/);
  });

  it("throws when MOVEMENT_STUCK_THRESHOLD is not a number", () => {
    expect(() =>
      validateMovementConfig(
        makeConfig({
          MOVEMENT_STUCK_THRESHOLD: "3" as unknown as number,
        }),
      ),
    ).toThrow(/MOVEMENT_STUCK_THRESHOLD/);
  });

  it("throws when MOVEMENT_STUCK_THRESHOLD is NaN", () => {
    expect(() =>
      validateMovementConfig(makeConfig({ MOVEMENT_STUCK_THRESHOLD: NaN })),
    ).toThrow(/MOVEMENT_STUCK_THRESHOLD/);
  });

  it("throws when MOVEMENT_DEFAULT_OPTS is missing reusePath", () => {
    expect(() =>
      validateMovementConfig(
        makeConfig({
          MOVEMENT_DEFAULT_OPTS: {
            ignoreCreeps: false,
          } as unknown as Config["MOVEMENT_DEFAULT_OPTS"],
        }),
      ),
    ).toThrow(/MOVEMENT_DEFAULT_OPTS/);
  });

  it("throws when MOVEMENT_DEFAULT_OPTS is missing ignoreCreeps", () => {
    expect(() =>
      validateMovementConfig(
        makeConfig({
          MOVEMENT_DEFAULT_OPTS: {
            reusePath: 5,
          } as unknown as Config["MOVEMENT_DEFAULT_OPTS"],
        }),
      ),
    ).toThrow(/MOVEMENT_DEFAULT_OPTS/);
  });

  it("throws when MOVEMENT_REPATH_OPTS is missing reusePath", () => {
    expect(() =>
      validateMovementConfig(
        makeConfig({
          MOVEMENT_REPATH_OPTS: {
            ignoreCreeps: true,
          } as unknown as Config["MOVEMENT_REPATH_OPTS"],
        }),
      ),
    ).toThrow(/MOVEMENT_REPATH_OPTS/);
  });

  it("throws when MOVEMENT_REPATH_OPTS is missing ignoreCreeps", () => {
    expect(() =>
      validateMovementConfig(
        makeConfig({
          MOVEMENT_REPATH_OPTS: {
            reusePath: 5,
          } as unknown as Config["MOVEMENT_REPATH_OPTS"],
        }),
      ),
    ).toThrow(/MOVEMENT_REPATH_OPTS/);
  });
});

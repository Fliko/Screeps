import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as matchModule from "../src/control/match";
import type { TakenSet } from "../src/control/taken";
import { getTakenCount } from "../src/control/taken";
import * as validateModule from "../src/control/validate";
import type { CreepStub, GameAdapter } from "../src/game";
import { setGame } from "../src/game";
import type { MemoryStore } from "../src/memory";
import { setMemory } from "../src/memory";
import { getCurrentSnapshot } from "../src/world/snapshot";

function createMockGame(
  cpuGetUsed: () => number = () => 0,
  creeps: CreepStub[] = [],
): GameAdapter {
  return {
    cpu: { getUsed: cpuGetUsed },
    getRooms: () => ["sim"],
    findMyStructures: () => [],
    findConstructionSites: () => [],
    findCreeps: () => creeps,
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getObjectById: () => undefined,
  };
}

/**
 * A Creep as the adapter sees it. `ttl` 0 models a Creep still Spawning —
 * `spawnCreep` puts it in FIND_MY_CREEPS immediately with its Reserved
 * Contract already written, and `ticksToLive` undefined maps to 0.
 */
function createCreep(id: string, contract?: string, ttl = 1500): CreepStub {
  return {
    id,
    pos: { x: 0, y: 0, roomName: "sim" },
    body: ["work", "carry", "move"],
    ttl,
    carry: 0,
    carryCapacity: 50,
    memory: contract === undefined ? {} : { contract },
  };
}

describe("Control Cycle - Phase Order (AC3)", () => {
  let cpuUsed: number;

  beforeEach(async () => {
    cpuUsed = 0;
    setGame(createMockGame());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(console.log).mockClear();
    // Reset config to defaults
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);
  });

  it("should invoke phases in AD-9 order using fake world snapshot", async () => {
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);

    // Setup: mock Game.cpu.getUsed() to return incrementing values
    setGame(
      createMockGame(() => {
        cpuUsed += 0.5;
        return cpuUsed;
      }),
    );

    const { loop } = await import("../src/main");

    // Call loop once
    loop();

    // Verify console.log was called with phase names in order
    const mockLog = vi.mocked(console.log);
    const logCalls = mockLog.mock.calls.map((call) => call[0]);

    // Filter for phase logs (they contain "[control]")
    const phaseLogs = logCalls.filter(
      (log: string) => typeof log === "string" && log.includes("[control]"),
    );

    // Verify we have 5 phase logs
    expect(phaseLogs).toHaveLength(5);

    // Verify phase order
    expect(phaseLogs[0]).toContain("generate");
    expect(phaseLogs[1]).toContain("deriveTakenSet");
    expect(phaseLogs[2]).toContain("validate");
    expect(phaseLogs[3]).toContain("match");
    expect(phaseLogs[4]).toContain("spawn");

    // Verify each log is prefixed with [control]
    phaseLogs.forEach((log: string) => {
      expect(log).toMatch(/^\[control\]/);
    });

    // Story 2.1: generate() built a real plain-data snapshot
    const snapshot = getCurrentSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot?.roomName).toBe("sim");
  });

  it("should not emit metering logs when CPU_METERING_ENABLED is false (AC2)", async () => {
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", false);

    const { loop } = await import("../src/main");
    loop();

    const logCalls = vi.mocked(console.log).mock.calls.map((call) => call[0]);
    const phaseLogs = logCalls.filter(
      (log: string) => typeof log === "string" && log.includes("[control]"),
    );

    expect(phaseLogs).toHaveLength(0);
  });
});

describe("Control Cycle - Zero Colony Memory (AC4)", () => {
  let cpuUsed: number;
  let memory: MemoryStore;

  beforeEach(async () => {
    cpuUsed = 0;
    setGame(createMockGame());
    memory = {};
    setMemory(memory);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(console.log).mockClear();
    // Reset config to defaults
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);
  });

  it("should not write any colony-level keys to Memory after N Ticks (AD-5)", async () => {
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);

    setGame(
      createMockGame(() => {
        cpuUsed += 0.5;
        return cpuUsed;
      }),
    );

    const { loop } = await import("../src/main");

    // Simulate N Ticks
    for (let i = 0; i < 10; i++) {
      loop();
    }

    // Verify Memory remains empty (no colony-level keys)
    expect(Object.keys(memory)).toHaveLength(0);
  });
});

describe("Control Cycle - Taken-Set Wiring (AC5)", () => {
  beforeEach(async () => {
    setGame(createMockGame());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(console.log).mockClear();
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", false);
  });

  // These spies replace live module exports; without this the replacements
  // leak into every test declared after this block.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes the taken-set to validate, then to match", async () => {
    const validateSpy = vi.spyOn(validateModule, "validate");
    const matchSpy = vi.spyOn(matchModule, "match");

    const { loop } = await import("../src/main");
    loop();

    expect(validateSpy).toHaveBeenCalledTimes(1);
    expect(matchSpy).toHaveBeenCalledTimes(1);

    const takenSetArg = validateSpy.mock.calls[0]?.[0];
    expect(takenSetArg).toBeDefined();
    // validate cleared nothing, so match receives the very same instance
    expect(matchSpy).toHaveBeenCalledWith(takenSetArg);
  });

  it("counts Contracts held by Creeps in the snapshot (AC2)", async () => {
    setGame(
      createMockGame(
        () => 0,
        [
          createCreep("c1", "fill:spawn1"),
          createCreep("c2", "fill:spawn1"),
          createCreep("c3", "build:site1"),
          createCreep("c4"),
        ],
      ),
    );
    const validateSpy = vi.spyOn(validateModule, "validate");

    const { loop } = await import("../src/main");
    loop();

    const taken = validateSpy.mock.calls[0]?.[0] as TakenSet;
    expect(getTakenCount(taken, "fill:spawn1")).toBe(2);
    expect(getTakenCount(taken, "build:site1")).toBe(1);
    expect(taken.entries.size).toBe(2);
  });

  it("counts the Contract of a Creep that is still Spawning (AC3)", async () => {
    setGame(
      createMockGame(() => 0, [createCreep("spawning1", "mine:source1", 0)]),
    );
    const validateSpy = vi.spyOn(validateModule, "validate");

    const { loop } = await import("../src/main");
    loop();

    const taken = validateSpy.mock.calls[0]?.[0] as TakenSet;
    expect(getTakenCount(taken, "mine:source1")).toBe(1);
  });

  it("recomputes the taken-set each Tick, carrying nothing over (AC4)", async () => {
    const validateSpy = vi.spyOn(validateModule, "validate");
    const { loop } = await import("../src/main");

    setGame(createMockGame(() => 0, [createCreep("c1", "fill:spawn1")]));
    loop();
    setGame(createMockGame(() => 0, [createCreep("c2", "build:site1")]));
    loop();

    const first = validateSpy.mock.calls[0]?.[0] as TakenSet;
    const second = validateSpy.mock.calls[1]?.[0] as TakenSet;
    expect(getTakenCount(first, "fill:spawn1")).toBe(1);
    expect(getTakenCount(second, "fill:spawn1")).toBe(0);
    expect(getTakenCount(second, "build:site1")).toBe(1);
  });

  it("releases Contracts cleared by validate before match reads capacity", async () => {
    setGame(
      createMockGame(
        () => 0,
        [createCreep("c1", "fill:spawn1"), createCreep("c2", "fill:spawn1")],
      ),
    );
    vi.spyOn(validateModule, "validate").mockReturnValue([
      { jobId: "fill:spawn1" },
    ]);
    const matchSpy = vi.spyOn(matchModule, "match");

    const { loop } = await import("../src/main");
    loop();

    const taken = matchSpy.mock.calls[0]?.[0] as TakenSet;
    expect(getTakenCount(taken, "fill:spawn1")).toBe(1);
  });
});

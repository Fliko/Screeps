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

// STRUCTURE_SPAWN is an ambient `declare const` the real engine provides as
// a runtime global — vitest/Node does not. control/spawn.ts (wired into the
// AD-9 cycle exercised below via loop()) references it directly, so the test
// stubs it onto globalThis, mirroring test/agents/behaviors/build.test.ts.
Object.assign(globalThis, { STRUCTURE_SPAWN: "spawn" });

function createMockGame(
  cpuGetUsed: () => number = () => 0,
  creeps: CreepStub[] = [],
): GameAdapter {
  return {
    cpu: { getUsed: cpuGetUsed },
    getRooms: () => ["sim"],
    findMyStructures: () => [],
    findConstructionSites: () => [],
    findSources: () => [],
    findCreeps: () => creeps,
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => 0,
    // Screeps resolves ids to live objects; the Creep stubs stand in for them so
    // world/creeps.ts can clear real memory in the wiring tests.
    getObjectById: ((id: string) =>
      creeps.find((creep) => creep.id === id)) as GameAdapter["getObjectById"],
  };
}

/**
 * A Creep as the adapter sees it. `spawning: true` models a Creep still being
 * spawned — `spawnCreep` puts it in FIND_MY_CREEPS immediately with its Reserved
 * Contract already written, and its `ticksToLive` is undefined (mapped to 0).
 */
function createCreep(
  id: string,
  contract?: string,
  ttl = 1500,
  spawning = false,
): CreepStub {
  return {
    id,
    pos: { x: 0, y: 0, roomName: "sim" },
    body: ["work", "carry", "move"],
    ttl,
    carry: 0,
    carryCapacity: 50,
    spawning,
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

    // Verify we have 6 phase logs
    expect(phaseLogs).toHaveLength(6);

    // Verify phase order
    expect(phaseLogs[0]).toContain("generate");
    expect(phaseLogs[1]).toContain("deriveTakenSet");
    expect(phaseLogs[2]).toContain("validate");
    expect(phaseLogs[3]).toContain("match");
    expect(phaseLogs[4]).toContain("spawn");
    expect(phaseLogs[5]).toContain("execute");

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
      createMockGame(
        () => 0,
        [createCreep("spawning1", "mine:source1", 0, true)],
      ),
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

  it("clears a Contract whose target is absent and releases it before match", async () => {
    // No structures in the mock room, so the fill Job is not on this Tick's Board.
    const creep = createCreep("c1", "fill:spawn1");
    setGame(createMockGame(() => 0, [creep]));
    const validateSpy = vi.spyOn(validateModule, "validate");
    const matchSpy = vi.spyOn(matchModule, "match");

    const { loop } = await import("../src/main");
    loop();

    // The Contract was counted when validate ran...
    const beforeRelease = validateSpy.mock.calls[0]?.[0] as TakenSet;
    expect(getTakenCount(beforeRelease, "fill:spawn1")).toBe(1);
    // ...and released by the time match reads capacity.
    const afterRelease = matchSpy.mock.calls[0]?.[0] as TakenSet;
    expect(getTakenCount(afterRelease, "fill:spawn1")).toBe(0);
    // The real Creep's memory was mutated, not just the reported taken-set.
    expect(creep.memory.contract).toBeUndefined();
  });
});

describe("Control Cycle - Match Wiring (Story 3.4)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("gives exactly one of two idle Creeps a real memory.contract write for a maxWorkers:1 Job", async () => {
    // fill Jobs (config.ts JOB_POLICY_TABLE) are pulled — this test's premise
    // (single winner) requires exactly one open slot, so it pins maxWorkers
    // to 1 for its own duration regardless of the live tuning value, and
    // restores it after (config numbers are an operator tuning knob, not
    // fixed by this test).
    const config = await import("../src/config");
    const originalPolicy = config.getConstant("JOB_POLICY_TABLE");
    config.setConstant("JOB_POLICY_TABLE", {
      ...originalPolicy,
      fill: { ...originalPolicy.fill, maxWorkers: 1 },
    });

    try {
      // real generate/spawn Producer emits one fill Job when a spawn is
      // under capacity and reachable, so two idle Creeps compete for it.
      const spawn = {
        id: "spawn1",
        pos: { x: 5, y: 5, roomName: "sim" },
        structureType: "spawn" as StructureConstant,
        energy: 0,
        energyCapacity: 300,
      };
      const c1 = {
        id: "c1",
        pos: { x: 0, y: 0, roomName: "sim" },
        body: ["work", "carry", "move"] as BodyPartConstant[],
        ttl: 1500,
        carry: 0,
        carryCapacity: 50,
        spawning: false,
        memory: {},
      };
      const c2 = {
        id: "c2",
        pos: { x: 1, y: 1, roomName: "sim" },
        body: ["work", "carry", "move"] as BodyPartConstant[],
        ttl: 1500,
        carry: 0,
        carryCapacity: 50,
        spawning: false,
        memory: {},
      };
      const creeps = [c1, c2];
      setGame({
        cpu: { getUsed: () => 0 },
        getRooms: () => ["sim"],
        findMyStructures: () => [spawn],
        findConstructionSites: () => [],
        findSources: () => [],
        findCreeps: () => creeps,
        getController: () => undefined,
        getTerrain: () => ({ get: () => 0 }),
        getTime: () => 0,
        getObjectById: ((id: string) =>
          creeps.find(
            (creep) => creep.id === id,
          )) as GameAdapter["getObjectById"],
      });

      const { loop } = await import("../src/main");
      loop();

      const assigned = creeps.filter(
        (creep) =>
          (creep.memory as { contract?: string }).contract !== undefined,
      );
      expect(assigned).toHaveLength(1);
      const winner = assigned[0];
      if (!winner) {
        throw new Error("expected exactly one assigned Creep");
      }
      // match() processes idle Creeps in snapshot order, not by distance —
      // distance only breaks ties between multiple Jobs for one Creep
      // (covered directly in match.test.ts). With a single maxWorkers:1 Job
      // and two competing Creeps, the claim lock is first-come: c1 is first
      // in snapshot order, so c1 deterministically wins regardless of c1/c2
      // being farther from the Job than c2.
      expect(winner.id).toBe("c1");
      expect((winner.memory as { contract?: string }).contract).toBe(
        "fill:spawn1",
      );
    } finally {
      config.setConstant("JOB_POLICY_TABLE", originalPolicy);
    }
  });
});

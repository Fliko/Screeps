import { afterEach, describe, expect, it, vi } from "vitest";
import type { CreepStub, GameAdapter } from "../../../src/game";
import { setGame } from "../../../src/game";
import { buildWorldSnapshot } from "../../../src/world/snapshot";

// Hoisted mocks: run.ts imports runFill/runBuild from these modules, so
// mocking them here (before run.ts is imported below) intercepts the
// dispatch table entries.
const runFillMock = vi.fn();
vi.mock("../../../src/agents/behaviors/fill", () => ({
  runFill: (creepId: string, jobId: string) => runFillMock(creepId, jobId),
}));

const runBuildMock = vi.fn();
vi.mock("../../../src/agents/behaviors/build", () => ({
  runBuild: (creepId: string, jobId: string) => runBuildMock(creepId, jobId),
}));

const runUpgradeMock = vi.fn();
vi.mock("../../../src/agents/behaviors/upgrade", () => ({
  runUpgrade: (creepId: string, jobId: string) =>
    runUpgradeMock(creepId, jobId),
}));

const runHarvestMock = vi.fn();
vi.mock("../../../src/agents/behaviors/harvest", () => ({
  runHarvest: (creepId: string, jobId: string) =>
    runHarvestMock(creepId, jobId),
}));

const runDyingUnloadMock = vi.fn();
vi.mock("../../../src/agents/behaviors/dying", () => ({
  runDyingUnload: (creepId: string) => runDyingUnloadMock(creepId),
}));

const runWithdrawSourceMock = vi.fn();
vi.mock("../../../src/agents/behaviors/withdraw", () => ({
  runWithdrawSource: (creepId: string) => runWithdrawSourceMock(creepId),
}));

const { runBehaviors } = await import("../../../src/agents/behaviors/run");

function createCreep(
  id: string,
  contract?: string,
  options: { ttl?: number; spawning?: boolean } = {},
): CreepStub {
  const { ttl = 1500, spawning = false } = options;
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

function createMockGame(creeps: CreepStub[]): GameAdapter {
  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    findMyStructures: () => [],
    findConstructionSites: () => [],
    findSources: () => [],
    findCreeps: () => creeps,
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => 0,
    getEnergyAvailable: () => 300,
    getObjectById: ((id: string) =>
      creeps.find((creep) => creep.id === id)) as GameAdapter["getObjectById"],
  };
}

afterEach(() => {
  runFillMock.mockClear();
  runBuildMock.mockClear();
  runUpgradeMock.mockClear();
  runHarvestMock.mockClear();
  runDyingUnloadMock.mockClear();
  runWithdrawSourceMock.mockClear();
  setGame();
});

describe("runBehaviors — dispatch", () => {
  it("calls runFill for a Creep holding a fill Contract", () => {
    const creep = createCreep("c1", "fill:spawns:spawn1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runFillMock).toHaveBeenCalledWith("c1", "fill:spawns:spawn1");
  });

  it("is a no-op for a Creep with no Contract", () => {
    const creep = createCreep("c1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runFillMock).not.toHaveBeenCalled();
  });

  it("calls runBuild for a Creep holding a build Contract", () => {
    const creep = createCreep("c1", "build:build:site1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runBuildMock).toHaveBeenCalledWith("c1", "build:build:site1");
  });

  it("calls runUpgrade for a Creep holding an upgrade Contract", () => {
    const creep = createCreep("c1", "upgrade:upgrade:controller1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runUpgradeMock).toHaveBeenCalledWith(
      "c1",
      "upgrade:upgrade:controller1",
    );
  });

  it("calls runHarvest for a Creep holding a mine Contract (Story 6.5)", () => {
    const creep = createCreep("c1", "mine:mines:source1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runHarvestMock).toHaveBeenCalledWith("c1", "mine:mines:source1");
  });

  it("is a no-op when there is no snapshot", () => {
    setGame(createMockGame([]));

    expect(() => runBehaviors()).not.toThrow();
    expect(runFillMock).not.toHaveBeenCalled();
  });

  it("dispatches each Contracted Creep in the snapshot independently", () => {
    const c1 = createCreep("c1", "fill:spawns:spawn1");
    const c2 = createCreep("c2", "fill:extensions:ext1");
    const idle = createCreep("c3");
    setGame(createMockGame([c1, c2, idle]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runFillMock).toHaveBeenCalledTimes(2);
    expect(runFillMock).toHaveBeenNthCalledWith(1, "c1", "fill:spawns:spawn1");
    expect(runFillMock).toHaveBeenNthCalledWith(
      2,
      "c2",
      "fill:extensions:ext1",
    );
  });
});

describe("runBehaviors — DYING interceptor (Story 4.5)", () => {
  it("dispatches a Creep below the ttl threshold to runDyingUnload, not its Job behavior", () => {
    const creep = createCreep("c1", "fill:spawns:spawn1", { ttl: 49 });
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runDyingUnloadMock).toHaveBeenCalledWith("c1");
    expect(runFillMock).not.toHaveBeenCalled();
  });

  it("dispatches a Creep below the ttl threshold with no Contract to runDyingUnload", () => {
    const creep = createCreep("c1", undefined, { ttl: 10 });
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runDyingUnloadMock).toHaveBeenCalledWith("c1");
    expect(runFillMock).not.toHaveBeenCalled();
    expect(runBuildMock).not.toHaveBeenCalled();
    expect(runUpgradeMock).not.toHaveBeenCalled();
  });

  it("does not treat a Creep at or above the ttl threshold as dying", () => {
    const creep = createCreep("c1", "fill:spawns:spawn1", { ttl: 50 });
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runDyingUnloadMock).not.toHaveBeenCalled();
    expect(runFillMock).toHaveBeenCalledWith("c1", "fill:spawns:spawn1");
  });

  it("does not treat a spawning Creep (ttl reads 0) as dying", () => {
    const creep = createCreep("c1", "fill:spawns:spawn1", {
      ttl: 0,
      spawning: true,
    });
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runDyingUnloadMock).not.toHaveBeenCalled();
    expect(runFillMock).not.toHaveBeenCalled();
  });

  it("logs and continues dispatch when runDyingUnload throws for one Creep", () => {
    runDyingUnloadMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const dying = createCreep("c1", "fill:spawns:spawn1", { ttl: 10 });
    const other = createCreep("c2", "fill:extensions:ext1");
    setGame(createMockGame([dying, other]));
    buildWorldSnapshot();

    expect(() => runBehaviors()).not.toThrow();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("runDyingUnload threw for Creep c1"),
    );
    expect(runFillMock).toHaveBeenCalledWith("c2", "fill:extensions:ext1");
    logSpy.mockRestore();
  });
});

describe("runBehaviors — WITHDRAW interceptor (Story 6.6)", () => {
  it("dispatches a Collector with a fill Contract and empty carry to runWithdrawSource, not runFill", () => {
    // Collector body is ["work", "carry", "carry", "move"]
    const collector = {
      id: "c1",
      pos: { x: 0, y: 0, roomName: "sim" },
      body: ["work", "carry", "carry", "move"] as BodyPartConstant[],
      ttl: 1500,
      carry: 0,
      carryCapacity: 100,
      spawning: false,
      memory: { contract: "fill:spawns:spawn1" },
    };
    setGame(createMockGame([collector]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runWithdrawSourceMock).toHaveBeenCalledWith("c1");
    expect(runFillMock).not.toHaveBeenCalled();
  });

  it("dispatches a Collector with a build Contract and empty carry to runWithdrawSource, not runBuild", () => {
    const collector = {
      id: "c1",
      pos: { x: 0, y: 0, roomName: "sim" },
      body: ["work", "carry", "carry", "move"] as BodyPartConstant[],
      ttl: 1500,
      carry: 0,
      carryCapacity: 100,
      spawning: false,
      memory: { contract: "build:build:site1" },
    };
    setGame(createMockGame([collector]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runWithdrawSourceMock).toHaveBeenCalledWith("c1");
    expect(runBuildMock).not.toHaveBeenCalled();
  });

  it("dispatches a Collector with an upgrade Contract and empty carry to runWithdrawSource, not runUpgrade", () => {
    const collector = {
      id: "c1",
      pos: { x: 0, y: 0, roomName: "sim" },
      body: ["work", "carry", "carry", "move"] as BodyPartConstant[],
      ttl: 1500,
      carry: 0,
      carryCapacity: 100,
      spawning: false,
      memory: { contract: "upgrade:upgrade:controller1" },
    };
    setGame(createMockGame([collector]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runWithdrawSourceMock).toHaveBeenCalledWith("c1");
    expect(runUpgradeMock).not.toHaveBeenCalled();
  });

  it("does not dispatch a Collector with nonzero carry to runWithdrawSource, dispatches to normal Job behavior instead", () => {
    const collector = {
      id: "c1",
      pos: { x: 0, y: 0, roomName: "sim" },
      body: ["work", "carry", "carry", "move"] as BodyPartConstant[],
      ttl: 1500,
      carry: 25,
      carryCapacity: 100,
      spawning: false,
      memory: { contract: "fill:spawns:spawn1" },
    };
    setGame(createMockGame([collector]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runWithdrawSourceMock).not.toHaveBeenCalled();
    expect(runFillMock).toHaveBeenCalledWith("c1", "fill:spawns:spawn1");
  });

  it("does not dispatch a Generalist to runWithdrawSource (harvest body), dispatches to normal Job behavior instead", () => {
    const generalist = {
      id: "c1",
      pos: { x: 0, y: 0, roomName: "sim" },
      body: ["work", "carry", "move"] as BodyPartConstant[],
      ttl: 1500,
      carry: 0,
      carryCapacity: 50,
      spawning: false,
      memory: { contract: "fill:spawns:spawn1" },
    };
    setGame(createMockGame([generalist]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runWithdrawSourceMock).not.toHaveBeenCalled();
    expect(runFillMock).toHaveBeenCalledWith("c1", "fill:spawns:spawn1");
  });

  it("does not dispatch a Harvester to runWithdrawSource (harvest body), dispatches to normal Job behavior instead", () => {
    const harvester = {
      id: "c1",
      pos: { x: 0, y: 0, roomName: "sim" },
      body: ["work", "work", "carry", "move"] as BodyPartConstant[],
      ttl: 1500,
      carry: 0,
      carryCapacity: 50,
      spawning: false,
      memory: { contract: "mine:mines:source1" },
    };
    setGame(createMockGame([harvester]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runWithdrawSourceMock).not.toHaveBeenCalled();
    expect(runHarvestMock).toHaveBeenCalledWith("c1", "mine:mines:source1");
  });

  it("logs and continues dispatch when runWithdrawSource throws for one Creep", () => {
    runWithdrawSourceMock.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const withdrawing = {
      id: "c1",
      pos: { x: 0, y: 0, roomName: "sim" },
      body: ["work", "carry", "carry", "move"] as BodyPartConstant[],
      ttl: 1500,
      carry: 0,
      carryCapacity: 100,
      spawning: false,
      memory: { contract: "fill:spawns:spawn1" },
    };
    const other = createCreep("c2", "fill:extensions:ext1");
    setGame(createMockGame([withdrawing, other]));
    buildWorldSnapshot();

    expect(() => runBehaviors()).not.toThrow();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("runWithdrawSource threw for Creep c1"),
    );
    expect(runFillMock).toHaveBeenCalledWith("c2", "fill:extensions:ext1");
    logSpy.mockRestore();
  });

  it("DYING interceptor takes precedence over WITHDRAW interceptor for a dying Collector", () => {
    const dyingCollector = {
      id: "c1",
      pos: { x: 0, y: 0, roomName: "sim" },
      body: ["work", "carry", "carry", "move"] as BodyPartConstant[],
      ttl: 49, // Below CREEP_DYING_TTL_THRESHOLD (50)
      carry: 0,
      carryCapacity: 100,
      spawning: false,
      memory: { contract: "fill:spawns:spawn1" },
    };
    setGame(createMockGame([dyingCollector]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runDyingUnloadMock).toHaveBeenCalledWith("c1");
    expect(runWithdrawSourceMock).not.toHaveBeenCalled();
    expect(runFillMock).not.toHaveBeenCalled();
  });
});

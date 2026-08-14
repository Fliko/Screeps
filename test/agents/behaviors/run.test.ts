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

const { runBehaviors } = await import("../../../src/agents/behaviors/run");

function createCreep(id: string, contract?: string): CreepStub {
  return {
    id,
    pos: { x: 0, y: 0, roomName: "sim" },
    body: ["work", "carry", "move"],
    ttl: 1500,
    carry: 0,
    carryCapacity: 50,
    spawning: false,
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
    getObjectById: ((id: string) =>
      creeps.find((creep) => creep.id === id)) as GameAdapter["getObjectById"],
  };
}

afterEach(() => {
  runFillMock.mockClear();
  runBuildMock.mockClear();
  setGame();
});

describe("runBehaviors — dispatch", () => {
  it("calls runFill for a Creep holding a fill Contract", () => {
    const creep = createCreep("c1", "fill:spawn1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runFillMock).toHaveBeenCalledWith("c1", "fill:spawn1");
  });

  it("is a no-op for a Creep with no Contract", () => {
    const creep = createCreep("c1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runFillMock).not.toHaveBeenCalled();
  });

  it("calls runBuild for a Creep holding a build Contract", () => {
    const creep = createCreep("c1", "build:site1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runBuildMock).toHaveBeenCalledWith("c1", "build:site1");
  });

  it("is a no-op for a Contract whose Job type has no dispatch entry (upgrade)", () => {
    const creep = createCreep("c1", "upgrade:controller1");
    setGame(createMockGame([creep]));
    buildWorldSnapshot();

    expect(() => runBehaviors()).not.toThrow();
    expect(runFillMock).not.toHaveBeenCalled();
  });

  it("is a no-op when there is no snapshot", () => {
    setGame(createMockGame([]));

    expect(() => runBehaviors()).not.toThrow();
    expect(runFillMock).not.toHaveBeenCalled();
  });

  it("dispatches each Contracted Creep in the snapshot independently", () => {
    const c1 = createCreep("c1", "fill:spawn1");
    const c2 = createCreep("c2", "fill:ext1");
    const idle = createCreep("c3");
    setGame(createMockGame([c1, c2, idle]));
    buildWorldSnapshot();

    runBehaviors();

    expect(runFillMock).toHaveBeenCalledTimes(2);
    expect(runFillMock).toHaveBeenNthCalledWith(1, "c1", "fill:spawn1");
    expect(runFillMock).toHaveBeenNthCalledWith(2, "c2", "fill:ext1");
  });
});

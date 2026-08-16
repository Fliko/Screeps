import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runWithdrawSource } from "../../../src/agents/behaviors/withdraw";
import type { GameAdapter } from "../../../src/game";
import { setGame } from "../../../src/game";
import { buildWorldSnapshot } from "../../../src/world/snapshot";

/**
 * Mock live-object factory. Creeps carry a `withdraw` spy; Containers
 * are plain-data stand-ins with an id and pos.
 *
 * Screeps constants (OK, ERR_*, RESOURCE_ENERGY) are ambient `declare const`
 * types the real engine provides as runtime globals — vitest/Node does not.
 */
const OK_CODE = 0; // OK
const ERR_NOT_IN_RANGE_CODE = -9; // ERR_NOT_IN_RANGE
const ERR_NOT_OWNER_CODE = -1; // ERR_NOT_OWNER
const ERR_NOT_ENOUGH_RESOURCES_CODE = -6; // ERR_NOT_ENOUGH_RESOURCES
const RESOURCE_ENERGY_VALUE = "energy"; // RESOURCE_ENERGY

Object.assign(globalThis, {
  OK: OK_CODE,
  ERR_NOT_IN_RANGE: ERR_NOT_IN_RANGE_CODE,
  ERR_NOT_ENOUGH_RESOURCES: ERR_NOT_ENOUGH_RESOURCES_CODE,
  RESOURCE_ENERGY: RESOURCE_ENERGY_VALUE,
});

function createMockCreep(options: {
  x?: number;
  y?: number;
  energy?: number;
  withdrawResult?: ScreepsReturnCode;
}): Creep {
  const {
    x = 10,
    y = 10,
    energy = 0,
    withdrawResult = OK_CODE as ScreepsReturnCode,
  } = options;
  return {
    id: "creep1",
    pos: { x, y, roomName: "sim" },
    carry: { energy },
    fatigue: 0,
    memory: {},
    withdraw: vi.fn(() => withdrawResult),
    moveTo: vi.fn(() => OK_CODE),
  } as unknown as Creep;
}

function createContainer(
  id: string,
  x: number,
  y: number,
  energy: number = 1500,
  energyCapacity: number = 2000,
) {
  return {
    id,
    pos: { x, y, roomName: "sim" },
    structureType: "container" as const,
    energy,
    energyCapacity,
  };
}

function createMockGame(
  resolve: (id: string) => unknown,
  containers: ReturnType<typeof createContainer>[] = [],
): GameAdapter {
  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    findMyStructures: () => containers,
    findConstructionSites: () => [],
    findSources: () => [],
    findCreeps: () => [],
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => 0,
    getEnergyAvailable: () => 300,
    getObjectById: ((id: string) =>
      resolve(id)) as GameAdapter["getObjectById"],
  };
}

const NEAR_CONTAINER = createContainer("container1", 11, 10, 1500, 2000);
const FAR_CONTAINER = createContainer("container2", 40, 40, 1500, 2000);
const EMPTY_CONTAINER = createContainer("container3", 11, 10, 0, 2000);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setGame();
});

describe("runWithdrawSource — sourcing (empty carry)", () => {
  it("moves toward the nearest valid Container when out of range, without withdrawing", () => {
    const creep = createMockCreep({ x: 0, y: 0, energy: 0 });
    const container = NEAR_CONTAINER;
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === "container1" ? container : undefined,
        [container],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(creep.moveTo).toHaveBeenCalledTimes(1);
    expect(creep.moveTo).toHaveBeenCalledWith(container.pos, expect.anything());
    expect(creep.withdraw).not.toHaveBeenCalled();
  });

  it("withdraws from the Container when in range", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    const container = NEAR_CONTAINER;
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === "container1" ? container : undefined,
        [container],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(creep.withdraw).toHaveBeenCalledWith(
      container,
      RESOURCE_ENERGY_VALUE,
    );
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("selects the nearest of multiple valid Containers via liveDistance", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    const nearContainer = NEAR_CONTAINER;
    const farContainer = FAR_CONTAINER;
    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "container1") return nearContainer;
          if (id === "container2") return farContainer;
          return undefined;
        },
        [farContainer, nearContainer],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(creep.withdraw).toHaveBeenCalledWith(
      nearContainer,
      RESOURCE_ENERGY_VALUE,
    );
  });

  it("is a silent no-op when no valid Containers exist (empty threshold check)", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    setGame(createMockGame((id) => (id === "creep1" ? creep : undefined), []));
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(creep.withdraw).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("is a silent no-op when all Containers are at/below COLLECTOR_MIN_CONTAINER_ENERGY", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    const emptyContainer = EMPTY_CONTAINER;
    setGame(
      createMockGame(
        (id) =>
          id === "creep1"
            ? creep
            : id === "container3"
              ? emptyContainer
              : undefined,
        [emptyContainer],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(creep.withdraw).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("is a no-op when the nearest Container cannot be resolved live", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    setGame(
      createMockGame(
        (id) => (id === "creep1" ? creep : undefined),
        [NEAR_CONTAINER],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(creep.withdraw).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("logs a non-OK, non-ERR_NOT_IN_RANGE, non-ERR_NOT_ENOUGH_RESOURCES withdraw result", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 0,
      withdrawResult: ERR_NOT_OWNER_CODE as ScreepsReturnCode,
    });
    const container = NEAR_CONTAINER;
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === "container1" ? container : undefined,
        [container],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[behavior:withdraw]"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(String(ERR_NOT_OWNER_CODE)),
    );
  });

  it("does not log ERR_NOT_IN_RANGE from withdraw", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 0,
      withdrawResult: ERR_NOT_IN_RANGE_CODE as ScreepsReturnCode,
    });
    const container = NEAR_CONTAINER;
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === "container1" ? container : undefined,
        [container],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(console.log).not.toHaveBeenCalled();
  });

  it("does not log ERR_NOT_ENOUGH_RESOURCES from withdraw", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 0,
      withdrawResult: ERR_NOT_ENOUGH_RESOURCES_CODE as ScreepsReturnCode,
    });
    const container = NEAR_CONTAINER;
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === "container1" ? container : undefined,
        [container],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(console.log).not.toHaveBeenCalled();
  });
});

describe("runWithdrawSource — nonzero carry (should not withdraw)", () => {
  it("is a no-op when the Creep is carrying nonzero energy", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 25 });
    const container = NEAR_CONTAINER;
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === "container1" ? container : undefined,
        [container],
      ),
    );
    buildWorldSnapshot();

    runWithdrawSource("creep1");

    expect(creep.withdraw).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });
});

describe("runWithdrawSource — Creep unreachable", () => {
  it("is a no-op when the Creep cannot be resolved live", () => {
    setGame(createMockGame(() => undefined, [NEAR_CONTAINER]));
    buildWorldSnapshot();

    expect(() => runWithdrawSource("gone")).not.toThrow();
  });

  it("is a no-op when the Creep has no memory", () => {
    const creep = {
      id: "creep1",
      pos: { x: 10, y: 10, roomName: "sim" },
      carry: { energy: 0 },
    } as unknown as Creep;
    setGame(
      createMockGame(
        (id) => (id === "creep1" ? creep : undefined),
        [NEAR_CONTAINER],
      ),
    );
    buildWorldSnapshot();

    expect(() => runWithdrawSource("creep1")).not.toThrow();
  });
});

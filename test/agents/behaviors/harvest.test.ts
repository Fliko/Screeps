import { afterEach, describe, expect, it, vi } from "vitest";
import { runHarvest } from "../../../src/agents/behaviors/harvest";
import type { GameAdapter } from "../../../src/game";
import { setGame } from "../../../src/game";
import {
  buildWorldSnapshot,
  getCurrentSnapshot,
} from "../../../src/world/snapshot";

/**
 * Mock live-object factory. Creeps carry a `harvest`/`transfer`/`moveTo` spy
 * (same shape as test/agents/movement.test.ts's mock creep); Sources are
 * plain-data stand-ins with an id and pos and energy.
 */
// Screeps constants (OK, ERR_*, RESOURCE_ENERGY, STRUCTURE_CONTAINER) are ambient
// `declare const` types the real engine provides as runtime globals — vitest/Node
// does not. `runHarvest` references them directly (production code runs under the
// real engine), so the test stubs them onto globalThis to call through faithfully.
const OK_CODE = 0; // OK
const ERR_NOT_IN_RANGE_CODE = -9; // ERR_NOT_IN_RANGE
const ERR_NOT_ENOUGH_RESOURCES_CODE = -6; // ERR_NOT_ENOUGH_RESOURCES
const ERR_FULL_CODE = -8; // ERR_FULL
const RESOURCE_ENERGY_VALUE = "energy"; // RESOURCE_ENERGY
const STRUCTURE_CONTAINER_VALUE = "container"; // STRUCTURE_CONTAINER

Object.assign(globalThis, {
  OK: OK_CODE,
  ERR_NOT_IN_RANGE: ERR_NOT_IN_RANGE_CODE,
  ERR_NOT_ENOUGH_RESOURCES: ERR_NOT_ENOUGH_RESOURCES_CODE,
  ERR_FULL: ERR_FULL_CODE,
  RESOURCE_ENERGY: RESOURCE_ENERGY_VALUE,
  STRUCTURE_CONTAINER: STRUCTURE_CONTAINER_VALUE,
});

function createMockCreep(options: {
  x?: number;
  y?: number;
  energy?: number;
  harvestResult?: ScreepsReturnCode;
  transferResult?: ScreepsReturnCode;
}): Creep {
  const {
    x = 10,
    y = 10,
    energy = 0,
    harvestResult = OK_CODE as ScreepsReturnCode,
    transferResult = OK_CODE as ScreepsReturnCode,
  } = options;
  return {
    id: "creep1",
    pos: { x, y, roomName: "sim" },
    carry: { energy },
    fatigue: 0,
    memory: {},
    harvest: vi.fn(() => harvestResult),
    transfer: vi.fn(() => transferResult),
    moveTo: vi.fn(() => OK_CODE),
  } as unknown as Creep;
}

function createSource(id: string, x: number, y: number): Source {
  return {
    id,
    pos: { x, y, roomName: "sim" },
    energy: 1500,
    energyCapacity: 3000,
  } as unknown as Source;
}

function createMockGame(
  resolve: (id: string) => unknown,
  sources: {
    id: string;
    pos: { x: number; y: number; roomName: string };
    energy: number;
    energyCapacity: number;
  }[] = [],
): GameAdapter {
  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    findMyStructures: () => [],
    findConstructionSites: () => [],
    findSources: () => sources,
    findCreeps: () => [],
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => 0,
    getEnergyAvailable: () => 300,
    getObjectById: ((id: string) =>
      resolve(id)) as GameAdapter["getObjectById"],
  };
}

afterEach(() => {
  setGame();
});

describe("runHarvest — Harvester behavior (Story 6.5)", () => {
  it("moves a Harvester to its Source's adjacent Container when not yet there", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    const source = createSource("source1", 25, 25);
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 0,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "source1") return source;
          if (id === "container1") return { ...container };
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    // Manually inject the container into the snapshot's structures
    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    runHarvest("creep1", "mine:source1");

    expect(creep.moveTo).toHaveBeenCalledTimes(1);
    expect(creep.moveTo).toHaveBeenCalledWith(
      expect.objectContaining({ x: 26, y: 25 }),
      expect.anything(),
    );
    expect(creep.harvest).not.toHaveBeenCalled();
    expect(creep.transfer).not.toHaveBeenCalled();
  });

  it("harvests and transfers when parked on the Container with full energy", () => {
    const creep = createMockCreep({ x: 26, y: 25, energy: 50 });
    const source = createSource("source1", 25, 25);
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 500,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "source1") return source;
          if (id === "container1") return { ...container };
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    runHarvest("creep1", "mine:source1");

    expect(creep.harvest).toHaveBeenCalledWith(source);
    expect(creep.transfer).toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("does not transfer when the Creep is carrying no energy", () => {
    const creep = createMockCreep({ x: 26, y: 25, energy: 0 });
    const source = createSource("source1", 25, 25);
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 500,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "source1") return source;
          if (id === "container1") return { ...container };
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    runHarvest("creep1", "mine:source1");

    expect(creep.harvest).toHaveBeenCalledWith(source);
    expect(creep.transfer).not.toHaveBeenCalled();
  });

  it("ignores ERR_NOT_ENOUGH_RESOURCES from harvest on a depleted Source", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const creep = createMockCreep({
      x: 26,
      y: 25,
      energy: 0,
      harvestResult: ERR_NOT_ENOUGH_RESOURCES_CODE as ScreepsReturnCode,
    });
    const source = createSource("source1", 25, 25);
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 0,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "source1") return source;
          if (id === "container1") return { ...container };
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 0,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    runHarvest("creep1", "mine:source1");

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("ignores ERR_FULL from transfer when the Container is at capacity", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const creep = createMockCreep({
      x: 26,
      y: 25,
      energy: 50,
      transferResult: ERR_FULL_CODE as ScreepsReturnCode,
    });
    const source = createSource("source1", 25, 25);
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 2000,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "source1") return source;
          if (id === "container1") return { ...container };
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    runHarvest("creep1", "mine:source1");

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("is a silent no-op when the Container is destroyed and no adjacent one exists", () => {
    const creep = createMockCreep({ x: 26, y: 25, energy: 50 });
    const source = createSource("source1", 25, 25);

    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "source1") return source;
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    // No containers in snapshot
    runHarvest("creep1", "mine:source1");

    expect(creep.moveTo).not.toHaveBeenCalled();
    expect(creep.harvest).not.toHaveBeenCalled();
    expect(creep.transfer).not.toHaveBeenCalled();
  });

  it("is a silent no-op when the Creep cannot be resolved", () => {
    const source = createSource("source1", 25, 25);
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 0,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame(
        (id) => {
          if (id === "source1") return source;
          if (id === "container1") return { ...container };
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    expect(() => runHarvest("creep1", "mine:source1")).not.toThrow();
  });

  it("is a silent no-op when the Source cannot be resolved", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 0,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame((id) => {
        if (id === "creep1") return creep;
        if (id === "container1") return { ...container };
        return undefined;
      }),
    );
    buildWorldSnapshot();

    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    runHarvest("creep1", "mine:source1");

    expect(creep.moveTo).not.toHaveBeenCalled();
    expect(creep.harvest).not.toHaveBeenCalled();
    expect(creep.transfer).not.toHaveBeenCalled();
  });

  it("logs on unexpected error codes from harvest", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const creep = createMockCreep({
      x: 26,
      y: 25,
      energy: 0,
      harvestResult: -1 as ScreepsReturnCode, // Unexpected error
    });
    const source = createSource("source1", 25, 25);
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 0,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "source1") return source;
          if (id === "container1") return { ...container };
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    runHarvest("creep1", "mine:source1");

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[behavior:harvest]"),
    );
    logSpy.mockRestore();
  });

  it("logs on unexpected error codes from transfer", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const creep = createMockCreep({
      x: 26,
      y: 25,
      energy: 50,
      transferResult: -1 as ScreepsReturnCode, // Unexpected error
    });
    const source = createSource("source1", 25, 25);
    const container = {
      id: "container1",
      pos: { x: 26, y: 25, roomName: "sim" },
      structureType: "container" as const,
      energy: 500,
      energyCapacity: 2000,
    };

    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === "source1") return source;
          if (id === "container1") return { ...container };
          return undefined;
        },
        [
          {
            id: "source1",
            pos: { x: 25, y: 25, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      ),
    );
    buildWorldSnapshot();

    const snapshot = getCurrentSnapshot();
    if (snapshot) {
      // biome-ignore lint: test mocking requires mutable cast
      (snapshot.structures as any) = [container];
    }

    runHarvest("creep1", "mine:source1");

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[behavior:harvest]"),
    );
    logSpy.mockRestore();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBuild } from "../../../src/agents/behaviors/build";
import type { GameAdapter } from "../../../src/game";
import { setGame } from "../../../src/game";
import { buildWorldSnapshot } from "../../../src/world/snapshot";

/**
 * Mock live-object factory. Creeps carry a `harvest`/`build`/`moveTo` spy
 * (same shape as fill.test.ts's mock creep); Sources and ConstructionSites
 * are plain-data stand-ins with an id and pos.
 */
// Screeps constants (OK, ERR_*, RESOURCE_ENERGY) are ambient `declare const`
// types the real engine provides as runtime globals — vitest/Node does not.
// `runBuild` references them directly (production code runs under the real
// engine), so the test stubs them onto globalThis to call through faithfully.
const OK_CODE = 0; // OK
const ERR_NOT_IN_RANGE_CODE = -9; // ERR_NOT_IN_RANGE
const ERR_NOT_OWNER_CODE = -1; // ERR_NOT_OWNER
const ERR_NOT_ENOUGH_RESOURCES_CODE = -6; // ERR_NOT_ENOUGH_RESOURCES
const ERR_INVALID_TARGET_CODE = -7; // ERR_INVALID_TARGET

Object.assign(globalThis, {
  OK: OK_CODE,
  ERR_NOT_IN_RANGE: ERR_NOT_IN_RANGE_CODE,
  ERR_NOT_ENOUGH_RESOURCES: ERR_NOT_ENOUGH_RESOURCES_CODE,
  ERR_INVALID_TARGET: ERR_INVALID_TARGET_CODE,
});

function createMockCreep(options: {
  x?: number;
  y?: number;
  energy?: number;
  harvestResult?: ScreepsReturnCode;
  buildResult?: ScreepsReturnCode;
}): Creep {
  const {
    x = 10,
    y = 10,
    energy = 0,
    harvestResult = OK_CODE as ScreepsReturnCode,
    buildResult = OK_CODE as ScreepsReturnCode,
  } = options;
  return {
    id: "creep1",
    pos: { x, y, roomName: "sim" },
    carry: { energy },
    fatigue: 0,
    memory: {},
    harvest: vi.fn(() => harvestResult),
    build: vi.fn(() => buildResult),
    moveTo: vi.fn(() => OK_CODE),
  } as unknown as Creep;
}

function createSource(id: string, x: number, y: number): Source {
  return { id, pos: { x, y, roomName: "sim" } } as unknown as Source;
}

function createConstructionSite(
  id: string,
  x: number,
  y: number,
): ConstructionSite {
  return { id, pos: { x, y, roomName: "sim" } } as unknown as ConstructionSite;
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
    getObjectById: ((id: string) =>
      resolve(id)) as GameAdapter["getObjectById"],
  };
}

const NEAR_SOURCE = {
  id: "source1",
  pos: { x: 11, y: 10, roomName: "sim" },
  energy: 1500,
  energyCapacity: 3000,
};
const FAR_SOURCE = {
  id: "source2",
  pos: { x: 40, y: 40, roomName: "sim" },
  energy: 1500,
  energyCapacity: 3000,
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setGame();
});

describe("runBuild — sourcing (empty carry)", () => {
  it("moves toward the nearest active Source when out of range, without harvesting", () => {
    const creep = createMockCreep({ x: 0, y: 0, energy: 0 });
    const source = createSource(
      NEAR_SOURCE.id,
      NEAR_SOURCE.pos.x,
      NEAR_SOURCE.pos.y,
    );
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === NEAR_SOURCE.id ? source : undefined,
        [NEAR_SOURCE],
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.moveTo).toHaveBeenCalledTimes(1);
    expect(creep.moveTo).toHaveBeenCalledWith(source.pos, expect.anything());
    expect(creep.harvest).not.toHaveBeenCalled();
  });

  it("harvests the Source when in range", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    const source = createSource(
      NEAR_SOURCE.id,
      NEAR_SOURCE.pos.x,
      NEAR_SOURCE.pos.y,
    );
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === NEAR_SOURCE.id ? source : undefined,
        [NEAR_SOURCE],
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.harvest).toHaveBeenCalledWith(source);
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("selects the nearest of multiple active Sources via liveDistance", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    const nearSource = createSource(
      NEAR_SOURCE.id,
      NEAR_SOURCE.pos.x,
      NEAR_SOURCE.pos.y,
    );
    const farSource = createSource(
      FAR_SOURCE.id,
      FAR_SOURCE.pos.x,
      FAR_SOURCE.pos.y,
    );
    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === NEAR_SOURCE.id) return nearSource;
          if (id === FAR_SOURCE.id) return farSource;
          return undefined;
        },
        [FAR_SOURCE, NEAR_SOURCE],
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.harvest).toHaveBeenCalledWith(nearSource);
  });

  it("is a no-op when no active Sources are visible", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    setGame(createMockGame((id) => (id === "creep1" ? creep : undefined), []));
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.harvest).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("is a no-op when the nearest Source cannot be resolved live", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    setGame(
      createMockGame(
        (id) => (id === "creep1" ? creep : undefined),
        [NEAR_SOURCE],
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.harvest).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("logs a non-OK, non-ERR_NOT_IN_RANGE harvest result", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 0,
      harvestResult: ERR_NOT_OWNER_CODE as ScreepsReturnCode,
    });
    const source = createSource(
      NEAR_SOURCE.id,
      NEAR_SOURCE.pos.x,
      NEAR_SOURCE.pos.y,
    );
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === NEAR_SOURCE.id ? source : undefined,
        [NEAR_SOURCE],
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[behavior:build]"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(String(ERR_NOT_OWNER_CODE)),
    );
  });

  it("does not log ERR_NOT_IN_RANGE from harvest", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 0,
      harvestResult: ERR_NOT_IN_RANGE_CODE as ScreepsReturnCode,
    });
    const source = createSource(
      NEAR_SOURCE.id,
      NEAR_SOURCE.pos.x,
      NEAR_SOURCE.pos.y,
    );
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === NEAR_SOURCE.id ? source : undefined,
        [NEAR_SOURCE],
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(console.log).not.toHaveBeenCalled();
  });
});

describe("runBuild — serving (nonzero carry, anti-ping-pong)", () => {
  it("derives 'serve' for a partial carry and never re-sources", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 45 });
    const site = createConstructionSite("site1", 10, 10);
    setGame(
      createMockGame((id) =>
        id === "creep1" ? creep : id === "site1" ? site : undefined,
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.build).toHaveBeenCalledWith(site);
    expect(creep.harvest).not.toHaveBeenCalled();
  });

  it("moves toward the target when out of range (> 3 tiles), without building", () => {
    const creep = createMockCreep({ x: 0, y: 0, energy: 25 });
    const site = createConstructionSite("site1", 20, 20);
    setGame(
      createMockGame((id) =>
        id === "creep1" ? creep : id === "site1" ? site : undefined,
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.moveTo).toHaveBeenCalledTimes(1);
    expect(creep.moveTo).toHaveBeenCalledWith(site.pos, expect.anything());
    expect(creep.build).not.toHaveBeenCalled();
  });

  it("builds the target when in range (<= 3 tiles)", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 50 });
    const site = createConstructionSite("site1", 13, 10);
    setGame(
      createMockGame((id) =>
        id === "creep1" ? creep : id === "site1" ? site : undefined,
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.build).toHaveBeenCalledWith(site);
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("is a no-op when the target construction site cannot be resolved live", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 25 });
    setGame(createMockGame((id) => (id === "creep1" ? creep : undefined)));
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(creep.build).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("logs a non-OK, non-ERR_INVALID_TARGET build result", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 50,
      buildResult: ERR_NOT_OWNER_CODE as ScreepsReturnCode,
    });
    const site = createConstructionSite("site1", 10, 10);
    setGame(
      createMockGame((id) =>
        id === "creep1" ? creep : id === "site1" ? site : undefined,
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[behavior:build]"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(String(ERR_NOT_OWNER_CODE)),
    );
  });

  it("does not log ERR_INVALID_TARGET from build (site completed mid-Tick)", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 50,
      buildResult: ERR_INVALID_TARGET_CODE as ScreepsReturnCode,
    });
    const site = createConstructionSite("site1", 10, 10);
    setGame(
      createMockGame((id) =>
        id === "creep1" ? creep : id === "site1" ? site : undefined,
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(console.log).not.toHaveBeenCalled();
  });

  it("does not log ERR_NOT_IN_RANGE from build", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 50,
      buildResult: ERR_NOT_IN_RANGE_CODE as ScreepsReturnCode,
    });
    const site = createConstructionSite("site1", 10, 10);
    setGame(
      createMockGame((id) =>
        id === "creep1" ? creep : id === "site1" ? site : undefined,
      ),
    );
    buildWorldSnapshot();

    runBuild("creep1", "build:site1");

    expect(console.log).not.toHaveBeenCalled();
  });
});

describe("runBuild — Creep unreachable", () => {
  it("is a no-op when the Creep cannot be resolved live", () => {
    setGame(createMockGame(() => undefined));
    buildWorldSnapshot();

    expect(() => runBuild("gone", "build:site1")).not.toThrow();
  });
});

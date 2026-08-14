import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDyingUnload } from "../../../src/agents/behaviors/dying";
import type { GameAdapter } from "../../../src/game";
import { setGame } from "../../../src/game";
import { buildWorldSnapshot } from "../../../src/world/snapshot";

// Screeps constants (OK, ERR_*, RESOURCE_ENERGY) are ambient `declare const`
// types the real engine provides as runtime globals — vitest/Node does not.
// `runDyingUnload` references them directly (production code runs under the
// real engine), so the test stubs them onto globalThis to call through
// faithfully (mirrors build.test.ts / fill.test.ts).
const OK_CODE = 0; // OK
const ERR_FULL_CODE = -8; // ERR_FULL
const ERR_NOT_OWNER_CODE = -1; // ERR_NOT_OWNER
const RESOURCE_ENERGY_CONST = "energy";

Object.assign(globalThis, {
  OK: OK_CODE,
  ERR_FULL: ERR_FULL_CODE,
  RESOURCE_ENERGY: RESOURCE_ENERGY_CONST,
});

function createMockCreep(options: {
  x?: number;
  y?: number;
  energy?: number;
  transferResult?: ScreepsReturnCode;
}): Creep {
  const {
    x = 10,
    y = 10,
    energy = 0,
    transferResult = OK_CODE as ScreepsReturnCode,
  } = options;
  return {
    id: "creep1",
    pos: { x, y, roomName: "sim" },
    carry: { energy },
    fatigue: 0,
    memory: {},
    transfer: vi.fn(() => transferResult),
    moveTo: vi.fn(() => OK_CODE),
  } as unknown as Creep;
}

function createStructure(id: string, x: number, y: number): AnyStoreStructure {
  return {
    id,
    pos: { x, y, roomName: "sim" },
  } as unknown as AnyStoreStructure;
}

function createMockGame(
  resolve: (id: string) => unknown,
  structures: {
    id: string;
    pos: { x: number; y: number; roomName: string };
    structureType: StructureConstant;
    energy: number;
    energyCapacity: number;
  }[] = [],
): GameAdapter {
  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    findMyStructures: () => structures,
    findConstructionSites: () => [],
    findSources: () => [],
    findCreeps: () => [],
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => 0,
    getObjectById: ((id: string) =>
      resolve(id)) as GameAdapter["getObjectById"],
  };
}

const NEEDY_SPAWN = {
  id: "spawn1",
  pos: { x: 11, y: 10, roomName: "sim" },
  structureType: "spawn" as StructureConstant,
  energy: 100,
  energyCapacity: 300,
};
const FULL_EXTENSION = {
  id: "ext1",
  pos: { x: 10, y: 10, roomName: "sim" },
  structureType: "extension" as StructureConstant,
  energy: 50,
  energyCapacity: 50,
};
const FAR_NEEDY_SPAWN = {
  id: "spawn2",
  pos: { x: 40, y: 40, roomName: "sim" },
  structureType: "spawn" as StructureConstant,
  energy: 100,
  energyCapacity: 300,
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setGame();
});

describe("runDyingUnload — carrying, needy structure out of range", () => {
  it("moves toward the nearest needy structure without transferring", () => {
    const creep = createMockCreep({ x: 0, y: 0, energy: 25 });
    const spawn = createStructure(
      NEEDY_SPAWN.id,
      NEEDY_SPAWN.pos.x,
      NEEDY_SPAWN.pos.y,
    );
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === NEEDY_SPAWN.id ? spawn : undefined,
        [NEEDY_SPAWN],
      ),
    );
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(creep.moveTo).toHaveBeenCalledTimes(1);
    expect(creep.moveTo).toHaveBeenCalledWith(spawn.pos, expect.anything());
    expect(creep.transfer).not.toHaveBeenCalled();
  });
});

describe("runDyingUnload — carrying, needy structure in range", () => {
  it("transfers energy into the structure", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 25 });
    const spawn = createStructure(
      NEEDY_SPAWN.id,
      NEEDY_SPAWN.pos.x,
      NEEDY_SPAWN.pos.y,
    );
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === NEEDY_SPAWN.id ? spawn : undefined,
        [NEEDY_SPAWN],
      ),
    );
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(creep.transfer).toHaveBeenCalledWith(spawn, RESOURCE_ENERGY_CONST);
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("selects the nearest of multiple needy structures via liveDistance", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 25 });
    const nearSpawn = createStructure(
      NEEDY_SPAWN.id,
      NEEDY_SPAWN.pos.x,
      NEEDY_SPAWN.pos.y,
    );
    const farSpawn = createStructure(
      FAR_NEEDY_SPAWN.id,
      FAR_NEEDY_SPAWN.pos.x,
      FAR_NEEDY_SPAWN.pos.y,
    );
    setGame(
      createMockGame(
        (id) => {
          if (id === "creep1") return creep;
          if (id === NEEDY_SPAWN.id) return nearSpawn;
          if (id === FAR_NEEDY_SPAWN.id) return farSpawn;
          return undefined;
        },
        [FAR_NEEDY_SPAWN, NEEDY_SPAWN],
      ),
    );
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(creep.transfer).toHaveBeenCalledWith(
      nearSpawn,
      RESOURCE_ENERGY_CONST,
    );
  });

  it("excludes structures at or above energy capacity", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 25 });
    setGame(
      createMockGame(
        (id) => (id === "creep1" ? creep : undefined),
        [FULL_EXTENSION],
      ),
    );
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(creep.transfer).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });

  it("logs a non-OK, non-ERR_FULL transfer result", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 25,
      transferResult: ERR_NOT_OWNER_CODE as ScreepsReturnCode,
    });
    const spawn = createStructure(
      NEEDY_SPAWN.id,
      NEEDY_SPAWN.pos.x,
      NEEDY_SPAWN.pos.y,
    );
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === NEEDY_SPAWN.id ? spawn : undefined,
        [NEEDY_SPAWN],
      ),
    );
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[behavior:dying]"),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(String(ERR_NOT_OWNER_CODE)),
    );
  });

  it("does not log ERR_FULL from transfer", () => {
    const creep = createMockCreep({
      x: 10,
      y: 10,
      energy: 25,
      transferResult: ERR_FULL_CODE as ScreepsReturnCode,
    });
    const spawn = createStructure(
      NEEDY_SPAWN.id,
      NEEDY_SPAWN.pos.x,
      NEEDY_SPAWN.pos.y,
    );
    setGame(
      createMockGame(
        (id) =>
          id === "creep1" ? creep : id === NEEDY_SPAWN.id ? spawn : undefined,
        [NEEDY_SPAWN],
      ),
    );
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(console.log).not.toHaveBeenCalled();
  });

  it("is a no-op when the nearest structure cannot be resolved live", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 25 });
    setGame(
      createMockGame(
        (id) => (id === "creep1" ? creep : undefined),
        [NEEDY_SPAWN],
      ),
    );
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(creep.transfer).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });
});

describe("runDyingUnload — carrying, no needy structure", () => {
  it("is a no-op when no structure is below capacity", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 25 });
    setGame(createMockGame((id) => (id === "creep1" ? creep : undefined), []));
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(creep.transfer).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });
});

describe("runDyingUnload — empty carry", () => {
  it("is a no-op — no transfer, no moveCreep call", () => {
    const creep = createMockCreep({ x: 10, y: 10, energy: 0 });
    setGame(
      createMockGame(
        (id) => (id === "creep1" ? creep : undefined),
        [NEEDY_SPAWN],
      ),
    );
    buildWorldSnapshot();

    runDyingUnload("creep1");

    expect(creep.transfer).not.toHaveBeenCalled();
    expect(creep.moveTo).not.toHaveBeenCalled();
  });
});

describe("runDyingUnload — Creep unreachable", () => {
  it("is a no-op when the Creep cannot be resolved live", () => {
    setGame(createMockGame(() => undefined));
    buildWorldSnapshot();

    expect(() => runDyingUnload("gone")).not.toThrow();
  });
});

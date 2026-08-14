import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getConstant, setConstant } from "../../src/config";
import { spawn } from "../../src/control/spawn";
import type { CreepStub, GameAdapter, StructureStub } from "../../src/game";
import { setGame } from "../../src/game";
import * as snapshotModule from "../../src/world/snapshot";
import { buildWorldSnapshot } from "../../src/world/snapshot";

// Screeps constants (OK, STRUCTURE_SPAWN) are ambient `declare const` types
// the real engine provides as runtime globals — vitest/Node does not.
// `spawn()` references them directly (production code runs under the real
// engine), so the test stubs them onto globalThis, mirroring the pattern in
// test/agents/behaviors/build.test.ts.
const OK_CODE = 0; // OK
const STRUCTURE_SPAWN_CODE = "spawn"; // STRUCTURE_SPAWN

Object.assign(globalThis, {
  OK: OK_CODE,
  STRUCTURE_SPAWN: STRUCTURE_SPAWN_CODE,
});

function createCreep(id: string, spawning = false): CreepStub {
  return {
    id,
    pos: { x: 0, y: 0, roomName: "sim" },
    body: ["work", "carry", "move"],
    ttl: 1500,
    carry: 0,
    carryCapacity: 50,
    spawning,
    memory: {},
  };
}

function createSpawnStub(id: string, spawning = false): StructureStub {
  return {
    id,
    pos: { x: 25, y: 25, roomName: "sim" },
    structureType: "spawn",
    energy: 300,
    energyCapacity: 300,
    spawning,
  };
}

function createMockGame(
  creeps: CreepStub[],
  structures: StructureStub[],
  spawnCreepImpl: (
    body: BodyPartConstant[],
    name: string,
    opts?: SpawnOptions,
  ) => ScreepsReturnCode,
  tick = 100,
): GameAdapter {
  const liveSpawns = new Map<string, { spawnCreep: typeof spawnCreepImpl }>();
  for (const structure of structures) {
    if (structure.structureType === "spawn") {
      liveSpawns.set(structure.id, { spawnCreep: spawnCreepImpl });
    }
  }

  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    findMyStructures: () => structures,
    findConstructionSites: () => [],
    findSources: () => [],
    findCreeps: () => creeps,
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => tick,
    getObjectById: ((id: string) =>
      liveSpawns.get(id)) as GameAdapter["getObjectById"],
  };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  setConstant("SPAWN_TARGET_POPULATION", 4);
});

afterEach(() => {
  vi.restoreAllMocks();
  setGame();
  setConstant("SPAWN_TARGET_POPULATION", 4);
});

describe("spawn — I/O matrix", () => {
  it("issues spawnCreep when below target with an idle Spawn", () => {
    const creeps = [createCreep("c1"), createCreep("c2")];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl, 100));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).toHaveBeenCalledTimes(1);
    expect(spawnCreepImpl).toHaveBeenCalledWith(
      getConstant("SPAWN_BODY_GENERALIST"),
      "generalist-sim-100",
      { memory: {} },
    );
    expect(vi.mocked(console.log)).toHaveBeenCalledWith(
      expect.stringContaining("[spawn]"),
    );
  });

  it("does not spawn when population is at target", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4"),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("does not spawn when population is above target", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4"),
      createCreep("c5"),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("counts a Spawning Creep toward population", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4", true),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("does not spawn when every Spawn structure is busy", () => {
    const creeps = [createCreep("c1"), createCreep("c2")];
    const spawnStub = createSpawnStub("spawn1", true);
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).not.toHaveBeenCalled();
    expect(vi.mocked(console.log)).not.toHaveBeenCalled();
  });

  it("no-ops when there is no snapshot", () => {
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame([], [createSpawnStub("spawn1")], spawnCreepImpl));
    vi.spyOn(snapshotModule, "getCurrentSnapshot").mockReturnValue(undefined);

    expect(() => spawn()).not.toThrow();
    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("no-ops when no Spawn structure is visible", () => {
    const creeps = [createCreep("c1"), createCreep("c2")];
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [], spawnCreepImpl));

    buildWorldSnapshot();
    expect(() => spawn()).not.toThrow();
    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("no-ops without throwing when the live Spawn cannot be resolved", () => {
    const creeps = [createCreep("c1"), createCreep("c2")];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    const game = createMockGame(creeps, [spawnStub], spawnCreepImpl);
    setGame({
      ...game,
      getObjectById: (() => undefined) as GameAdapter["getObjectById"],
    });

    buildWorldSnapshot();
    expect(() => spawn()).not.toThrow();
    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });
});

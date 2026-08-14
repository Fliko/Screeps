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

function createCreep(id: string, spawning = false, ttl = 1500): CreepStub {
  return {
    id,
    pos: { x: 0, y: 0, roomName: "sim" },
    body: ["work", "carry", "move"],
    ttl,
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

  it("issues a replacement spawnCreep when population is at target and a Creep is near-dying", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4", false, 100),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl, 100));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.log)).toHaveBeenCalledWith(
      expect.stringContaining("ttl-replacement"),
    );
  });

  // Note: the spec's I/O Matrix literally describes a "population > target,
  // spawnCreep issued" row, but that is mathematically incompatible with the
  // effectiveTarget = target + 1 cap the same spec mandates (Tasks &
  // Acceptance / Design Notes): whenever population > target, population is
  // already >= target + 1 = effectiveTarget, so the guard always blocks —
  // for any population value. That cap is what the spec's own bad_spec
  // review amendment introduced specifically to stop unbounded overshoot, so
  // this test asserts the correct, non-overshooting behavior the formula
  // actually produces rather than the literal (self-contradictory) matrix
  // wording.
  it("does not issue a further spawnCreep when population is already above target, even with a near-dying Creep (effectiveTarget cap)", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4"),
      createCreep("c5", false, 50),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("does not treat a Spawning Creep (ttl reads 0) as near-dying", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4", true, 0),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("throttles a near-dying replacement when every Spawn structure is busy", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4", false, 100),
    ];
    const spawnStub = createSpawnStub("spawn1", true);
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("issues exactly one spawnCreep when multiple Creeps are near-dying", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3", false, 80),
      createCreep("c4", false, 90),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).toHaveBeenCalledTimes(1);
  });

  it("does not re-fire a replacement across Ticks once population reaches target + 1", () => {
    // First Tick: population at target, one Creep near-dying, idle Spawn —
    // triggers the one allowed replacement.
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4", false, 100),
    ];
    const spawnStub1 = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub1], spawnCreepImpl, 100));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).toHaveBeenCalledTimes(1);

    // Second Tick: population is now target + 1 (the replacement has been
    // added to the population), the same Creep is still near-dying, and the
    // Spawn is idle again. No further spawnCreep call should be made.
    const creepsAfter = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4", false, 95),
      createCreep("generalist-sim-100"),
    ];
    const spawnStub2 = createSpawnStub("spawn1", false);
    setGame(createMockGame(creepsAfter, [spawnStub2], spawnCreepImpl, 101));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).toHaveBeenCalledTimes(1);
  });

  it("does not treat a Creep at exactly the threshold ttl as near-dying", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4", false, 200),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).not.toHaveBeenCalled();
  });

  it("treats a Creep one tick below the threshold as near-dying", () => {
    const creeps = [
      createCreep("c1"),
      createCreep("c2"),
      createCreep("c3"),
      createCreep("c4", false, 199),
    ];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).toHaveBeenCalledTimes(1);
  });

  it("reports both reasons when population is below target and a Creep is also near-dying", () => {
    const creeps = [createCreep("c1"), createCreep("c2", false, 100)];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(spawnCreepImpl).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.log)).toHaveBeenCalledWith(
      expect.stringContaining("(population+ttl-replacement)"),
    );
  });

  it("reports only the population reason when no Creep is near-dying", () => {
    const creeps = [createCreep("c1"), createCreep("c2")];
    const spawnStub = createSpawnStub("spawn1");
    const spawnCreepImpl = vi.fn(() => OK);
    setGame(createMockGame(creeps, [spawnStub], spawnCreepImpl));

    buildWorldSnapshot();
    spawn();

    expect(vi.mocked(console.log)).toHaveBeenCalledWith(
      expect.stringContaining("(population)"),
    );
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { type GameAdapter, setGame } from "../../src/game";
import {
  buildWorldSnapshot,
  getCurrentSnapshot,
  type WorldSnapshot,
} from "../../src/world/snapshot";

function createMockGame(overrides?: {
  controller?: ReturnType<GameAdapter["getController"]>;
  structures?: ReturnType<GameAdapter["findMyStructures"]>;
  constructionSites?: ReturnType<GameAdapter["findConstructionSites"]>;
  sources?: ReturnType<GameAdapter["findSources"]>;
  creeps?: ReturnType<GameAdapter["findCreeps"]>;
}): GameAdapter {
  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    getController: () => overrides?.controller ?? undefined,
    findMyStructures: () => overrides?.structures ?? [],
    findConstructionSites: () => overrides?.constructionSites ?? [],
    findSources: () => overrides?.sources ?? [],
    findCreeps: () => overrides?.creeps ?? [],
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => 0,
    getObjectById: () => undefined,
  };
}

describe("buildWorldSnapshot", () => {
  beforeEach(() => {
    setGame();
  });

  it("builds an empty snapshot when no rooms are visible", () => {
    setGame({
      ...createMockGame(),
      getRooms: () => [],
    });

    const snapshot = buildWorldSnapshot();

    expect(snapshot.roomName).toBe("");
    expect(snapshot.structures).toHaveLength(0);
    expect(snapshot.constructionSites).toHaveLength(0);
    expect(snapshot.sources).toHaveLength(0);
    expect(snapshot.creeps).toHaveLength(0);
    expect(snapshot.controller).toBeUndefined();
    expect(getCurrentSnapshot()).toBe(snapshot);
  });

  it("builds an empty sources array when the room has no active Sources", () => {
    setGame(createMockGame());

    const snapshot = buildWorldSnapshot();

    expect(snapshot.sources).toHaveLength(0);
  });

  it("maps the controller, structures, construction sites, and creeps", () => {
    setGame(
      createMockGame({
        controller: {
          id: "controller1" as Id<StructureController>,
          pos: { x: 10, y: 20, roomName: "sim" },
          level: 2,
          progress: 100,
          progressTotal: 1000,
          owner: "Fliko",
        },
        structures: [
          {
            id: "spawn1" as Id<StructureSpawn>,
            pos: { x: 5, y: 5, roomName: "sim" },
            structureType: "spawn",
            energy: 100,
            energyCapacity: 300,
          },
          {
            id: "ext1" as Id<StructureExtension>,
            pos: { x: 6, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
        ],
        constructionSites: [
          {
            id: "site1" as Id<ConstructionSite<STRUCTURE_CONTAINER>>,
            pos: { x: 15, y: 15, roomName: "sim" },
            structureType: "container",
            progress: 10,
            progressTotal: 100,
          },
        ],
        sources: [
          {
            id: "source1" as Id<Source>,
            pos: { x: 20, y: 20, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
        creeps: [
          {
            id: "creep1" as Id<Creep>,
            pos: { x: 1, y: 1, roomName: "sim" },
            body: ["work", "carry", "move"],
            ttl: 100,
            carry: 25,
            carryCapacity: 50,
            memory: { contract: "fill:site1" },
          },
        ],
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.roomName).toBe("sim");

    expect(snapshot.controller).toEqual({
      id: "controller1",
      pos: { x: 10, y: 20, roomName: "sim" },
      level: 2,
      progress: 100,
      progressTotal: 1000,
      owner: "Fliko",
    });

    expect(snapshot.structures).toHaveLength(2);
    expect(snapshot.structures[0]).toEqual({
      id: "spawn1",
      pos: { x: 5, y: 5, roomName: "sim" },
      structureType: "spawn",
      energy: 100,
      energyCapacity: 300,
    });

    expect(snapshot.constructionSites).toHaveLength(1);
    expect(snapshot.constructionSites[0]).toEqual({
      id: "site1",
      pos: { x: 15, y: 15, roomName: "sim" },
      structureType: "container",
      progress: 10,
      progressTotal: 100,
    });

    expect(snapshot.sources).toHaveLength(1);
    expect(snapshot.sources[0]).toEqual({
      id: "source1",
      pos: { x: 20, y: 20, roomName: "sim" },
      energy: 1500,
      energyCapacity: 3000,
    });

    expect(snapshot.creeps).toHaveLength(1);
    expect(snapshot.creeps[0]).toEqual({
      id: "creep1",
      pos: { x: 1, y: 1, roomName: "sim" },
      body: ["work", "carry", "move"],
      ttl: 100,
      carry: 25,
      carryCapacity: 50,
      // The adapter stub omits `spawning`; mapCreep normalizes it to false.
      spawning: false,
      contract: "fill:site1",
    });
  });

  it("carries the adapter's spawning flag through to the snapshot", () => {
    setGame(
      createMockGame({
        creeps: [
          {
            id: "spawning1",
            pos: { x: 1, y: 1, roomName: "sim" },
            body: ["work", "carry", "move"],
            ttl: 0,
            carry: 0,
            carryCapacity: 50,
            spawning: true,
            memory: { contract: "fill:site1" },
          },
        ],
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.creeps[0]?.spawning).toBe(true);
  });

  it("drops invalid or missing creep contracts from the snapshot", () => {
    setGame(
      createMockGame({
        creeps: [
          {
            id: "creep1" as Id<Creep>,
            pos: { x: 1, y: 1, roomName: "sim" },
            body: ["work", "carry", "move"],
            ttl: 100,
            carry: 25,
            carryCapacity: 50,
            memory: {},
          },
          {
            id: "creep2" as Id<Creep>,
            pos: { x: 2, y: 2, roomName: "sim" },
            body: ["work", "carry", "move"],
            ttl: 100,
            carry: 25,
            carryCapacity: 50,
            memory: { contract: "bogus:123" },
          },
        ],
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.creeps).toHaveLength(2);
    expect(snapshot.creeps[0].contract).toBeUndefined();
    expect(snapshot.creeps[1].contract).toBeUndefined();
  });
});

describe("WorldSnapshot as plain data", () => {
  it("accepts a literal plain-data snapshot with no Game mocks", () => {
    const snapshot: WorldSnapshot = {
      roomName: "sim",
      tick: 0,
      controller: {
        id: "controller1",
        pos: { x: 10, y: 20, roomName: "sim" },
        level: 1,
        progress: 0,
        progressTotal: 200,
      },
      structures: [
        {
          id: "spawn1",
          pos: { x: 5, y: 5, roomName: "sim" },
          structureType: "spawn",
          energy: 100,
          energyCapacity: 300,
        },
      ],
      constructionSites: [],
      sources: [],
      creeps: [],
    };

    expect(snapshot.roomName).toBe("sim");
    expect(snapshot.structures).toHaveLength(1);
  });
});

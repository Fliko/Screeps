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
  energyAvailable?: number;
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
    getEnergyAvailable: () => overrides?.energyAvailable ?? 0,
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
            memory: { contract: "fill:spawns:site1" },
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
      contract: "fill:spawns:site1",
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
            memory: { contract: "fill:spawns:site1" },
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

  it("propagates energyAvailable from the game adapter onto the snapshot", () => {
    setGame(createMockGame({ energyAvailable: 425 }));

    const snapshot = buildWorldSnapshot();

    expect(snapshot.energyAvailable).toBe(425);
  });

  it("defaults energyAvailable to 0 when no rooms are visible", () => {
    setGame({
      ...createMockGame(),
      getRooms: () => [],
    });

    const snapshot = buildWorldSnapshot();

    expect(snapshot.energyAvailable).toBe(0);
  });
});

describe("Era derivation (Story 6.1)", () => {
  beforeEach(() => {
    setGame();
  });

  it("is 'generalist' when RCL is below ERA_MIN_RCL", () => {
    setGame(
      createMockGame({
        controller: {
          id: "controller1" as Id<StructureController>,
          pos: { x: 10, y: 20, roomName: "sim" },
          level: 1,
          progress: 0,
          progressTotal: 200,
        },
        structures: [],
        sources: [],
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.era).toBe("generalist");
  });

  it("is 'generalist' when Extensions count is below ERA_EXTENSIONS_REQUIRED", () => {
    setGame(
      createMockGame({
        controller: {
          id: "controller1" as Id<StructureController>,
          pos: { x: 10, y: 20, roomName: "sim" },
          level: 2,
          progress: 0,
          progressTotal: 200,
        },
        structures: [
          {
            id: "ext1" as Id<StructureExtension>,
            pos: { x: 6, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext2" as Id<StructureExtension>,
            pos: { x: 7, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext3" as Id<StructureExtension>,
            pos: { x: 8, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext4" as Id<StructureExtension>,
            pos: { x: 9, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
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
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.era).toBe("generalist");
  });

  it("is 'generalist' when a Source lacks an adjacent Container", () => {
    setGame(
      createMockGame({
        controller: {
          id: "controller1" as Id<StructureController>,
          pos: { x: 10, y: 20, roomName: "sim" },
          level: 2,
          progress: 0,
          progressTotal: 200,
        },
        structures: [
          {
            id: "ext1" as Id<StructureExtension>,
            pos: { x: 6, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext2" as Id<StructureExtension>,
            pos: { x: 7, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext3" as Id<StructureExtension>,
            pos: { x: 8, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext4" as Id<StructureExtension>,
            pos: { x: 9, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext5" as Id<StructureExtension>,
            pos: { x: 10, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "container1" as Id<StructureContainer>,
            pos: { x: 20, y: 21, roomName: "sim" },
            structureType: "container",
            energy: 0,
            energyCapacity: 2000,
          },
        ],
        sources: [
          {
            id: "source1" as Id<Source>,
            pos: { x: 20, y: 20, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
          {
            id: "source2" as Id<Source>,
            pos: { x: 30, y: 30, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.era).toBe("generalist");
  });

  it("is 'specialist' when all conditions are met", () => {
    setGame(
      createMockGame({
        controller: {
          id: "controller1" as Id<StructureController>,
          pos: { x: 10, y: 20, roomName: "sim" },
          level: 2,
          progress: 0,
          progressTotal: 200,
        },
        structures: [
          {
            id: "ext1" as Id<StructureExtension>,
            pos: { x: 6, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext2" as Id<StructureExtension>,
            pos: { x: 7, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext3" as Id<StructureExtension>,
            pos: { x: 8, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext4" as Id<StructureExtension>,
            pos: { x: 9, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext5" as Id<StructureExtension>,
            pos: { x: 10, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "container1" as Id<StructureContainer>,
            pos: { x: 20, y: 21, roomName: "sim" },
            structureType: "container",
            energy: 0,
            energyCapacity: 2000,
          },
          {
            id: "container2" as Id<StructureContainer>,
            pos: { x: 30, y: 31, roomName: "sim" },
            structureType: "container",
            energy: 0,
            energyCapacity: 2000,
          },
        ],
        sources: [
          {
            id: "source1" as Id<Source>,
            pos: { x: 20, y: 20, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
          {
            id: "source2" as Id<Source>,
            pos: { x: 30, y: 30, roomName: "sim" },
            energy: 1500,
            energyCapacity: 3000,
          },
        ],
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.era).toBe("specialist");
  });

  it("is 'generalist' when controller is undefined", () => {
    setGame(
      createMockGame({
        controller: undefined,
        structures: [
          {
            id: "ext1" as Id<StructureExtension>,
            pos: { x: 6, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
        ],
        sources: [],
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.era).toBe("generalist");
  });

  it("is 'generalist' when a Container is not adjacent (distance > 1)", () => {
    setGame(
      createMockGame({
        controller: {
          id: "controller1" as Id<StructureController>,
          pos: { x: 10, y: 20, roomName: "sim" },
          level: 2,
          progress: 0,
          progressTotal: 200,
        },
        structures: [
          {
            id: "ext1" as Id<StructureExtension>,
            pos: { x: 6, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext2" as Id<StructureExtension>,
            pos: { x: 7, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext3" as Id<StructureExtension>,
            pos: { x: 8, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext4" as Id<StructureExtension>,
            pos: { x: 9, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext5" as Id<StructureExtension>,
            pos: { x: 10, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "container1" as Id<StructureContainer>,
            pos: { x: 20, y: 22, roomName: "sim" },
            structureType: "container",
            energy: 0,
            energyCapacity: 2000,
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
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.era).toBe("generalist");
  });

  it("is 'specialist' when there are no Sources and all other conditions are met", () => {
    setGame(
      createMockGame({
        controller: {
          id: "controller1" as Id<StructureController>,
          pos: { x: 10, y: 20, roomName: "sim" },
          level: 2,
          progress: 0,
          progressTotal: 200,
        },
        structures: [
          {
            id: "ext1" as Id<StructureExtension>,
            pos: { x: 6, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext2" as Id<StructureExtension>,
            pos: { x: 7, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext3" as Id<StructureExtension>,
            pos: { x: 8, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext4" as Id<StructureExtension>,
            pos: { x: 9, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
          {
            id: "ext5" as Id<StructureExtension>,
            pos: { x: 10, y: 5, roomName: "sim" },
            structureType: "extension",
            energy: 50,
            energyCapacity: 50,
          },
        ],
        sources: [],
      }),
    );

    const snapshot = buildWorldSnapshot();

    expect(snapshot.era).toBe("specialist");
  });

  it("defaults to 'generalist' in the empty/defensive snapshot", () => {
    // Empty rooms should always have generalist era
    setGame(createMockGame());

    const snapshot = buildWorldSnapshot();

    expect(snapshot.era).toBe("generalist");
  });
});

describe("WorldSnapshot as plain data", () => {
  it("accepts a literal plain-data snapshot with no Game mocks", () => {
    const snapshot: WorldSnapshot = {
      roomName: "sim",
      tick: 0,
      energyAvailable: 250,
      era: "generalist",
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
    expect(snapshot.energyAvailable).toBe(250);
  });
});

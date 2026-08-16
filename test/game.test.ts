import { afterEach, describe, expect, it } from "vitest";
import { getGame, setGame } from "../src/game";

/**
 * Exercises `defaultGame.findSources` against a fake global `Game`, mirroring
 * the room-lookup + `find` pattern the other `defaultGame` methods use.
 */
// FIND_SOURCES_ACTIVE is an ambient `declare const` type the real Screeps
// engine provides as a runtime global — vitest/Node does not, so the real
// `defaultGame.findSources` (exercised here, unlike other tests which inject
// a mock GameAdapter) needs it stubbed to call through faithfully.
const FIND_SOURCES_ACTIVE_CODE = 104;
(globalThis as unknown as Record<string, unknown>).FIND_SOURCES_ACTIVE =
  FIND_SOURCES_ACTIVE_CODE;

// FIND_MY_STRUCTURES and STRUCTURE_SPAWN are likewise ambient `declare const`
// runtime globals the real engine provides — stubbed here for the same
// reason as FIND_SOURCES_ACTIVE above.
const FIND_MY_STRUCTURES_CODE = 108;
(globalThis as unknown as Record<string, unknown>).FIND_MY_STRUCTURES =
  FIND_MY_STRUCTURES_CODE;
(globalThis as unknown as Record<string, unknown>).STRUCTURE_SPAWN = "spawn";

// FIND_STRUCTURES and STRUCTURE_CONTAINER are likewise ambient globals — stubbed
// for testing Container merging in findMyStructures (Story 6.5).
const FIND_STRUCTURES_CODE = 111;
(globalThis as unknown as Record<string, unknown>).FIND_STRUCTURES =
  FIND_STRUCTURES_CODE;
(globalThis as unknown as Record<string, unknown>).STRUCTURE_CONTAINER =
  "container";

interface MockRoom {
  find: (type: unknown) => unknown[];
}

function stubGameGlobal(
  rooms: Record<string, MockRoom>,
  extra: Record<string, unknown> = {},
): void {
  (globalThis as { Game: unknown }).Game = { rooms, ...extra };
}

afterEach(() => {
  setGame();
});

describe("defaultGame.findSources", () => {
  it("maps active Sources from the room via FIND_SOURCES_ACTIVE", () => {
    const source = {
      id: "source1",
      pos: { x: 10, y: 12, roomName: "sim" },
      energy: 1500,
      energyCapacity: 3000,
    };
    stubGameGlobal({
      sim: {
        find: (type: unknown) =>
          type === FIND_SOURCES_ACTIVE_CODE ? [source] : [],
      },
    });

    expect(getGame().findSources("sim")).toEqual([
      {
        id: "source1",
        pos: { x: 10, y: 12, roomName: "sim" },
        energy: 1500,
        energyCapacity: 3000,
      },
    ]);
  });

  it("returns an empty array when the room is not visible", () => {
    stubGameGlobal({});

    expect(getGame().findSources("unseen")).toEqual([]);
  });
});

describe("defaultGame.findMyStructures — spawning field", () => {
  it("maps a busy Spawn (non-null spawning) to spawning: true", () => {
    const busySpawn = {
      id: "spawn1",
      pos: { x: 5, y: 5, roomName: "sim" },
      structureType: "spawn",
      energy: 200,
      energyCapacity: 300,
      spawning: { name: "generalist-sim-100" },
    };
    stubGameGlobal({
      sim: {
        find: (type: unknown) =>
          type === FIND_MY_STRUCTURES_CODE ? [busySpawn] : [],
      },
    });

    expect(getGame().findMyStructures("sim")).toEqual([
      {
        id: "spawn1",
        pos: { x: 5, y: 5, roomName: "sim" },
        structureType: "spawn",
        energy: 200,
        energyCapacity: 300,
        spawning: true,
      },
    ]);
  });

  it("maps an idle Spawn (spawning: null) to spawning: false", () => {
    const idleSpawn = {
      id: "spawn2",
      pos: { x: 5, y: 5, roomName: "sim" },
      structureType: "spawn",
      energy: 300,
      energyCapacity: 300,
      spawning: null,
    };
    stubGameGlobal({
      sim: {
        find: (type: unknown) =>
          type === FIND_MY_STRUCTURES_CODE ? [idleSpawn] : [],
      },
    });

    expect(getGame().findMyStructures("sim")).toEqual([
      {
        id: "spawn2",
        pos: { x: 5, y: 5, roomName: "sim" },
        structureType: "spawn",
        energy: 300,
        energyCapacity: 300,
        spawning: false,
      },
    ]);
  });

  it("merges Containers from FIND_STRUCTURES into owned structures (Story 6.5)", () => {
    const spawn = {
      id: "spawn1",
      pos: { x: 5, y: 5, roomName: "sim" },
      structureType: "spawn",
      energy: 200,
      energyCapacity: 300,
      spawning: null,
    };
    const container = {
      id: "container1",
      pos: { x: 25, y: 25, roomName: "sim" },
      structureType: "container",
      store: { energy: 1000 },
      storeCapacity: 2000,
    };
    stubGameGlobal({
      sim: {
        find: (type: unknown) => {
          if (type === FIND_MY_STRUCTURES_CODE) return [spawn];
          if (type === FIND_STRUCTURES_CODE) return [container];
          return [];
        },
      },
    });

    expect(getGame().findMyStructures("sim")).toEqual([
      {
        id: "spawn1",
        pos: { x: 5, y: 5, roomName: "sim" },
        structureType: "spawn",
        energy: 200,
        energyCapacity: 300,
        spawning: false,
      },
      {
        id: "container1",
        pos: { x: 25, y: 25, roomName: "sim" },
        structureType: "container",
        energy: 1000,
        energyCapacity: 2000,
      },
    ]);
  });

  it("filters FIND_STRUCTURES to only include Containers", () => {
    const spawn = {
      id: "spawn1",
      pos: { x: 5, y: 5, roomName: "sim" },
      structureType: "spawn",
      energy: 200,
      energyCapacity: 300,
      spawning: null,
    };
    const container = {
      id: "container1",
      pos: { x: 25, y: 25, roomName: "sim" },
      structureType: "container",
      store: { energy: 1000 },
      storeCapacity: 2000,
    };
    const road = {
      id: "road1",
      pos: { x: 10, y: 10, roomName: "sim" },
      structureType: "road",
      hits: 5000,
      hitsMax: 5000,
    };
    stubGameGlobal({
      sim: {
        find: (type: unknown) => {
          if (type === FIND_MY_STRUCTURES_CODE) return [spawn];
          if (type === FIND_STRUCTURES_CODE) return [container, road];
          return [];
        },
      },
    });

    const structures = getGame().findMyStructures("sim");
    expect(structures).toHaveLength(2);
    expect(structures.some((s) => s.structureType === "container")).toBe(true);
    expect(structures.some((s) => s.structureType === "road")).toBe(false);
  });
});

describe("defaultGame.getTime", () => {
  it("returns the stubbed Game.time value", () => {
    stubGameGlobal({}, { time: 12345 });

    expect(getGame().getTime()).toBe(12345);
  });
});

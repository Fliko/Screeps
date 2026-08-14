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

function stubGameGlobal(
  rooms: Record<string, { find: (type: unknown) => unknown[] }>,
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
});

describe("defaultGame.getTime", () => {
  it("returns the stubbed Game.time value", () => {
    stubGameGlobal({}, { time: 12345 });

    expect(getGame().getTime()).toBe(12345);
  });
});

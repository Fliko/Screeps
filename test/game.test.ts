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

function stubGameGlobal(
  rooms: Record<string, { find: (type: unknown) => unknown[] }>,
): void {
  (globalThis as { Game: unknown }).Game = { rooms };
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

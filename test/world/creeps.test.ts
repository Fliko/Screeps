import { afterEach, describe, expect, it } from "vitest";
import type { GameAdapter } from "../../src/game";
import { setGame } from "../../src/game";
import { clearCreepContract } from "../../src/world/creeps";

function createMockGame(resolve: (id: string) => unknown): GameAdapter {
  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    findMyStructures: () => [],
    findConstructionSites: () => [],
    findCreeps: () => [],
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getObjectById: ((id: string) =>
      resolve(id)) as GameAdapter["getObjectById"],
  };
}

afterEach(() => {
  setGame();
});

describe("clearCreepContract", () => {
  it("clears the resolved Creep's Contract and returns true", () => {
    const creep = { id: "c1", memory: { contract: "fill:spawn1" } };
    setGame(createMockGame(() => creep));

    expect(clearCreepContract("c1")).toBe(true);
    expect(creep.memory.contract).toBeUndefined();
    expect("contract" in creep.memory).toBe(false);
  });

  it("returns true and is a no-op when the Creep holds no Contract", () => {
    const creep = { id: "c1", memory: {} };
    setGame(createMockGame(() => creep));

    expect(clearCreepContract("c1")).toBe(true);
    expect(creep.memory).toEqual({});
  });

  it("returns false when the id resolves to nothing", () => {
    setGame(createMockGame(() => undefined));

    expect(clearCreepContract("gone")).toBe(false);
  });

  it("returns false when the id resolves to an object without memory", () => {
    const notACreep = { id: "s1", structureType: "spawn" };
    setGame(createMockGame(() => notACreep));

    expect(clearCreepContract("s1")).toBe(false);
    expect(notACreep).toEqual({ id: "s1", structureType: "spawn" });
  });

  it("passes the requested id through to the Game adapter", () => {
    const seen: string[] = [];
    setGame(
      createMockGame((id) => {
        seen.push(id);
        return undefined;
      }),
    );

    clearCreepContract("abc123");
    expect(seen).toEqual(["abc123"]);
  });
});

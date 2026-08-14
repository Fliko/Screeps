import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, JobType } from "../../src/board/job";
import { makeJob } from "../../src/board/job";
import * as registry from "../../src/board/registry";
import { addJob, resetBoard } from "../../src/board/registry";
import { deriveTakenSet } from "../../src/control/taken";
import { validate } from "../../src/control/validate";
import type { CreepStub, GameAdapter } from "../../src/game";
import { setGame } from "../../src/game";
import * as snapshotModule from "../../src/world/snapshot";
import { buildWorldSnapshot } from "../../src/world/snapshot";

const EMPTY_TAKEN_SET = deriveTakenSet([]);

function createCreep(
  id: string,
  contract?: string,
  ttl = 1500,
  carry = 0,
  spawning = false,
): CreepStub {
  return {
    id,
    pos: { x: 0, y: 0, roomName: "sim" },
    body: ["work", "carry", "move"],
    ttl,
    carry,
    carryCapacity: 50,
    spawning,
    memory: contract === undefined ? {} : { contract },
  };
}

function createMockGame(creeps: CreepStub[]): GameAdapter {
  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    findMyStructures: () => [],
    findConstructionSites: () => [],
    findSources: () => [],
    findCreeps: () => creeps,
    getController: () => undefined,
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => 0,
    // Screeps ids resolve to the live object; the test stubs stand in for Creeps.
    getObjectById: ((id: string) =>
      creeps.find((creep) => creep.id === id)) as GameAdapter["getObjectById"],
  };
}

function makeTestJob(type: JobType, targetId: string, ttlFloor = 200): Job {
  return makeJob({
    type,
    targetId,
    pos: { x: 1, y: 1, roomName: "sim" },
    tier: "critical",
    withinTierPriority: 0,
    maxWorkers: 1,
    assignmentMode: "pulled",
    lifetimeClass: "transient",
    requirements: { body: ["work", "carry", "move"], ttlFloor },
  });
}

/** Stages the Board and the world snapshot for one Tick. */
function stage(creeps: CreepStub[], jobs: Job[]): void {
  setGame(createMockGame(creeps));
  resetBoard();
  for (const job of jobs) {
    addJob(job);
  }
  buildWorldSnapshot();
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  setGame();
});

describe("validate — I/O matrix", () => {
  it("clears the Contract when the Job vanished from the Board", () => {
    const creep = createCreep("c1", "fill:spawn1");
    stage([creep], []);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([{ jobId: "fill:spawn1" }]);
    expect(creep.memory.contract).toBeUndefined();
  });

  it("clears the Contract when ttl is below the Job's ttlFloor", () => {
    const creep = createCreep("c1", "fill:spawn1", 199);
    stage([creep], [makeTestJob("fill", "spawn1", 200)]);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([{ jobId: "fill:spawn1" }]);
    expect(creep.memory.contract).toBeUndefined();
  });

  it("leaves a still-valid Contract untouched and out of the returned array", () => {
    const creep = createCreep("c1", "fill:spawn1", 1500);
    stage([creep], [makeTestJob("fill", "spawn1", 200)]);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([]);
    expect(creep.memory.contract).toBe("fill:spawn1");
  });

  it("keeps a mine Contract valid even with no Board Job for it", () => {
    const creep = createCreep("c1", "mine:source1", 5);
    stage([creep], []);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([]);
    expect(creep.memory.contract).toBe("mine:source1");
  });

  it("ignores carry state — two Creeps differing only in carry share the outcome", () => {
    const empty = createCreep("c1", "fill:spawn1", 1500, 0);
    const full = createCreep("c2", "fill:spawn1", 1500, 50);
    stage([empty, full], [makeTestJob("fill", "spawn1", 200)]);
    expect(validate(EMPTY_TAKEN_SET)).toEqual([]);
    expect(empty.memory.contract).toBe("fill:spawn1");
    expect(full.memory.contract).toBe("fill:spawn1");

    const emptyGone = createCreep("c1", "fill:spawn1", 1500, 0);
    const fullGone = createCreep("c2", "fill:spawn1", 1500, 50);
    stage([emptyGone, fullGone], []);
    expect(validate(EMPTY_TAKEN_SET)).toEqual([
      { jobId: "fill:spawn1" },
      { jobId: "fill:spawn1" },
    ]);
    expect(emptyGone.memory.contract).toBeUndefined();
    expect(fullGone.memory.contract).toBeUndefined();
  });

  it("returns [] and clears nothing when there is no snapshot", () => {
    const creep = createCreep("c1", "fill:spawn1");
    stage([creep], []);
    vi.spyOn(snapshotModule, "getCurrentSnapshot").mockReturnValue(undefined);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([]);
    expect(creep.memory.contract).toBe("fill:spawn1");
  });
});

describe("validate — guards and cohorts", () => {
  it("keeps the Contract of a Spawning Creep with an open Job (FR-16, FR-29)", () => {
    const creep = createCreep("spawning1", "fill:spawn1", 0, 0, true);
    stage([creep], [makeTestJob("fill", "spawn1", 200)]);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([]);
    expect(creep.memory.contract).toBe("fill:spawn1");
  });

  it("clears a NON-spawning Creep at ttl 0 — it is dying, not spawning", () => {
    const creep = createCreep("dying1", "fill:spawn1", 0, 0, false);
    stage([creep], [makeTestJob("fill", "spawn1", 200)]);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([{ jobId: "fill:spawn1" }]);
    expect(creep.memory.contract).toBeUndefined();
  });

  it("still clears a Spawning Creep's Contract when its Job vanished", () => {
    const creep = createCreep("spawning1", "fill:spawn1", 0, 0, true);
    stage([creep], []);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([{ jobId: "fill:spawn1" }]);
    expect(creep.memory.contract).toBeUndefined();
  });

  it("bails with [] when no Board exists, rather than mass-clearing", () => {
    const creep = createCreep("c1", "fill:spawn1");
    stage([creep], []);
    vi.spyOn(registry, "getBoard").mockReturnValue(undefined);

    expect(validate(EMPTY_TAKEN_SET)).toEqual([]);
    expect(creep.memory.contract).toBe("fill:spawn1");
  });

  it("handles a mixed cohort, returning exactly the cleared jobIds", () => {
    const keepOpen = createCreep("c1", "fill:spawn1", 1500);
    const gone = createCreep("c2", "build:site1", 1500);
    const tooOld = createCreep("c3", "upgrade:ctrl1", 10);
    const mine = createCreep("c4", "mine:source1", 10);
    const idle = createCreep("c5");
    stage(
      [keepOpen, gone, tooOld, mine, idle],
      [
        makeTestJob("fill", "spawn1", 200),
        makeTestJob("upgrade", "ctrl1", 200),
      ],
    );

    const cleared = validate(EMPTY_TAKEN_SET);

    expect(cleared).toEqual([
      { jobId: "build:site1" },
      { jobId: "upgrade:ctrl1" },
    ]);
    expect(keepOpen.memory.contract).toBe("fill:spawn1");
    expect(gone.memory.contract).toBeUndefined();
    expect(tooOld.memory.contract).toBeUndefined();
    expect(mine.memory.contract).toBe("mine:source1");
    expect(idle.memory.contract).toBeUndefined();
  });

  it("does not report a clear when the Creep can no longer be resolved", () => {
    const creep = createCreep("c1", "fill:spawn1");
    setGame({
      ...createMockGame([creep]),
      getObjectById: (() => undefined) as GameAdapter["getObjectById"],
    });
    resetBoard();
    buildWorldSnapshot();

    expect(validate(EMPTY_TAKEN_SET)).toEqual([]);
    // Memory was never reachable, so the Contract string is still in place.
    expect(creep.memory.contract).toBe("fill:spawn1");
  });

  it("mutates the memory of the Creep resolved through getObjectById", () => {
    const snapshotStub = createCreep("c1", "fill:spawn1");
    // A distinct live object under the same id — proves validate clears what the
    // Game adapter resolves, not the snapshot's copy.
    const liveCreep = { id: "c1", memory: { contract: "fill:spawn1" } };
    setGame({
      ...createMockGame([snapshotStub]),
      getObjectById: (() =>
        liveCreep) as unknown as GameAdapter["getObjectById"],
    });
    resetBoard();
    buildWorldSnapshot();

    expect(validate(EMPTY_TAKEN_SET)).toEqual([{ jobId: "fill:spawn1" }]);
    expect(liveCreep.memory.contract).toBeUndefined();
  });
});

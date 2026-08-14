import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, JobType } from "../../src/board/job";
import { makeJob } from "../../src/board/job";
import * as registry from "../../src/board/registry";
import { addJob, resetBoard } from "../../src/board/registry";
import { match, selectJob } from "../../src/control/match";
import { deriveTakenSet } from "../../src/control/taken";
import type { CreepStub, GameAdapter } from "../../src/game";
import { setGame } from "../../src/game";
import type { SnapshotCreep } from "../../src/world/snapshot";
import * as snapshotModule from "../../src/world/snapshot";
import { buildWorldSnapshot } from "../../src/world/snapshot";

const EMPTY_TAKEN_SET = deriveTakenSet([]);

function createCreep(
  id: string,
  contract?: string,
  ttl = 1500,
  spawning = false,
  x = 0,
  y = 0,
): CreepStub {
  return {
    id,
    pos: { x, y, roomName: "sim" },
    body: ["work", "carry", "move"],
    ttl,
    carry: 0,
    carryCapacity: 50,
    spawning,
    memory: contract === undefined ? {} : { contract },
  };
}

function snapshotCreep(id: string, ttl = 1500, x = 0, y = 0): SnapshotCreep {
  return {
    id,
    pos: { x, y, roomName: "sim" },
    body: ["work", "carry", "move"],
    ttl,
    carry: 0,
    carryCapacity: 50,
    spawning: false,
    contract: undefined,
  };
}

function makeTestJob(
  type: JobType,
  targetId: string,
  overrides: Partial<{
    tier: Job["tier"];
    withinTierPriority: number;
    maxWorkers: number;
    assignmentMode: Job["assignmentMode"];
    ttlFloor: number;
    x: number;
    y: number;
  }> = {},
): Job {
  return makeJob({
    type,
    targetId,
    pos: { x: overrides.x ?? 5, y: overrides.y ?? 5, roomName: "sim" },
    tier: overrides.tier ?? "critical",
    withinTierPriority: overrides.withinTierPriority ?? 0,
    maxWorkers: overrides.maxWorkers ?? 1,
    assignmentMode: overrides.assignmentMode ?? "pulled",
    lifetimeClass: "transient",
    requirements: {
      body: ["work", "carry", "move"],
      ttlFloor: overrides.ttlFloor ?? 0,
    },
  });
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
    getObjectById: ((id: string) =>
      creeps.find((creep) => creep.id === id)) as GameAdapter["getObjectById"],
  };
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

describe("selectJob — pure scoring", () => {
  it("picks the critical Job over a nearer medium Job (tier beats distance)", () => {
    const creep = snapshotCreep("c1", 1500, 0, 0);
    const critical = makeTestJob("fill", "far", {
      tier: "critical",
      x: 40,
      y: 40,
    });
    const medium = makeTestJob("build", "near", { tier: "medium", x: 1, y: 1 });

    expect(selectJob(creep, [medium, critical], new Map())).toBe(critical);
  });

  it("picks the higher withinTierPriority Job over a nearer same-tier Job", () => {
    const creep = snapshotCreep("c1", 1500, 0, 0);
    const highPriority = makeTestJob("fill", "far", {
      tier: "high",
      withinTierPriority: 5,
      x: 40,
      y: 40,
    });
    const lowPriority = makeTestJob("fill", "near", {
      tier: "high",
      withinTierPriority: 1,
      x: 1,
      y: 1,
    });

    expect(selectJob(creep, [lowPriority, highPriority], new Map())).toBe(
      highPriority,
    );
  });

  it("breaks ties on equal tier and priority using distance", () => {
    const creep = snapshotCreep("c1", 1500, 0, 0);
    const far = makeTestJob("fill", "far", { x: 40, y: 40 });
    const near = makeTestJob("build", "near", { x: 1, y: 1 });

    expect(selectJob(creep, [far, near], new Map())).toBe(near);
  });

  it("excludes a Job when the Creep's ttl is below the Job's ttlFloor", () => {
    const creep = snapshotCreep("c1", 100, 0, 0);
    const tooDemanding = makeTestJob("fill", "spawn1", { ttlFloor: 200 });
    const eligible = makeTestJob("build", "site1", { ttlFloor: 50 });

    expect(selectJob(creep, [tooDemanding, eligible], new Map())).toBe(
      eligible,
    );
    expect(selectJob(creep, [tooDemanding], new Map())).toBeUndefined();
  });

  it("never selects a reserved-mode Job", () => {
    const creep = snapshotCreep("c1", 1500, 0, 0);
    const reserved = makeTestJob("fill", "spawn1", {
      assignmentMode: "reserved",
    });

    expect(selectJob(creep, [reserved], new Map())).toBeUndefined();
  });

  it("excludes a Job at full local capacity", () => {
    const creep = snapshotCreep("c1", 1500, 0, 0);
    const job = makeTestJob("fill", "spawn1", { maxWorkers: 1 });
    const counts = new Map([[job.id, 1]]);

    expect(selectJob(creep, [job], counts)).toBeUndefined();
  });

  it("returns undefined when no Job is eligible", () => {
    const creep = snapshotCreep("c1", 1500, 0, 0);
    expect(selectJob(creep, [], new Map())).toBeUndefined();
  });

  it("picks the first Job in the array on a full tie (tier, priority, distance)", () => {
    const creep = snapshotCreep("c1", 1500, 0, 0);
    const first = makeTestJob("fill", "a", {
      tier: "high",
      withinTierPriority: 2,
      x: 5,
      y: 5,
    });
    const second = makeTestJob("build", "b", {
      tier: "high",
      withinTierPriority: 2,
      x: 5,
      y: 5,
    });

    expect(selectJob(creep, [first, second], new Map())).toBe(first);
    expect(selectJob(creep, [second, first], new Map())).toBe(second);
  });
});

describe("match — I/O matrix", () => {
  it("assigns a Job to a single idle Creep", () => {
    const creep = createCreep("c1");
    const job = makeTestJob("fill", "spawn1");
    stage([creep], [job]);

    match(EMPTY_TAKEN_SET);

    expect(creep.memory.contract).toBe(job.id);
  });

  it("claim lock: exactly one of three idle Creeps claims a maxWorkers:1 Job", () => {
    const c1 = createCreep("c1");
    const c2 = createCreep("c2");
    const c3 = createCreep("c3");
    const job = makeTestJob("fill", "spawn1", { maxWorkers: 1 });
    stage([c1, c2, c3], [job]);

    match(EMPTY_TAKEN_SET);

    const assigned = [c1, c2, c3].filter(
      (creep) => creep.memory.contract === job.id,
    );
    expect(assigned).toHaveLength(1);
  });

  it("skips a Spawning Creep even without a Contract", () => {
    const spawning = createCreep("c1", undefined, 0, true);
    const job = makeTestJob("fill", "spawn1");
    stage([spawning], [job]);

    match(EMPTY_TAKEN_SET);

    expect(spawning.memory.contract).toBeUndefined();
  });

  it("never touches a Creep that already holds a valid Contract", () => {
    const creep = createCreep("c1", "build:site1");
    const job = makeTestJob("fill", "spawn1");
    stage([creep], [job]);

    match(EMPTY_TAKEN_SET);

    expect(creep.memory.contract).toBe("build:site1");
  });

  it("does nothing when there is no snapshot", () => {
    const creep = createCreep("c1");
    stage([creep], [makeTestJob("fill", "spawn1")]);
    vi.spyOn(snapshotModule, "getCurrentSnapshot").mockReturnValue(undefined);

    match(EMPTY_TAKEN_SET);

    expect(creep.memory.contract).toBeUndefined();
  });

  it("logs and skips when there is no Board", () => {
    const creep = createCreep("c1");
    stage([creep], [makeTestJob("fill", "spawn1")]);
    vi.spyOn(registry, "getBoard").mockReturnValue(undefined);

    match(EMPTY_TAKEN_SET);

    expect(creep.memory.contract).toBeUndefined();
    expect(vi.mocked(console.log)).toHaveBeenCalledWith(
      expect.stringContaining("[control]"),
    );
  });

  it("logs and skips a Creep that cannot be resolved through getObjectById", () => {
    const creepStub = createCreep("c1");
    const job = makeTestJob("fill", "spawn1");
    setGame({
      ...createMockGame([creepStub]),
      getObjectById: (() => undefined) as GameAdapter["getObjectById"],
    });
    resetBoard();
    addJob(job);
    buildWorldSnapshot();

    match(EMPTY_TAKEN_SET);

    expect(vi.mocked(console.log)).toHaveBeenCalledWith(
      expect.stringContaining("[control]"),
    );
  });

  it("respects taken-set counts already consumed before match starts", () => {
    const idle = createCreep("c1");
    const job = makeTestJob("fill", "spawn1", { maxWorkers: 1 });
    stage([idle], [job]);
    const taken = deriveTakenSet([{ jobId: job.id }]);

    match(taken);

    expect(idle.memory.contract).toBeUndefined();
  });
});

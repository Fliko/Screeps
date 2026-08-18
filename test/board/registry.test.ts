import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Job,
  type JobId,
  type JobType,
  makeJob,
} from "../../src/board/job";
import {
  addJob,
  findJob,
  getBoard,
  resetBoard,
} from "../../src/board/registry";
import { NODE_BY_TYPE } from "../helpers/node-fixtures";

function makeTestJob(type: JobType, targetId: string): Job {
  return makeJob({
    type,
    node: NODE_BY_TYPE[type],
    targetId,
    pos: { x: 1, y: 2, roomName: "sim" },
    tier: "medium",
    withinTierPriority: 0,
    maxWorkers: 1,
    assignmentMode: "pulled",
    lifetimeClass: "transient",
    requirements: { body: ["work", "carry", "move"], ttlFloor: 100 },
  });
}

describe("Board registry (AC3)", () => {
  beforeEach(() => {
    resetBoard();
  });

  it("getBoard returns undefined before the first resetBoard call", async () => {
    vi.resetModules();
    const { getBoard } = await import("../../src/board/registry");
    expect(getBoard()).toBeUndefined();
  });

  it("resetBoard creates an empty Board", () => {
    const board = getBoard();
    expect(board).toBeDefined();
    expect(board?.jobs).toHaveLength(0);
    expect(board?.jobs).toEqual([]);
  });

  it("addJob appends jobs to the board", () => {
    const job = makeTestJob("fill", "spawn1");
    addJob(job);
    const board = getBoard();
    expect(board?.jobs).toHaveLength(1);
    expect(board?.jobs[0]).toEqual(job);
  });

  it("addJob appends multiple jobs in order", () => {
    addJob(makeTestJob("fill", "spawn1"));
    addJob(makeTestJob("build", "site1"));
    addJob(makeTestJob("upgrade", "controller1"));
    expect(getBoard()?.jobs).toHaveLength(3);
    expect(getBoard()?.jobs[0].id).toBe("fill:spawns:spawn1");
    expect(getBoard()?.jobs[1].id).toBe("build:build:site1");
    expect(getBoard()?.jobs[2].id).toBe("upgrade:upgrade:controller1");
  });

  it("findJob returns the correct job by id", () => {
    const job = makeTestJob("mine", "source1");
    addJob(job);
    expect(findJob("mine:mines:source1")).toEqual(job);
    expect(findJob("mine:mines:nonexistent" as JobId)).toBeUndefined();
  });

  it("addJob throws if board not initialized", async () => {
    vi.resetModules();
    const { addJob, getBoard } = await import("../../src/board/registry");
    expect(getBoard()).toBeUndefined();
    expect(() =>
      addJob(
        makeJob({
          type: "fill",
          node: "spawns",
          targetId: "spawn1",
          pos: { x: 1, y: 2, roomName: "sim" },
          tier: "critical",
          withinTierPriority: 0,
          maxWorkers: 1,
          assignmentMode: "pulled",
          lifetimeClass: "transient",
          requirements: { body: ["work"], ttlFloor: 100 },
        }),
      ),
    ).toThrow(/resetBoard/);
  });

  // AC3: Per-Tick rebuild — no Jobs survive from the previous Tick
  it("rebuilds from scratch each Tick — Tick 1 jobs do not survive resetBoard on Tick 2", () => {
    // Tick 1: add jobs
    addJob(makeTestJob("fill", "spawn1"));
    addJob(makeTestJob("build", "site1"));
    addJob(makeTestJob("upgrade", "controller1"));
    expect(getBoard()?.jobs).toHaveLength(3);

    // Tick 2 begins: resetBoard clears everything
    resetBoard();

    // No explicit removal code — jobs simply don't survive
    const board = getBoard();
    expect(board).toBeDefined();
    expect(board?.jobs).toHaveLength(0);
    expect(findJob("fill:spawns:spawn1")).toBeUndefined();
    expect(findJob("build:build:site1")).toBeUndefined();
    expect(findJob("upgrade:upgrade:controller1")).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { makeJob } from "../../../src/board/job";
import { addJob, getBoard, resetBoard } from "../../../src/board/registry";
import { type JobPolicyTable, setConstant } from "../../../src/config";
import { type GameAdapter, setGame } from "../../../src/game";
import { runProducers } from "../../../src/world/producers/run";
import { buildWorldSnapshot } from "../../../src/world/snapshot";

const generalistBody = ["work", "carry", "move"] as BodyPartConstant[];
const harvesterBody = ["work", "work", "carry", "move"] as BodyPartConstant[];

const BASE: JobPolicyTable = {
  fill: {
    tier: "critical",
    withinTierPriority: 0,
    maxWorkers: 1,
    assignmentMode: "pulled",
    lifetimeClass: "transient",
    requirements: { body: generalistBody, ttlFloor: 200 },
  },
  build: {
    tier: "medium",
    withinTierPriority: 0,
    maxWorkers: 1,
    assignmentMode: "pulled",
    lifetimeClass: "transient",
    requirements: { body: generalistBody, ttlFloor: 200 },
  },
  upgrade: {
    tier: "low",
    withinTierPriority: 0,
    maxWorkers: Infinity,
    assignmentMode: "pulled",
    lifetimeClass: "persistent",
    requirements: { body: generalistBody, ttlFloor: 0 },
  },
  mine: {
    tier: "high",
    withinTierPriority: 0,
    maxWorkers: 1,
    assignmentMode: "reserved",
    lifetimeClass: "persistent",
    requirements: { body: harvesterBody, ttlFloor: 0 },
  },
};

function createMockGame(): GameAdapter {
  return {
    cpu: { getUsed: () => 0 },
    getRooms: () => ["sim"],
    getController: () => ({
      id: "controller1",
      pos: { x: 10, y: 10, roomName: "sim" },
      level: 1,
      progress: 0,
      progressTotal: 200,
    }),
    findMyStructures: () => [
      {
        id: "ext1",
        pos: { x: 1, y: 1, roomName: "sim" },
        structureType: "extension",
        energy: 25,
        energyCapacity: 50,
      },
    ],
    findConstructionSites: () => [
      {
        id: "site1",
        pos: { x: 5, y: 5, roomName: "sim" },
        structureType: "extension",
        progress: 10,
        progressTotal: 100,
      },
    ],
    findSources: () => [],
    findCreeps: () => [],
    getTerrain: () => ({ get: () => 0 }),
    getTime: () => 0,
    getEnergyAvailable: () => 300,
    getObjectById: () => undefined,
  };
}

function runTick(): void {
  buildWorldSnapshot();
  runProducers();
}

describe("runProducers", () => {
  beforeEach(() => {
    setGame(createMockGame());
    resetBoard();
    setConstant("JOB_POLICY_TABLE", BASE);
  });

  it("populates the Board with fill, build, and upgrade Jobs from the snapshot (AC1)", () => {
    runTick();
    const jobs = getBoard()?.jobs ?? [];
    expect(jobs.map((j) => j.id)).toEqual([
      "fill:ext1",
      "build:site1",
      "upgrade:controller1",
    ]);
  });

  it("emits identical Job ids for identical world states on different Ticks (AC3)", () => {
    runTick();
    const first = (getBoard()?.jobs ?? []).map((j) => j.id);
    resetBoard();
    runTick();
    const second = (getBoard()?.jobs ?? []).map((j) => j.id);
    expect(second).toEqual(first);
  });

  it("reads policy values from the config table, not literals (AC2)", () => {
    setConstant("JOB_POLICY_TABLE", {
      ...BASE,
      fill: { ...BASE.fill, tier: "high", maxWorkers: 2 },
    });
    runTick();
    const jobs = getBoard()?.jobs ?? [];
    const fillJob = jobs.find((j) => j.id === "fill:ext1");
    expect(fillJob).toBeDefined();
    expect(fillJob?.tier).toBe("high");
    expect(fillJob?.maxWorkers).toBe(2);
  });

  it("emits nothing (empty Board) when the world has no needs", () => {
    setGame({
      ...createMockGame(),
      getController: () => undefined,
      findMyStructures: () => [],
      findConstructionSites: () => [],
    });
    runTick();
    expect(getBoard()?.jobs).toHaveLength(0);
  });

  it("throws on a stale Board when resetBoard was missed (T6 guard)", () => {
    resetBoard();
    addJob(
      makeJob({
        type: "fill",
        targetId: "ext1",
        pos: { x: 1, y: 1, roomName: "sim" },
        tier: "critical",
        withinTierPriority: 0,
        maxWorkers: 1,
        assignmentMode: "pulled",
        lifetimeClass: "transient",
        requirements: { body: generalistBody, ttlFloor: 200 },
      }),
    );
    expect(() => runTick()).toThrow(/Stale Board/);
  });
});

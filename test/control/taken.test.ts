import { describe, expect, it } from "vitest";
import type { Job, JobId, JobType } from "../../src/board/job";
import { makeJob, makeJobId } from "../../src/board/job";
import {
  deriveTakenSet,
  getTakenCount,
  hasCapacity,
  releaseContracts,
} from "../../src/control/taken";
import type { ContractState } from "../../src/state/contract";

function buildJob(
  maxWorkers: number,
  type: JobType = "fill",
  targetId = "spawn1",
): Job {
  return makeJob({
    type,
    targetId,
    pos: { x: 0, y: 0, roomName: "sim" },
    tier: "critical",
    withinTierPriority: 0,
    maxWorkers,
    assignmentMode: "pulled",
    lifetimeClass: "transient",
    requirements: { body: ["work", "carry", "move"], ttlFloor: 200 },
  });
}

describe("deriveTakenSet", () => {
  it("returns empty entries for empty contracts", () => {
    const taken = deriveTakenSet([]);
    expect(taken.entries.size).toBe(0);
  });

  it("counts a single contract as one", () => {
    const contracts: ContractState[] = [{ jobId: makeJobId("fill", "spawn1") }];
    const taken = deriveTakenSet(contracts);
    expect(getTakenCount(taken, "fill:spawn1")).toBe(1);
  });

  it("counts distinct contracts separately", () => {
    const contracts: ContractState[] = [
      { jobId: makeJobId("fill", "spawn1") },
      { jobId: makeJobId("build", "site1") },
    ];
    const taken = deriveTakenSet(contracts);
    expect(getTakenCount(taken, "fill:spawn1")).toBe(1);
    expect(getTakenCount(taken, "build:site1")).toBe(1);
  });

  it("increments count for duplicate contracts", () => {
    const contracts: ContractState[] = [
      { jobId: makeJobId("fill", "spawn1") },
      { jobId: makeJobId("fill", "spawn1") },
    ];
    const taken = deriveTakenSet(contracts);
    expect(getTakenCount(taken, "fill:spawn1")).toBe(2);
  });

  it("does not share internal state between calls", () => {
    const taken1 = deriveTakenSet([{ jobId: makeJobId("fill", "spawn1") }]);
    deriveTakenSet([
      { jobId: makeJobId("fill", "spawn1") },
      { jobId: makeJobId("fill", "spawn1") },
    ]);
    expect(getTakenCount(taken1, "fill:spawn1")).toBe(1);
  });

  it("returns a frozen wrapper whose entries cannot be replaced", () => {
    const taken = deriveTakenSet([{ jobId: makeJobId("fill", "spawn1") }]);
    expect(Object.isFrozen(taken)).toBe(true);
    expect(() => {
      (taken as { entries: ReadonlyMap<JobId, number> }).entries = new Map();
    }).toThrow(TypeError);
  });

  it("does not mutate the caller's array", () => {
    const contracts: readonly ContractState[] = Object.freeze([
      { jobId: makeJobId("fill", "spawn1") },
    ]);
    const taken = deriveTakenSet(contracts);
    expect(contracts).toHaveLength(1);
    expect(getTakenCount(taken, "fill:spawn1")).toBe(1);
  });
});

describe("getTakenCount", () => {
  it("returns 0 for an untaken job id", () => {
    const taken = deriveTakenSet([{ jobId: makeJobId("fill", "spawn1") }]);
    expect(getTakenCount(taken, "build:site1")).toBe(0);
  });
});

describe("hasCapacity", () => {
  it("returns true when count is below maxWorkers", () => {
    const taken = deriveTakenSet([{ jobId: makeJobId("fill", "spawn1") }]);
    expect(hasCapacity(taken, buildJob(2, "fill"))).toBe(true);
  });

  it("returns false when count reaches maxWorkers", () => {
    const taken = deriveTakenSet([
      { jobId: makeJobId("fill", "spawn1") },
      { jobId: makeJobId("fill", "spawn1") },
    ]);
    expect(hasCapacity(taken, buildJob(2, "fill"))).toBe(false);
  });

  it("returns false when the count exceeds maxWorkers", () => {
    const taken = deriveTakenSet([
      { jobId: makeJobId("fill", "spawn1") },
      { jobId: makeJobId("fill", "spawn1") },
      { jobId: makeJobId("fill", "spawn1") },
    ]);
    expect(hasCapacity(taken, buildJob(2, "fill"))).toBe(false);
  });

  it("returns false when maxWorkers is 0", () => {
    expect(hasCapacity(deriveTakenSet([]), buildJob(0, "fill"))).toBe(false);
  });

  it("returns true for Infinity maxWorkers regardless of count", () => {
    const taken = deriveTakenSet([
      { jobId: makeJobId("upgrade", "controller1") },
      { jobId: makeJobId("upgrade", "controller1") },
    ]);
    expect(getTakenCount(taken, "upgrade:controller1")).toBe(2);
    expect(
      hasCapacity(taken, buildJob(Infinity, "upgrade", "controller1")),
    ).toBe(true);
  });
});

describe("releaseContracts", () => {
  it("returns the same instance when nothing was cleared", () => {
    const taken = deriveTakenSet([{ jobId: makeJobId("fill", "spawn1") }]);
    expect(releaseContracts(taken, [])).toBe(taken);
  });

  it("decrements the count for a cleared contract", () => {
    const taken = deriveTakenSet([
      { jobId: makeJobId("fill", "spawn1") },
      { jobId: makeJobId("fill", "spawn1") },
    ]);
    const released = releaseContracts(taken, [
      { jobId: makeJobId("fill", "spawn1") },
    ]);
    expect(getTakenCount(released, "fill:spawn1")).toBe(1);
  });

  it("removes the entry when the last contract is cleared", () => {
    const taken = deriveTakenSet([{ jobId: makeJobId("fill", "spawn1") }]);
    const released = releaseContracts(taken, [
      { jobId: makeJobId("fill", "spawn1") },
    ]);
    expect(released.entries.has("fill:spawn1")).toBe(false);
    expect(getTakenCount(released, "fill:spawn1")).toBe(0);
  });

  it("does not go negative when clearing an untracked contract", () => {
    const taken = deriveTakenSet([{ jobId: makeJobId("fill", "spawn1") }]);
    const released = releaseContracts(taken, [
      { jobId: makeJobId("build", "site1") },
    ]);
    expect(getTakenCount(released, "build:site1")).toBe(0);
    expect(getTakenCount(released, "fill:spawn1")).toBe(1);
  });

  it("leaves the original taken-set unchanged", () => {
    const taken = deriveTakenSet([
      { jobId: makeJobId("fill", "spawn1") },
      { jobId: makeJobId("fill", "spawn1") },
    ]);
    releaseContracts(taken, [{ jobId: makeJobId("fill", "spawn1") }]);
    expect(getTakenCount(taken, "fill:spawn1")).toBe(2);
  });
});

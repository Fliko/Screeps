import { describe, expect, it } from "vitest";
import type { Job } from "../../src/board/job";
import { makeJobId } from "../../src/board/job";
import {
  hasDemandPressure,
  hasReservedVacancy,
} from "../../src/control/evolution";
import { deriveTakenSet } from "../../src/control/taken";

function createMineJob(targetId: string): Job {
  return {
    id: makeJobId("mine", targetId),
    type: "mine",
    targetId,
    pos: { x: 0, y: 0, roomName: "sim" },
    tier: "high",
    withinTierPriority: 0,
    maxWorkers: 1,
    assignmentMode: "reserved",
    lifetimeClass: "persistent",
    requirements: { body: ["work", "work", "carry", "move"], ttlFloor: 0 },
  };
}

function createPulledJob(
  type: "fill" | "build" | "upgrade",
  targetId: string,
): Job {
  return {
    id: makeJobId(type, targetId),
    type,
    targetId,
    pos: { x: 0, y: 0, roomName: "sim" },
    tier: "critical",
    withinTierPriority: 0,
    maxWorkers: 6,
    assignmentMode: "pulled",
    lifetimeClass: "transient",
    requirements: { body: ["work", "carry", "move"], ttlFloor: 200 },
  };
}

describe("hasReservedVacancy — I/O Matrix", () => {
  it("returns true when a mine Job is vacant (untaken)", () => {
    const jobs = [createMineJob("S1")];
    const takenSet = deriveTakenSet([]);

    expect(hasReservedVacancy(jobs, takenSet)).toBe(true);
  });

  it("returns false when the mine Job is already taken", () => {
    const mineJob = createMineJob("S1");
    const jobs = [mineJob];
    const takenSet = deriveTakenSet([{ jobId: mineJob.id }]);

    expect(hasReservedVacancy(jobs, takenSet)).toBe(false);
  });

  it("returns false when no mine Jobs exist", () => {
    const jobs = [createPulledJob("fill", "s1")];
    const takenSet = deriveTakenSet([]);

    expect(hasReservedVacancy(jobs, takenSet)).toBe(false);
  });

  it("returns true when multiple mine Jobs exist and at least one is vacant", () => {
    const mineJob1 = createMineJob("S1");
    const mineJob2 = createMineJob("S2");
    const jobs = [mineJob1, mineJob2];
    const takenSet = deriveTakenSet([{ jobId: mineJob1.id }]);

    expect(hasReservedVacancy(jobs, takenSet)).toBe(true);
  });
});

describe("hasDemandPressure — I/O Matrix", () => {
  it("returns true when Specialist era and a Pulled Job is vacant", () => {
    const jobs = [createPulledJob("fill", "s1")];
    const takenSet = deriveTakenSet([]);

    expect(hasDemandPressure(jobs, takenSet, "specialist")).toBe(true);
  });

  it("returns false when Generalist era (regardless of Pulled Job vacancy)", () => {
    const jobs = [createPulledJob("fill", "s1")];
    const takenSet = deriveTakenSet([]);

    expect(hasDemandPressure(jobs, takenSet, "generalist")).toBe(false);
  });

  it("returns false when Specialist era but no Pulled Jobs have capacity", () => {
    const fillJob = createPulledJob("fill", "s1");
    const jobs = [fillJob];
    const takenSet = deriveTakenSet([
      { jobId: fillJob.id },
      { jobId: fillJob.id },
      { jobId: fillJob.id },
      { jobId: fillJob.id },
      { jobId: fillJob.id },
      { jobId: fillJob.id },
    ]);

    expect(hasDemandPressure(jobs, takenSet, "specialist")).toBe(false);
  });

  it("returns true when Specialist era and any Pulled Job has capacity (fill, build, or upgrade)", () => {
    const buildJob = createPulledJob("build", "cs1");
    const jobs = [buildJob];
    const takenSet = deriveTakenSet([]);

    expect(hasDemandPressure(jobs, takenSet, "specialist")).toBe(true);
  });

  it("returns false when Specialist era but only Reserved Jobs exist", () => {
    const mineJob = createMineJob("S1");
    const jobs = [mineJob];
    const takenSet = deriveTakenSet([]);

    expect(hasDemandPressure(jobs, takenSet, "specialist")).toBe(false);
  });
});

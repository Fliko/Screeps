import { describe, expect, it } from "vitest";
import { isContractValid } from "../../src/agents/validators";
import type { Job, JobType } from "../../src/board/job";
import { makeJob } from "../../src/board/job";
import { NODE_BY_TYPE } from "../helpers/node-fixtures";

const NON_MINE_TYPES: readonly Exclude<JobType, "mine">[] = [
  "fill",
  "build",
  "upgrade",
];

function job(type: JobType, ttlFloor: number): Job {
  return makeJob({
    type,
    node: NODE_BY_TYPE[type],
    targetId: "target1",
    pos: { x: 1, y: 1, roomName: "sim" },
    tier: "critical",
    withinTierPriority: 0,
    maxWorkers: 1,
    assignmentMode: "pulled",
    lifetimeClass: "transient",
    requirements: { body: ["work", "carry", "move"], ttlFloor },
  });
}

describe("isContractValid", () => {
  describe("mine exemption (FR-9)", () => {
    it("is valid with no Job on the Board", () => {
      expect(isContractValid("mine", undefined, 1500, false)).toBe(true);
    });

    it("is valid even when ttl is far below any floor", () => {
      expect(isContractValid("mine", undefined, 1, false)).toBe(true);
      expect(isContractValid("mine", job("mine", 200), 1, false)).toBe(true);
      expect(isContractValid("mine", job("mine", 200), 0, false)).toBe(true);
    });
  });

  for (const type of NON_MINE_TYPES) {
    describe(`${type} Contracts`, () => {
      it("is invalid when the Job is absent from the Board", () => {
        expect(isContractValid(type, undefined, 1500, false)).toBe(false);
      });

      it("is invalid when ttl is below the Job's ttlFloor", () => {
        expect(isContractValid(type, job(type, 200), 199, false)).toBe(false);
        expect(isContractValid(type, job(type, 200), 1, false)).toBe(false);
      });

      it("is valid when ttl equals the Job's ttlFloor", () => {
        expect(isContractValid(type, job(type, 200), 200, false)).toBe(true);
      });

      it("is valid when ttl exceeds the Job's ttlFloor", () => {
        expect(isContractValid(type, job(type, 200), 1500, false)).toBe(true);
      });

      it("is valid while the Creep is spawning, whatever its ttl (FR-16, FR-29)", () => {
        expect(isContractValid(type, job(type, 200), 0, true)).toBe(true);
        expect(isContractValid(type, job(type, 200), 1, true)).toBe(true);
      });

      it("is invalid at ttl 0 when the Creep is NOT spawning — it is dying", () => {
        expect(isContractValid(type, job(type, 200), 0, false)).toBe(false);
      });

      it("is invalid when the Job is absent even while spawning", () => {
        expect(isContractValid(type, undefined, 0, true)).toBe(false);
      });

      it("is valid at a ttlFloor of 0", () => {
        expect(isContractValid(type, job(type, 0), 0, false)).toBe(true);
        expect(isContractValid(type, job(type, 0), 1, false)).toBe(true);
      });
    });
  }
});

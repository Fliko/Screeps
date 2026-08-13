import { describe, expect, it } from "vitest";
import type { Job } from "../../src/board/job";
import type { Board } from "../../src/board/registry";
import { formatBoardLog } from "../../src/control/generate";

describe("formatBoardLog", () => {
  it("reports 0 jobs for undefined board", () => {
    expect(formatBoardLog(undefined)).toBe("[board] 0 jobs");
  });

  it("reports 0 jobs for empty board", () => {
    const board: Board = { jobs: [] };
    expect(formatBoardLog(board)).toBe("[board] 0 jobs");
  });

  it("lists each job id with tier", () => {
    const jobs: Job[] = [
      {
        id: "fill:ext1",
        type: "fill",
        targetId: "ext1",
        pos: { x: 1, y: 1, roomName: "sim" },
        tier: "critical",
        withinTierPriority: 0,
        maxWorkers: 1,
        assignmentMode: "pulled",
        lifetimeClass: "transient",
        requirements: { body: ["work", "carry", "move"], ttlFloor: 200 },
      },
      {
        id: "build:site1",
        type: "build",
        targetId: "site1",
        pos: { x: 2, y: 2, roomName: "sim" },
        tier: "medium",
        withinTierPriority: 0,
        maxWorkers: 1,
        assignmentMode: "pulled",
        lifetimeClass: "transient",
        requirements: { body: ["work", "carry", "move"], ttlFloor: 200 },
      },
    ];
    const board: Board = { jobs };
    expect(formatBoardLog(board)).toBe(
      "[board] 2 jobs: fill:ext1(critical) build:site1(medium)",
    );
  });
});

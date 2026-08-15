import { describe, expect, it } from "vitest";
import { getConstant } from "../../../src/config";
import { produceMine } from "../../../src/world/producers/mine";
import type {
  SnapshotSource,
  WorldSnapshot,
} from "../../../src/world/snapshot";

function source(id: string, x = 10, y = 10): SnapshotSource {
  return {
    id,
    pos: { x, y, roomName: "sim" },
    energy: 0,
    energyCapacity: 3000,
  };
}

function snapshot(
  sources: SnapshotSource[] = [],
  era: "generalist" | "specialist" = "generalist",
): WorldSnapshot {
  return {
    roomName: "sim",
    tick: 0,
    energyAvailable: 0,
    era,
    structures: [],
    constructionSites: [],
    sources,
    creeps: [],
  };
}

describe("produceMine", () => {
  it("returns empty array when era is generalist", () => {
    const jobs = produceMine(snapshot([source("src1")], "generalist"));
    expect(jobs).toHaveLength(0);
  });

  it("returns empty array when era is generalist with multiple sources", () => {
    const jobs = produceMine(
      snapshot([source("src1"), source("src2"), source("src3")], "generalist"),
    );
    expect(jobs).toHaveLength(0);
  });

  it("emits one mine Job per source when era is specialist", () => {
    const jobs = produceMine(
      snapshot([source("src1"), source("src2")], "specialist"),
    );
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.id)).toEqual(["mine:src1", "mine:src2"]);
    expect(jobs[0].type).toBe("mine");
    expect(jobs[0].tier).toBe("high");
    expect(jobs[0].maxWorkers).toBe(1);
    expect(jobs[0].assignmentMode).toBe("reserved");
    expect(jobs[0].lifetimeClass).toBe("persistent");
  });

  it("uses the mine policy from JOB_POLICY_TABLE for job fields", () => {
    const jobs = produceMine(snapshot([source("src1")], "specialist"));
    const policy = getConstant("JOB_POLICY_TABLE").mine;
    expect(jobs[0].tier).toBe(policy.tier);
    expect(jobs[0].withinTierPriority).toBe(policy.withinTierPriority);
    expect(jobs[0].maxWorkers).toBe(policy.maxWorkers);
    expect(jobs[0].assignmentMode).toBe(policy.assignmentMode);
    expect(jobs[0].lifetimeClass).toBe(policy.lifetimeClass);
    expect(jobs[0].requirements).toEqual(policy.requirements);
  });

  it("returns empty array when era is specialist but no sources", () => {
    expect(produceMine(snapshot([], "specialist"))).toHaveLength(0);
  });

  it("preserves source positions in the mine jobs", () => {
    const sources = [source("src1", 5, 5), source("src2", 15, 20)];
    const jobs = produceMine(snapshot(sources, "specialist"));
    expect(jobs[0].pos).toEqual({ x: 5, y: 5, roomName: "sim" });
    expect(jobs[1].pos).toEqual({ x: 15, y: 20, roomName: "sim" });
  });

  it("returns a fresh array each call — no accumulation", () => {
    const a = produceMine(snapshot([source("src1")], "specialist"));
    const b = produceMine(snapshot([], "specialist"));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);
  });
});

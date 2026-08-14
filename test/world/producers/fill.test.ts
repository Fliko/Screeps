import { beforeEach, describe, expect, it } from "vitest";
import { getConstant } from "../../../src/config";
import { produceFill } from "../../../src/world/producers/fill";
import type {
  SnapshotStructure,
  WorldSnapshot,
} from "../../../src/world/snapshot";

function structure(
  id: string,
  structureType: StructureConstant,
  energy: number,
  energyCapacity = 50,
): SnapshotStructure {
  return {
    id,
    pos: { x: 1, y: 1, roomName: "sim" },
    structureType,
    energy,
    energyCapacity,
  };
}

function snapshot(structures: SnapshotStructure[] = []): WorldSnapshot {
  return {
    roomName: "sim",
    tick: 0,
    structures,
    constructionSites: [],
    sources: [],
    creeps: [],
  };
}

describe("produceFill", () => {
  beforeEach(() => {
    // policy table default values are read from config at call time
  });

  it("emits one fill Job for an unfilled Extension", () => {
    const jobs = produceFill(
      snapshot([structure("ext1", "extension", 25, 50)]),
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe("fill:ext1");
    expect(jobs[0].type).toBe("fill");
    expect(jobs[0].tier).toBe("critical");
    expect(jobs[0].maxWorkers).toBe(
      getConstant("JOB_POLICY_TABLE").fill.maxWorkers,
    );
    expect(jobs[0].assignmentMode).toBe("pulled");
    expect(jobs[0].lifetimeClass).toBe("transient");
  });

  it("emits one fill Job per unfilled structure — one per object, never aggregates", () => {
    const jobs = produceFill(
      snapshot([
        structure("ext1", "extension", 10, 50),
        structure("ext2", "extension", 0, 50),
        structure("spawn1", "spawn", 100, 300),
      ]),
    );
    expect(jobs).toHaveLength(3);
    expect(jobs.map((j) => j.id)).toEqual([
      "fill:ext1",
      "fill:ext2",
      "fill:spawn1",
    ]);
  });

  it("skips full structures", () => {
    const jobs = produceFill(
      snapshot([structure("ext1", "extension", 50, 50)]),
    );
    expect(jobs).toHaveLength(0);
  });

  it("skips non-fill structure types (Container)", () => {
    const jobs = produceFill(
      snapshot([structure("cont1", "container", 10, 2000)]),
    );
    expect(jobs).toHaveLength(0);
  });

  it("returns empty when nothing is unfilled", () => {
    expect(produceFill(snapshot([]))).toHaveLength(0);
  });
});

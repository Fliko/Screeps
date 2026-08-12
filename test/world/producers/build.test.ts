import { describe, expect, it } from "vitest";
import { produceBuild } from "../../../src/world/producers/build";
import type {
  SnapshotConstructionSite,
  WorldSnapshot,
} from "../../../src/world/snapshot";

function site(id: string): SnapshotConstructionSite {
  return {
    id,
    pos: { x: 5, y: 5, roomName: "sim" },
    structureType: "extension",
    progress: 10,
    progressTotal: 100,
  };
}

function snapshot(sites: SnapshotConstructionSite[] = []): WorldSnapshot {
  return {
    roomName: "sim",
    constructionSites: sites,
    structures: [],
    creeps: [],
  };
}

describe("produceBuild", () => {
  it("emits one build Job per construction site", () => {
    const jobs = produceBuild(snapshot([site("site1"), site("site2")]));
    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => j.id)).toEqual(["build:site1", "build:site2"]);
    expect(jobs[0].type).toBe("build");
    expect(jobs[0].tier).toBe("medium");
    expect(jobs[0].maxWorkers).toBe(1);
    expect(jobs[0].assignmentMode).toBe("pulled");
    expect(jobs[0].lifetimeClass).toBe("transient");
  });

  it("emits nothing when there are no construction sites", () => {
    expect(produceBuild(snapshot([]))).toHaveLength(0);
  });

  it("returns a fresh array each call — no accumulation", () => {
    const a = produceBuild(snapshot([site("site1")]));
    const b = produceBuild(snapshot([]));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(0);
  });
});

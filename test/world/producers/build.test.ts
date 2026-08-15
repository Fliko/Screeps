import { describe, expect, it } from "vitest";
import { produceBuild } from "../../../src/world/producers/build";
import type {
  SnapshotConstructionSite,
  WorldSnapshot,
} from "../../../src/world/snapshot";

function site(
  id: string,
  structureType: BuildableStructureConstant = "extension",
): SnapshotConstructionSite {
  return {
    id,
    pos: { x: 5, y: 5, roomName: "sim" },
    structureType,
    progress: 10,
    progressTotal: 100,
  };
}

function snapshot(sites: SnapshotConstructionSite[] = []): WorldSnapshot {
  return {
    roomName: "sim",
    tick: 0,
    energyAvailable: 0,
    era: "generalist",
    constructionSites: sites,
    structures: [],
    sources: [],
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

  it("assigns Container sites a higher withinTierPriority than other structures", () => {
    const containerSite = site("container1", "container");
    const extensionSite = site("ext1", "extension");
    const jobs = produceBuild(snapshot([containerSite, extensionSite]));

    const containerJob = jobs.find((j) => j.targetId === "container1");
    const extensionJob = jobs.find((j) => j.targetId === "ext1");

    expect(containerJob).toBeDefined();
    expect(extensionJob).toBeDefined();
    expect(containerJob?.withinTierPriority).toBeGreaterThan(
      extensionJob?.withinTierPriority ?? 0,
    );
    expect(containerJob?.tier).toBe("medium");
    expect(extensionJob?.tier).toBe("medium");
  });

  it("assigns non-Container sites the default priority", () => {
    const rampartSite = site("rampart1", "rampart");
    const extensionSite = site("ext1", "extension");
    const jobs = produceBuild(snapshot([rampartSite, extensionSite]));

    const rampartJob = jobs.find((j) => j.targetId === "rampart1");
    const extensionJobFromDefault = jobs.find((j) => j.targetId === "ext1");

    expect(rampartJob?.withinTierPriority).toBe(0);
    expect(extensionJobFromDefault?.withinTierPriority).toBe(0);
  });

  it("keeps Container sites in the medium tier", () => {
    const containerSite = site("container1", "container");
    const jobs = produceBuild(snapshot([containerSite]));
    expect(jobs).toHaveLength(1);

    const containerJob = jobs[0];
    expect(containerJob?.tier).toBe("medium");
  });
});

import { describe, expect, it } from "vitest";
import { produceUpgrade } from "../../../src/world/producers/upgrade";
import type {
  SnapshotController,
  WorldSnapshot,
} from "../../../src/world/snapshot";

function controller(id = "controller1"): SnapshotController {
  return {
    id,
    pos: { x: 10, y: 10, roomName: "sim" },
    level: 1,
    progress: 0,
    progressTotal: 200,
  };
}

function snapshotWithController(c?: SnapshotController): WorldSnapshot {
  return {
    roomName: "sim",
    tick: 0,
    energyAvailable: 0,
    era: "generalist",
    controller: c,
    structures: [],
    constructionSites: [],
    sources: [],
    creeps: [],
  };
}

describe("produceUpgrade", () => {
  it("always posts the upgrade Job when a Controller exists", () => {
    const jobs = produceUpgrade(snapshotWithController(controller()));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe("upgrade:upgrade:controller1");
    expect(jobs[0].type).toBe("upgrade");
    expect(jobs[0].node).toBe("upgrade");
    expect(jobs[0].tier).toBe("low");
    expect(jobs[0].maxWorkers).toBe(Infinity);
    expect(jobs[0].assignmentMode).toBe("pulled");
    expect(jobs[0].lifetimeClass).toBe("persistent");
  });

  it("emits nothing when there is no Controller", () => {
    expect(produceUpgrade(snapshotWithController(undefined))).toHaveLength(0);
  });
});

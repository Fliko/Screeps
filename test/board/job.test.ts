import { describe, expect, it } from "vitest";
import {
  type Job,
  type JobId,
  type JobInput,
  type JobRequirements,
  type JobType,
  makeJob,
  makeJobId,
  parseJobId,
} from "../../src/board/job";
import { NODE_BY_TYPE } from "../helpers/node-fixtures";

describe("makeJobId", () => {
  it.each(["mine", "fill", "build", "upgrade"] as JobType[])(
    "produces type:node:targetId grammar for %s",
    (type) => {
      const node = NODE_BY_TYPE[type];
      const id = makeJobId(type, node, "target123");
      expect(id).toBe(`${type}:${node}:target123`);
    },
  );

  it("splits targetId that contains colons on the first two colons only in parseJobId", () => {
    const id = makeJobId("fill", "spawns", "spawn:123");
    const parsed = parseJobId(id);
    expect(parsed.type).toBe("fill");
    expect(parsed.node).toBe("spawns");
    expect(parsed.targetId).toBe("spawn:123");
  });
});

describe("parseJobId", () => {
  it.each(["mine", "fill", "build", "upgrade"] as JobType[])(
    "round-trips makeJobId for %s",
    (type) => {
      const node = NODE_BY_TYPE[type];
      const targetId = `${type}-target-abc`;
      const id: JobId = makeJobId(type, node, targetId);
      const parsed = parseJobId(id);
      expect(parsed.type).toBe(type);
      expect(parsed.node).toBe(node);
      expect(parsed.targetId).toBe(targetId);
    },
  );

  it("returns { type, node, targetId } exactly (round-trip)", () => {
    const id = makeJobId("mine", "mines", "S1");
    expect(parseJobId(id)).toEqual({
      type: "mine",
      node: "mines",
      targetId: "S1",
    });
  });

  it("throws on malformed id with no colon", () => {
    expect(() => parseJobId("invalidJobId" as JobId)).toThrow(
      /type:node:targetId/,
    );
  });

  it("throws on malformed id with only one colon (fewer than 2 colons)", () => {
    expect(() => parseJobId("mine:mines" as JobId)).toThrow(
      /type:node:targetId/,
    );
  });

  it("splits on the first two colons only, in order", () => {
    const parsed = parseJobId(
      makeJobId("mine", "mines", "source:pos:extra") as JobId,
    );
    expect(parsed.type).toBe("mine");
    expect(parsed.node).toBe("mines");
    expect(parsed.targetId).toBe("source:pos:extra");
  });

  it("throws on unknown Job type", () => {
    expect(() => parseJobId("bogus:mines:123" as JobId)).toThrow(
      /unknown Job type "bogus"/,
    );
  });

  it("throws on unknown Node", () => {
    expect(() => parseJobId("mine:bogus:123" as JobId)).toThrow(
      /unknown Node "bogus"/,
    );
  });

  it("throws on a Node that is individually valid but not legal for the parsed type", () => {
    expect(() => parseJobId("upgrade:mines:123" as JobId)).toThrow(
      /node "mines" invalid for type "upgrade"/,
    );
  });

  it("throws on empty type (leading colon)", () => {
    expect(() => parseJobId(":mines:foo" as JobId)).toThrow(
      /unknown Job type ""/,
    );
  });

  it("throws on empty targetId (trailing colon)", () => {
    expect(() => parseJobId("mine:mines:" as JobId)).toThrow(/empty targetId/);
  });
});

describe("makeJob", () => {
  const pos = { x: 5, y: 10, roomName: "W5N5" };
  const requirements: JobRequirements = {
    body: ["work", "carry", "move"] as BodyPartConstant[],
    ttlFloor: 100,
  };

  function fullInput(overrides: Partial<JobInput> = {}): JobInput {
    const base: JobInput = {
      type: "fill",
      node: "spawns",
      targetId: "struct1",
      pos,
      tier: "critical",
      withinTierPriority: 0,
      maxWorkers: 1,
      assignmentMode: "pulled",
      lifetimeClass: "transient",
      requirements,
    };
    return { ...base, ...overrides };
  }

  it("computes id from type, node, and targetId via makeJobId", () => {
    const job = makeJob(
      fullInput({ type: "build", node: "build", targetId: "site7" }),
    );
    expect(job.id).toBe("build:build:site7");
  });

  it("preserves all input fields", () => {
    const job = makeJob(
      fullInput({ type: "mine", node: "mines", targetId: "source1" }),
    );
    expect(job.type).toBe("mine");
    expect(job.node).toBe("mines");
    expect(job.targetId).toBe("source1");
    expect(job.pos).toEqual(pos);
    expect(job.tier).toBe("critical");
    expect(job.withinTierPriority).toBe(0);
    expect(job.maxWorkers).toBe(1);
    expect(job.assignmentMode).toBe("pulled");
    expect(job.lifetimeClass).toBe("transient");
    expect(job.requirements).toEqual(requirements);
  });

  it("produces a Job with every field in the schema (AC1)", () => {
    const job = makeJob(fullInput());
    // Every required field must be present and defined
    const requiredKeys: (keyof Job)[] = [
      "id",
      "type",
      "node",
      "targetId",
      "pos",
      "tier",
      "withinTierPriority",
      "maxWorkers",
      "assignmentMode",
      "lifetimeClass",
      "requirements",
    ];
    for (const key of requiredKeys) {
      expect(job[key]).toBeDefined();
    }
    // requirements sub-object
    expect(job.requirements.body).toBeDefined();
    expect(job.requirements.ttlFloor).toBeDefined();
  });
});

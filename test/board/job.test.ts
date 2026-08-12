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

describe("makeJobId", () => {
  it.each(["mine", "fill", "build", "upgrade"] as JobType[])(
    "produces type:targetId grammar for %s",
    (type) => {
      const id = makeJobId(type, "target123");
      expect(id).toBe(`${type}:target123`);
    },
  );

  it("splits targetId that contains colons on the first colon only in parseJobId", () => {
    const id = makeJobId("fill", "spawn:123");
    const parsed = parseJobId(id);
    expect(parsed.type).toBe("fill");
    expect(parsed.targetId).toBe("spawn:123");
  });
});

describe("parseJobId", () => {
  it.each(["mine", "fill", "build", "upgrade"] as JobType[])(
    "round-trips makeJobId for %s",
    (type) => {
      const targetId = `${type}-target-abc`;
      const id: JobId = makeJobId(type, targetId);
      const parsed = parseJobId(id);
      expect(parsed.type).toBe(type);
      expect(parsed.targetId).toBe(targetId);
    },
  );

  it("throws on malformed id with no colon", () => {
    expect(() => parseJobId("invalidJobId" as JobId)).toThrow(/type:targetId/);
  });

  it("splits on first colon only", () => {
    const parsed = parseJobId(makeJobId("mine", "source:pos:extra") as JobId);
    expect(parsed.type).toBe("mine");
    expect(parsed.targetId).toBe("source:pos:extra");
  });

  it("throws on unknown Job type", () => {
    expect(() => parseJobId("bogus:123" as JobId)).toThrow(
      /unknown Job type "bogus"/,
    );
  });

  it("throws on empty type (leading colon)", () => {
    expect(() => parseJobId(":foo" as JobId)).toThrow(/unknown Job type ""/);
  });

  it("throws on empty targetId (trailing colon)", () => {
    expect(() => parseJobId("mine:" as JobId)).toThrow(/empty targetId/);
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

  it("computes id from type and targetId via makeJobId", () => {
    const job = makeJob(fullInput({ type: "build", targetId: "site7" }));
    expect(job.id).toBe("build:site7");
  });

  it("preserves all input fields", () => {
    const job = makeJob(fullInput({ type: "mine", targetId: "source1" }));
    expect(job.type).toBe("mine");
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

import { describe, expect, it } from "vitest";
import {
  deriveSourceStrategy,
  deriveSourcingPhase,
} from "../../src/agents/sourcing";
import { getConstant } from "../../src/config";

describe("deriveSourcingPhase", () => {
  it("derives 'source' when carry is empty (carry: 0)", () => {
    expect(deriveSourcingPhase(0)).toBe("source");
  });

  it("derives 'serve' for a partially-loaded Creep (carry: 45) -- pins the anti-ping-pong predicate", () => {
    expect(deriveSourcingPhase(45)).toBe("serve");
  });

  it("derives 'serve' when carry is full (carry: 50)", () => {
    expect(deriveSourcingPhase(50)).toBe("serve");
  });

  it("derives 'serve' at the minimum nonzero carry (carry: 1)", () => {
    expect(deriveSourcingPhase(1)).toBe("serve");
  });
});

describe("deriveSourceStrategy", () => {
  it("derives 'withdraw' for a Collector body (exact multiset match)", () => {
    const collectorParts = getConstant("BODY_COMPOSITIONS").collector.parts;
    // Test exact match
    expect(deriveSourceStrategy(collectorParts)).toBe("withdraw");
  });

  it("derives 'withdraw' for a Collector body in different order", () => {
    // The Collector body is ["work", "carry", "carry", "move"]
    // Test with parts in different order
    const reorderedCollector: BodyPartConstant[] = [
      "move",
      "carry",
      "work",
      "carry",
    ];
    expect(deriveSourceStrategy(reorderedCollector)).toBe("withdraw");
  });

  it("derives 'harvest' for a Generalist body", () => {
    const generalistParts = getConstant("BODY_COMPOSITIONS").generalist.parts;
    expect(deriveSourceStrategy(generalistParts)).toBe("harvest");
  });

  it("derives 'harvest' for a Harvester body", () => {
    const harvesterParts = getConstant("BODY_COMPOSITIONS").harvester.parts;
    expect(deriveSourceStrategy(harvesterParts)).toBe("harvest");
  });

  it("derives 'harvest' when body has different length than Collector", () => {
    const oddBody: BodyPartConstant[] = ["work", "carry", "move"];
    expect(deriveSourceStrategy(oddBody)).toBe("harvest");
  });

  it("derives 'harvest' when body has same length but different parts", () => {
    // Different multiset: has 3 carry instead of 2, and no work
    const differentBody: BodyPartConstant[] = [
      "move",
      "carry",
      "carry",
      "carry",
    ];
    expect(deriveSourceStrategy(differentBody)).toBe("harvest");
  });

  it("derives 'harvest' for an empty body", () => {
    expect(deriveSourceStrategy([])).toBe("harvest");
  });
});

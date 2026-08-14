import { describe, expect, it } from "vitest";
import { deriveSourcingPhase } from "../../src/agents/sourcing";

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

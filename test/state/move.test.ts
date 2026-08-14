import { describe, expect, it } from "vitest";
import type { MoveState } from "../../src/state/move";
import { getMoveState, setMoveState } from "../../src/state/move";

describe("getMoveState", () => {
  it("returns undefined when memory.move is missing", () => {
    const creep = { memory: {} };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns the MoveState when memory.move exists", () => {
    const moveState: MoveState = { lastPos: 42, stuck: 2 };
    const creep = { memory: { move: moveState } };
    expect(getMoveState(creep)).toEqual(moveState);
  });
});

describe("setMoveState", () => {
  it("writes the MoveState to memory.move", () => {
    const creep: { memory: { move?: MoveState } } = { memory: {} };
    const moveState: MoveState = { lastPos: 100, stuck: 1 };
    setMoveState(creep, moveState);
    expect(creep.memory.move).toEqual(moveState);
  });

  it("round-trips through getMoveState", () => {
    const creep: { memory: { move?: MoveState } } = { memory: {} };
    const original: MoveState = { lastPos: 25, stuck: 3 };
    setMoveState(creep, original);
    expect(getMoveState(creep)).toEqual(original);
  });

  it("overwrites an existing MoveState", () => {
    const creep: { memory: { move?: MoveState } } = {
      memory: { move: { lastPos: 10, stuck: 1 } },
    };
    const updated: MoveState = { lastPos: 20, stuck: 2 };
    setMoveState(creep, updated);
    expect(creep.memory.move).toEqual(updated);
  });
});

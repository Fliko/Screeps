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

  it("returns the MoveState when lastPos is 0 (falsy but valid packed position)", () => {
    const moveState: MoveState = { lastPos: 0, stuck: 0 };
    const creep = { memory: { move: moveState } };
    expect(getMoveState(creep)).toEqual(moveState);
  });

  it("returns undefined when lastPos is NaN", () => {
    const creep = { memory: { move: { lastPos: NaN, stuck: 2 } as MoveState } };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns undefined when lastPos is Infinity", () => {
    const creep = {
      memory: { move: { lastPos: Infinity, stuck: 0 } as MoveState },
    };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns the MoveState when lastPos is 2499 (max valid packed position)", () => {
    const moveState: MoveState = { lastPos: 2499, stuck: 0 };
    const creep = { memory: { move: moveState } };
    expect(getMoveState(creep)).toEqual(moveState);
  });

  it("returns undefined when lastPos is 2500 (out of range)", () => {
    const creep = {
      memory: { move: { lastPos: 2500, stuck: 0 } as MoveState },
    };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns undefined when lastPos is -1 (out of range)", () => {
    const creep = { memory: { move: { lastPos: -1, stuck: 0 } as MoveState } };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns undefined when lastPos is non-integer", () => {
    const creep = {
      memory: { move: { lastPos: 12.5, stuck: 0 } as MoveState },
    };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns undefined when stuck is NaN", () => {
    const creep = { memory: { move: { lastPos: 0, stuck: NaN } as MoveState } };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns undefined when stuck is Infinity", () => {
    const creep = {
      memory: { move: { lastPos: 0, stuck: Infinity } as MoveState },
    };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns undefined when stuck is negative", () => {
    const creep = {
      memory: { move: { lastPos: 0, stuck: -1 } as MoveState },
    };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns undefined when stuck is non-integer", () => {
    const creep = {
      memory: { move: { lastPos: 0, stuck: 2.5 } as MoveState },
    };
    expect(getMoveState(creep)).toBeUndefined();
  });

  it("returns the MoveState when stuck is 0", () => {
    const moveState: MoveState = { lastPos: 0, stuck: 0 };
    const creep = { memory: { move: moveState } };
    expect(getMoveState(creep)).toEqual(moveState);
  });

  it("returns the MoveState when stuck is a large valid integer", () => {
    const moveState: MoveState = { lastPos: 0, stuck: 100 };
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

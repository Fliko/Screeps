import { afterEach, describe, expect, it, vi } from "vitest";
import { moveCreep } from "../../src/agents/movement";
import { setConstant } from "../../src/config";
import type { MoveState } from "../../src/state/move";

/**
 * Mock creep factory. Creates a minimal live-object stand-in with pos, fatigue,
 * memory, and a spy on moveTo (same pattern as test/world/creeps.test.ts).
 */
function createMockCreep(
  options: {
    x?: number;
    y?: number;
    fatigue?: number;
    moveState?: MoveState;
    moveResult?: ScreepsReturnCode;
  } = {},
): Creep {
  const { x = 25, y = 25, fatigue = 0, moveState, moveResult = 0 } = options;

  const creep = {
    pos: { x, y, roomName: "sim" },
    fatigue,
    memory: moveState ? { move: moveState } : {},
    moveTo: vi.fn(() => moveResult),
  } as unknown as Creep;

  return creep;
}

/**
 * Reset config constants to their defaults.
 */
afterEach(() => {
  setConstant("MOVEMENT_STUCK_THRESHOLD", 3);
  setConstant("MOVEMENT_DEFAULT_OPTS", {
    reusePath: 5,
    ignoreCreeps: false,
  });
  setConstant("MOVEMENT_REPATH_OPTS", {
    reusePath: 5,
    ignoreCreeps: true,
  });
});

describe("moveCreep", () => {
  it("initializes stuck to 0 when memory.move is missing (first call)", () => {
    const creep = createMockCreep();
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    moveCreep(creep, target);

    expect(creep.memory.move).toEqual({
      lastPos: expect.any(Number),
      stuck: 0,
    });
  });

  it("increments stuck when position is unchanged and fatigue === 0 (AC2, AC3)", () => {
    const creep = createMockCreep({
      x: 25,
      y: 25,
      fatigue: 0,
      moveState: { lastPos: 25 * 50 + 25, stuck: 0 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    moveCreep(creep, target);

    expect(creep.memory.move?.stuck).toBe(1);
  });

  it("does not advance stuck when fatigue > 0, even with unchanged position (AC3)", () => {
    const creep = createMockCreep({
      x: 25,
      y: 25,
      fatigue: 5,
      moveState: { lastPos: 25 * 50 + 25, stuck: 2 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    moveCreep(creep, target);

    // Stuck should NOT advance while fatigued.
    expect(creep.memory.move?.stuck).toBe(2);
  });

  it("resets stuck to 0 when position changes (AC2)", () => {
    const creep = createMockCreep({
      x: 26,
      y: 25,
      fatigue: 0,
      moveState: { lastPos: 25 * 50 + 25, stuck: 2 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    moveCreep(creep, target);

    expect(creep.memory.move?.stuck).toBe(0);
  });

  it("uses default opts when stuck is below threshold (AC2, AC5)", () => {
    const creep = createMockCreep({
      x: 25,
      y: 25,
      fatigue: 0,
      moveState: { lastPos: 25 * 50 + 25, stuck: 1 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    moveCreep(creep, target);

    const moveSpy = creep.moveTo as ReturnType<typeof vi.fn>;
    expect(moveSpy).toHaveBeenCalledWith(target, {
      reusePath: 5,
      ignoreCreeps: false,
    });
  });

  it("escalates to repath opts when stuck reaches threshold (AC2)", () => {
    setConstant("MOVEMENT_STUCK_THRESHOLD", 3);
    const creep = createMockCreep({
      x: 25,
      y: 25,
      fatigue: 0,
      moveState: { lastPos: 25 * 50 + 25, stuck: 3 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    moveCreep(creep, target);

    const moveSpy = creep.moveTo as ReturnType<typeof vi.fn>;
    expect(moveSpy).toHaveBeenCalledWith(target, {
      reusePath: 5,
      ignoreCreeps: true,
    });
  });

  it("resets stuck to 0 after escalation (so next call uses default opts)", () => {
    setConstant("MOVEMENT_STUCK_THRESHOLD", 3);
    const creep = createMockCreep({
      x: 25,
      y: 25,
      fatigue: 0,
      moveState: { lastPos: 25 * 50 + 25, stuck: 3 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    moveCreep(creep, target);

    // After escalation, stuck should be reset to 0.
    expect(creep.memory.move?.stuck).toBe(0);
  });

  it("uses provided opts override when stuck is below threshold", () => {
    const creep = createMockCreep({
      x: 25,
      y: 25,
      fatigue: 0,
      moveState: { lastPos: 25 * 50 + 25, stuck: 0 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;
    const customOpts: MoveToOpts = { reusePath: 0, ignoreCreeps: false };

    moveCreep(creep, target, customOpts);

    const moveSpy = creep.moveTo as ReturnType<typeof vi.fn>;
    expect(moveSpy).toHaveBeenCalledWith(target, customOpts);
  });

  it("ignores provided opts when escalation is triggered (repath takes precedence)", () => {
    setConstant("MOVEMENT_STUCK_THRESHOLD", 2);
    const creep = createMockCreep({
      x: 25,
      y: 25,
      fatigue: 0,
      moveState: { lastPos: 25 * 50 + 25, stuck: 2 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;
    const customOpts: MoveToOpts = { reusePath: 0, ignoreCreeps: false };

    moveCreep(creep, target, customOpts);

    const moveSpy = creep.moveTo as ReturnType<typeof vi.fn>;
    // Should use repath opts, not the custom opts.
    expect(moveSpy).toHaveBeenCalledWith(target, {
      reusePath: 5,
      ignoreCreeps: true,
    });
  });

  it("persists lastPos as the current packed position before returning", () => {
    const creep = createMockCreep({
      x: 10,
      y: 15,
      fatigue: 0,
      moveState: { lastPos: 0, stuck: 0 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    moveCreep(creep, target);

    const expectedPacked = 15 * 50 + 10;
    expect(creep.memory.move?.lastPos).toBe(expectedPacked);
  });

  it("returns moveTo result unchanged", () => {
    // ERR_NO_PATH = -2
    const creep = createMockCreep({ moveResult: -2 });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    const result = moveCreep(creep, target);

    expect(result).toBe(-2);
  });

  it("handles successive calls with stuck incrementing each tick", () => {
    const creep = createMockCreep({
      x: 25,
      y: 25,
      fatigue: 0,
      moveState: { lastPos: 25 * 50 + 25, stuck: 0 },
    });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;

    // First call: increment stuck from 0 to 1.
    moveCreep(creep, target);
    expect(creep.memory.move?.stuck).toBe(1);

    // Second call (still at same position): increment stuck from 1 to 2.
    moveCreep(creep, target);
    expect(creep.memory.move?.stuck).toBe(2);

    // Third call (still at same position): increment stuck from 2 to 3, trigger escalation.
    setConstant("MOVEMENT_STUCK_THRESHOLD", 3);
    moveCreep(creep, target);
    expect(creep.memory.move?.stuck).toBe(0);
  });

  it("pack/unpack position losslessly for boundary values", () => {
    // Test x=0, y=0.
    const creep0 = createMockCreep({ x: 0, y: 0, fatigue: 0 });
    const target = { x: 30, y: 30, roomName: "sim" } as RoomPosition;
    moveCreep(creep0, target);
    expect(creep0.memory.move?.lastPos).toBe(0);

    // Test x=49, y=49.
    const creep49 = createMockCreep({ x: 49, y: 49, fatigue: 0 });
    moveCreep(creep49, target);
    expect(creep49.memory.move?.lastPos).toBe(49 * 50 + 49);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanupDeadCreeps } from "../src/housekeeping";
import type { MemoryStore } from "../src/memory";
import { setMemory } from "../src/memory";

describe("cleanupDeadCreeps", () => {
  let originalGame: any;

  beforeEach(() => {
    // Save original Game object
    originalGame = (globalThis as any).Game;
    // Reset memory to empty
    setMemory({ creeps: {} });
  });

  afterEach(() => {
    // Restore Game object
    (globalThis as any).Game = originalGame;
    // Reset memory
    setMemory();
  });

  it("removes dead creeps from Memory.creeps", () => {
    const memory: MemoryStore = {
      creeps: {
        "creep-1": { role: "worker" },
        "creep-2": { role: "scout" },
        "creep-3": { role: "builder" },
      },
    };
    setMemory(memory);

    // Mock Game.creeps to only have creep-1 and creep-3 alive
    (globalThis as any).Game = {
      creeps: {
        "creep-1": {},
        "creep-3": {},
      },
    };

    const cleaned = cleanupDeadCreeps();

    // creep-2 should be removed; creep-1 and creep-3 should remain
    expect(cleaned).toBe(1);
    expect(memory.creeps).toEqual({
      "creep-1": { role: "worker" },
      "creep-3": { role: "builder" },
    });
  });

  it("does nothing if all creeps in Memory are alive", () => {
    const memory: MemoryStore = {
      creeps: {
        "creep-1": { role: "worker" },
        "creep-2": { role: "scout" },
      },
    };
    setMemory(memory);

    (globalThis as any).Game = {
      creeps: {
        "creep-1": {},
        "creep-2": {},
      },
    };

    const cleaned = cleanupDeadCreeps();

    // No creeps should be removed
    expect(cleaned).toBe(0);
    expect(memory.creeps).toEqual({
      "creep-1": { role: "worker" },
      "creep-2": { role: "scout" },
    });
  });

  it("removes all creeps if none are alive", () => {
    const memory: MemoryStore = {
      creeps: {
        "creep-1": { role: "worker" },
        "creep-2": { role: "scout" },
      },
    };
    setMemory(memory);

    (globalThis as any).Game = {
      creeps: {},
    };

    const cleaned = cleanupDeadCreeps();

    // All creeps should be removed
    expect(cleaned).toBe(2);
    expect(memory.creeps).toEqual({});
  });

  it("handles missing or undefined Memory.creeps gracefully", () => {
    setMemory({});

    (globalThis as any).Game = {
      creeps: {},
    };

    // Should not throw and return 0
    const cleaned = cleanupDeadCreeps();
    expect(cleaned).toBe(0);
  });

  it("handles non-object Memory.creeps gracefully", () => {
    const memory: MemoryStore = {
      creeps: "not an object",
    };
    setMemory(memory);

    (globalThis as any).Game = {
      creeps: {},
    };

    // Should not throw or modify Memory
    const cleaned = cleanupDeadCreeps();
    expect(cleaned).toBe(0);
    expect(memory.creeps).toBe("not an object");
  });

  it("is idempotent — multiple calls produce same result", () => {
    const memory: MemoryStore = {
      creeps: {
        "creep-1": { role: "worker" },
        "creep-2": { role: "scout" },
      },
    };
    setMemory(memory);

    (globalThis as any).Game = {
      creeps: {
        "creep-1": {},
      },
    };

    // First call removes creep-2
    const cleaned1 = cleanupDeadCreeps();
    expect(cleaned1).toBe(1);

    // Second call finds nothing to remove
    const cleaned2 = cleanupDeadCreeps();
    expect(cleaned2).toBe(0);

    // Memory state should be stable
    expect(memory.creeps).toEqual({
      "creep-1": { role: "worker" },
    });
  });

  it("handles complex creep memory structures with nested data", () => {
    const memory: MemoryStore = {
      creeps: {
        "creep-1": {
          role: "worker",
          tasks: [{ type: "harvest", target: "id123" }],
          stats: { ticksWorked: 1000 },
        },
        "creep-2": {
          role: "builder",
          targetSite: "id456",
          progress: 0.5,
        },
      },
    };
    setMemory(memory);

    (globalThis as any).Game = {
      creeps: {
        "creep-1": {},
      },
    };

    const cleaned = cleanupDeadCreeps();

    // creep-2 should be removed, creep-1 should retain nested structure
    expect(cleaned).toBe(1);
    expect(memory.creeps).toEqual({
      "creep-1": {
        role: "worker",
        tasks: [{ type: "harvest", target: "id123" }],
        stats: { ticksWorked: 1000 },
      },
    });
  });

  it("returns 0 and handles errors gracefully", () => {
    // Mock getMemory to throw an error
    setMemory(undefined as any);

    (globalThis as any).Game = {
      creeps: {},
    };

    // Should catch error and return 0 without throwing
    const cleaned = cleanupDeadCreeps();
    expect(cleaned).toBe(0);
  });
});

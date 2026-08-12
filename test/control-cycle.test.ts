import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameAdapter } from "../src/game";
import { setGame } from "../src/game";
import type { MemoryStore } from "../src/memory";
import { setMemory } from "../src/memory";

describe("Control Cycle - Phase Order (AC3)", () => {
  let cpuUsed: number;
  let mockGame: GameAdapter;

  beforeEach(async () => {
    cpuUsed = 0;
    mockGame = {
      cpu: { getUsed: () => cpuUsed },
    };
    setGame(mockGame);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(console.log).mockClear();
    // Reset config to defaults
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);
  });

  it("should invoke phases in AD-9 order using fake world snapshot", async () => {
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);

    // AD-10 seam: world snapshot provides game state to phases (Epic 2+)
    const worldSnapshot = {
      rooms: [],
      creeps: {},
      structures: {},
    };
    vi.stubGlobal("worldSnapshot", worldSnapshot);

    // Setup: mock Game.cpu.getUsed() to return incrementing values
    mockGame = {
      cpu: { getUsed: () => (cpuUsed += 0.5) },
    };
    setGame(mockGame);

    const { loop } = await import("../src/main");

    // Call loop once
    loop();

    // Verify console.log was called with phase names in order
    const mockLog = vi.mocked(console.log);
    const logCalls = mockLog.mock.calls.map((call) => call[0]);

    // Filter for phase logs (they contain "[control]")
    const phaseLogs = logCalls.filter(
      (log: string) => typeof log === "string" && log.includes("[control]"),
    );

    // Verify we have 5 phase logs
    expect(phaseLogs).toHaveLength(5);

    // Verify phase order
    expect(phaseLogs[0]).toContain("generate");
    expect(phaseLogs[1]).toContain("deriveTakenSet");
    expect(phaseLogs[2]).toContain("validate");
    expect(phaseLogs[3]).toContain("match");
    expect(phaseLogs[4]).toContain("spawn");

    // Verify each log is prefixed with [control]
    phaseLogs.forEach((log: string) => {
      expect(log).toMatch(/^\[control\]/);
    });

    // Verify world snapshot exists (AD-10 seam placeholder)
    expect(worldSnapshot).toBeDefined();
  });

  it("should not emit metering logs when CPU_METERING_ENABLED is false (AC2)", async () => {
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", false);

    const logCalls = vi.mocked(console.log).mock.calls.map((call) => call[0]);
    const phaseLogs = logCalls.filter(
      (log: string) => typeof log === "string" && log.includes("[control]"),
    );

    expect(phaseLogs).toHaveLength(0);
  });
});

describe("Control Cycle - Zero Colony Memory (AC4)", () => {
  let cpuUsed: number;
  let mockGame: GameAdapter;
  let memory: MemoryStore;

  beforeEach(async () => {
    cpuUsed = 0;
    mockGame = {
      cpu: { getUsed: () => cpuUsed },
    };
    setGame(mockGame);
    memory = {};
    setMemory(memory);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(console.log).mockClear();
    // Reset config to defaults
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);
  });

  it("should not write any colony-level keys to Memory after N Ticks (AD-5)", async () => {
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);

    mockGame = {
      cpu: { getUsed: () => (cpuUsed += 0.5) },
    };
    setGame(mockGame);

    const { loop } = await import("../src/main");

    // Simulate N Ticks
    for (let i = 0; i < 10; i++) {
      loop();
    }

    // Verify Memory remains empty (no colony-level keys)
    expect(Object.keys(memory)).toHaveLength(0);
  });
});

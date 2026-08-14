import { beforeEach, describe, expect, test, vi } from "vitest";
import { getConstant } from "../src/config";
import type { GameAdapter } from "../src/game";

// Disable CPU metering so smoke tests only verify boot seam behavior,
// not control cycle phase logs.
vi.mock("../src/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/config")>();
  return {
    getConstant: (name: string) => {
      if (name === "CPU_METERING_ENABLED") return false;
      return actual.getConstant(name as keyof import("../src/config").Config);
    },
  };
});

describe("boot seam (Story 1.2)", () => {
  let captured: string[];

  beforeEach(async () => {
    // Fresh module registry + console capture so each test observes a clean boot.
    vi.resetModules();
    vi.restoreAllMocks();
    captured = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(" "));
    });

    // Story 1.4: the control cycle calls Game.cpu.getUsed() via metering.
    // Story 2.1: generate() calls world-read seam via GameAdapter.
    // Inject mock Game adapter so the smoke tests don't throw ReferenceError.
    const mockGame: GameAdapter = {
      cpu: {
        getUsed: () => 0,
      },
      getRooms: () => ["sim"],
      findMyStructures: () => [],
      findConstructionSites: () => [],
      findSources: () => [],
      findCreeps: () => [],
      getController: () => undefined,
      getTerrain: () => ({ get: () => 0 }),
      getTime: () => 0,
      getObjectById: () => undefined,
    };

    const { setGame } = await import("../src/game");
    setGame(mockGame);
  });

  test("loop() logs the boot marker exactly once across two invocations", async () => {
    const { loop } = await import("../src/main");
    expect(() => loop()).not.toThrow();
    expect(() => loop()).not.toThrow();
    expect(captured).toContain(getConstant("LOG_BOOT"));
    expect(
      captured.filter((line) => line === getConstant("LOG_BOOT")),
    ).toHaveLength(1);
  });

  test("loop() never throws and is a no-op after boot", async () => {
    const { loop } = await import("../src/main");
    for (let i = 0; i < 5; i++) {
      expect(() => loop()).not.toThrow();
    }
    // Boot marker logged once; subsequent loops may emit phase logs (e.g. [board]).
    expect(captured).toContain(getConstant("LOG_BOOT"));
    expect(
      captured.filter((line) => line === getConstant("LOG_BOOT")),
    ).toHaveLength(1);
  });
});

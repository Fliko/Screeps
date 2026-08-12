import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameAdapter } from "../src/game";
import { setGame } from "../src/game";

describe("measurePhase", () => {
  beforeEach(async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(console.log).mockClear();
    // Reset config to defaults
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);
    // Reset game adapter
    setGame();
  });

  it("logs phase CPU when metering enabled", async () => {
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", true);

    let cpuUsed = 0;
    const mockGame: GameAdapter = {
      cpu: { getUsed: () => (cpuUsed += 0.5) },
    };
    setGame(mockGame);

    const { measurePhase } = await import("../src/control/metering");
    measurePhase("test", () => {});

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[control] test:"),
    );
  });

  it("does not log when metering disabled", async () => {
    const config = await import("../src/config");
    config.setConstant("CPU_METERING_ENABLED", false);

    const mockGame: GameAdapter = {
      cpu: { getUsed: () => 0 },
    };
    setGame(mockGame);

    const { measurePhase } = await import("../src/control/metering");
    measurePhase("test", () => {});

    expect(console.log).not.toHaveBeenCalled();
  });
});

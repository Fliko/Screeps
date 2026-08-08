import { beforeEach, describe, expect, test, vi } from "vitest";
import { LOG_BOOT } from "../src/config";

describe("boot seam (Story 1.2)", () => {
  let captured: string[];

  beforeEach(() => {
    // Fresh module registry + console capture so each test observes a clean boot.
    vi.resetModules();
    vi.restoreAllMocks();
    captured = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      captured.push(args.map((a) => String(a)).join(" "));
    });
  });

  test("loop() logs the boot marker exactly once across two invocations", async () => {
    const { loop } = await import("../src/main");
    expect(() => loop()).not.toThrow();
    expect(() => loop()).not.toThrow();
    expect(captured).toHaveLength(1);
    expect(captured[0]).toBe(LOG_BOOT);
  });

  test("loop() never throws and is a no-op after boot", async () => {
    const { loop } = await import("../src/main");
    for (let i = 0; i < 5; i++) {
      expect(() => loop()).not.toThrow();
    }
    // First call logs, the remaining four are guarded no-ops.
    expect(captured).toHaveLength(1);
    expect(captured[0]).toBe(LOG_BOOT);
  });
});

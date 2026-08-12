import { getConstant } from "../config";
import { getGame } from "../game";

/**
 * Measures CPU cost of a control-cycle phase and logs it if metering is enabled.
 * Story 1.4, AC1/AC2.
 */
export function measurePhase(name: string, fn: () => void): void {
  if (!getConstant("CPU_METERING_ENABLED")) {
    fn();
    return;
  }

  const game = getGame();
  const start = game.cpu.getUsed();
  fn();
  const end = game.cpu.getUsed();
  const delta = Math.max(0, end - start);

  console.log(
    `${getConstant("LOG_PHASE_PREFIX")} ${name}: ${delta.toFixed(2)} CPU`,
  );
}

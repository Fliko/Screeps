import { getConstant } from "../config";
import { getGame } from "../game";

/**
 * Measures CPU cost of a control-cycle phase and logs it if metering is enabled.
 * Story 1.4, AC1/AC2. Story 3.2: generic return type so phases like
 * `deriveTakenSet` can produce a value while still being metered.
 */
export function measurePhase<T>(name: string, fn: () => T): T {
  if (!getConstant("CPU_METERING_ENABLED")) {
    return fn();
  }

  const game = getGame();
  const start = game.cpu.getUsed();
  const result = fn();
  const end = game.cpu.getUsed();
  const delta = Math.max(0, end - start);

  console.log(
    `${getConstant("LOG_PHASE_PREFIX")} ${name}: ${delta.toFixed(2)} CPU`,
  );
  return result;
}

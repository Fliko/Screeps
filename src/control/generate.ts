/** AD-9: generate phase — reset the Board then build the per-Tick world snapshot for Producers */
import { resetBoard } from "../board/registry";
import { buildWorldSnapshot } from "../world/snapshot";

export function generate(): void {
  // AD-3: reset the Board to empty for this Tick (Producers fill it in Story 2.3)
  resetBoard();
  buildWorldSnapshot();
}

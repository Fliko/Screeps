/** AD-9: generate phase — reset the Board, build the per-Tick world snapshot, then run Producers */
import { resetBoard } from "../board/registry";
import { runProducers } from "../world/producers/run";
import { buildWorldSnapshot } from "../world/snapshot";

export function generate(): void {
  // AD-3: reset the Board to empty for this Tick, then Producers fill it (Story 2.3)
  resetBoard();
  buildWorldSnapshot();
  runProducers();
}

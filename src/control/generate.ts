/** AD-9: generate phase — reset the Board, build the per-Tick world snapshot, then run Producers */
import type { Board } from "../board/registry";
import { getBoard, resetBoard } from "../board/registry";
import { getConstant } from "../config";
import { runProducers } from "../world/producers/run";
import { buildWorldSnapshot } from "../world/snapshot";

export function formatBoardLog(board: Board | undefined): string {
  if (!board || board.jobs.length === 0) {
    return "[board] 0 jobs";
  }
  const summary = board.jobs.map((job) => `${job.id}(${job.tier})`).join(" ");
  return `[board] ${board.jobs.length} jobs: ${summary}`;
}

export function generate(): void {
  // AD-3: reset the Board to empty for this Tick, then Producers fill it (Story 2.3)
  resetBoard();
  buildWorldSnapshot();
  runProducers();
  if (getConstant("LOG_BOARD_ENABLED")) {
    console.log(formatBoardLog(getBoard()));
  }
}

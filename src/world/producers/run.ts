/**
 * Producer run coordinator (AD-9 generate phase) — the only place that writes
 * the Board from Producers. Reads the per-Tick snapshot via getCurrentSnapshot()
 * (AD-10 seam; no Game reads here), runs the three pure Producers, and addJobs
 * their results in fill → build → upgrade order.
 *
 * Staleness guard (resolves the 2.2 deferred finding): each Tick generate() calls
 * resetBoard() first. If resetBoard() was missed, the Board still holds the prior
 * Tick's Jobs — runProducers refuses to build on stale data and throws.
 */
import { addJob, getBoard } from "../../board/registry";
import { getCurrentSnapshot } from "../snapshot";
import { produceBuild } from "./build";
import { produceFill } from "./fill";
import { produceMine } from "./mine";
import { produceUpgrade } from "./upgrade";

export function runProducers(): void {
  const snapshot = getCurrentSnapshot();
  if (!snapshot) return;

  const board = getBoard();
  if (board && board.jobs.length > 0) {
    throw new Error(
      "Stale Board — resetBoard() was not called this Tick before runProducers()",
    );
  }

  const produced = [
    ...produceFill(snapshot),
    ...produceBuild(snapshot),
    ...produceUpgrade(snapshot),
    ...produceMine(snapshot),
  ];
  for (const job of produced) addJob(job);
}

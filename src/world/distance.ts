/**
 * AD-7 distance service — the single source for travel-cost calculations.
 *
 * `chebyshevDistance` is pure math on plain data; no Game API reads (AD-10).
 * `liveDistance` is the named seam that Matching (Story 3.4) will call for
 * live-object distances. At MVP only same-room distances are needed, and
 * Screeps' `getRangeTo` returns Chebyshev for same-room positions, so the
 * wrapper delegates to the pure function. Multi-room pathfinding is deferred
 * to Phase 2 per ARCHITECTURE-SPINE.md Deferred.
 */

import type { RoomPositionData } from "../game";

export interface Point {
  x: number;
  y: number;
}

/**
 * Pure Chebyshev distance on plain { x, y } data.
 * Same-room Screeps ranges use this metric.
 */
export function chebyshevDistance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Live-object distance seam.
 * Currently delegates to `chebyshevDistance` for same-room distances.
 * Future multi-room stories may replace this with real pathfinding.
 */
export function liveDistance(a: RoomPositionData, b: RoomPositionData): number {
  return chebyshevDistance(a, b);
}

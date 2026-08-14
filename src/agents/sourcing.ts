/**
 * The sourcing rule shared by every Epic 4 behavior (Stories 4.2-4.4).
 *
 * Pure decision module: no Game reads, no Memory access — mirrors the
 * `agents/validators.ts` pure-module convention. A Contracted Generalist must
 * decide, every Tick, whether to harvest energy or serve its Contract's
 * target. That decision is derived fresh from live carry state each Tick,
 * never stored, so there is no persisted phase to get stuck in — this is
 * the anti-ping-pong guarantee: a partially-loaded Creep (e.g. carry 45 of
 * 50) always derives "serve," never bounces back to the Source.
 */

/** The two phases a Contracted Generalist's Tick can be in — derived, never stored. */
export type SourcingPhase = "source" | "serve";

/**
 * Derives whether a Creep should source (harvest) or serve (act on its
 * Contract's target) this Tick, from its current carry amount alone.
 *
 * "Source" fires only when `carry` is exactly `0` — any nonzero carry,
 * however small relative to capacity, derives "serve."
 *
 * @param carry The Creep's current total carried amount.
 * @returns `"source"` when the Creep should harvest, `"serve"` when it should
 *   act on its Contract's target.
 */
export function deriveSourcingPhase(carry: number): SourcingPhase {
  return carry === 0 ? "source" : "serve";
}

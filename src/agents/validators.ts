/**
 * Per-type Contract validation (AD-4).
 *
 * Pure rule module: no Game reads, no Memory writes, no Board mutation —
 * mirrors the world/producers/* purity convention. `control/validate.ts` is the
 * thin AD-9 phase orchestrator that feeds this function and performs the clear.
 *
 * A Contract's verdict resolves in three steps (FR-9):
 *  1. `mine` Contracts are exempt from all validation — FR-9's explicit
 *     depleted-Source exception. No mine Producer and no mine policy exist yet
 *     (Epic 6 scope), so there is nothing to check against.
 *  2. Otherwise, the Contract is invalid if its Job is gone from this Tick's
 *     freshly-derived Board (`job === undefined` — Producers omit fulfilled
 *     targets, so "vanished" and "fulfilled" collapse into absence).
 *  3. Otherwise, the type's rule decides.
 *
 * The rules table below covers only ttlFloor-shaped rules: everything it can
 * see is `(job, ttl, spawning)`. A real mine rule needs live Source data (energy
 * remaining, regeneration timer) that this signature cannot carry, so adding one
 * means widening the rule input, not just adding a table entry.
 */
import type { Job, JobType } from "../board/job";

/** Verdict for one Job type, given the Board's Job and the Creep's state. */
type ContractRule = (job: Job, ttl: number, spawning: boolean) => boolean;

/**
 * A Creep still being spawned has no `ticksToLive` yet (`src/game.ts` maps it to
 * `ttl: 0`), so its ttl cannot be compared against a floor. Spare it explicitly
 * via the engine's `spawning` flag rather than inferring from `ttl === 0`, which
 * would also spare a Creep genuinely in its last tick of life.
 */
const ttlFloorRule: ContractRule = (job, ttl, spawning) =>
  spawning || ttl >= job.requirements.ttlFloor;

/**
 * Per-type rules, keyed over the active Job types (mirrors the shape of
 * `config.ts`'s `JOB_POLICY_TABLE`). `mine` is intentionally absent — it is
 * short-circuited as always-valid before this table is consulted.
 */
const CONTRACT_RULES: Record<Exclude<JobType, "mine">, ContractRule> = {
  fill: ttlFloorRule,
  build: ttlFloorRule,
  upgrade: ttlFloorRule,
};

/**
 * Returns whether a Contract of `type` is still worth holding this Tick.
 *
 * @param type Job type parsed from the Contract's Job id.
 * @param job The Job as found on this Tick's Board, or `undefined` if absent.
 * @param ttl The Creep's ticks-to-live from the world snapshot.
 * @param spawning Whether the Creep is still being spawned.
 */
export function isContractValid(
  type: JobType,
  job: Job | undefined,
  ttl: number,
  spawning: boolean,
): boolean {
  if (type === "mine") {
    return true;
  }
  if (!job) {
    return false;
  }
  return CONTRACT_RULES[type](job, ttl, spawning);
}

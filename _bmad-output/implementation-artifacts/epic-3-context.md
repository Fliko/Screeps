# Epic 3 Context: Dispatch — Creeps Claim and Keep Work

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Idle Creeps pull the single best open Job and hold it stickily until it's genuinely invalid: this epic delivers the Contract schema, per-type validators, tier/priority/distance Matching with TTL eligibility, a within-Tick claim lock, a freshly-derived taken-set (including Spawning Creeps), and the one movement choke point with stuck escalation. By the end, a Creep visibly claims work and walks to it in the sim room, and the colony recovers a valid Contract for every living Creep within a few Ticks of a full Memory wipe.

## Stories

- Story 3.1: Contract & Memory Schema
- Story 3.2: Taken-Set Derivation
- Story 3.3: Validators
- Story 3.4: Matching & Claim Lock
- Story 3.5: Movement Choke Point + Stuck Escalation
- Story 3.6: Cycle Wiring & Wipe Recovery

## Requirements & Constraints

- Capacity accounting must be exact: the Board tracks active Contracts per Job and stops offering a Job once it hits max workers, and this includes Creeps still Spawning — a Spawning Creep's Reserved Contract must count as taken so Reserved slots never double-fill.
- Reserved Jobs (mine slots) are fillable only through Spawn Management and must never be offered to idle Creeps; Pulled Jobs are fillable only by idle Creeps.
- A Creep holds at most one Contract at a time and is never reassigned while that Contract is valid; a Creep pulls a new Contract only when it holds none (idle-only assignment).
- The Contract is the sole unit of scheduling persistence, stored in each Creep's own memory, surviving across Ticks.
- Each Tick, every Contracted Creep's Contract is validated against current world state (target exists, still needs work, Creep capable, TTL sufficient), with type-specific rules; invalid Contracts clear immediately, that same Tick.
- Matching order is deterministic: highest Priority Tier first, then within-tier priority, then lowest travel cost for that Creep (Chebyshev distance from the world/ distance service).
- A Creep is never assigned a Job whose TTL floor exceeds its remaining life.
- Assignment reduces Board availability immediately within the same Tick, before the next idle Creep is matched (no herd double-claims on a max-1 Job).
- Priority tier policy is data, not code: fill = critical, build = medium, upgrade = low (Backfill, always posted, unlimited workers); changing a Job type's tier is a one-place change in the config.ts policy table.
- Sustained CPU/Tick must stay comfortably under the account limit: only idle Creeps run Matching, working Creeps run only their validation check, and the Board/taken-set are computed once per Tick and shared.
- Only Creep-level state persists (Contract + small movement-helper state); no colony-level state, no persisted Board.
- The colony must self-heal with no operator action after a full Memory wipe: every living Creep holds a valid Contract again within a few Ticks.

## Technical Decisions

- **Module topology & write ownership**: exactly one blackboard role per module. `state/` owns the creep.memory schema and typed accessors — `contract` (a jobId string `type:targetId` or absent) and `move` (packed lastPos, stuck), with the engine-owned `_move` field documented as untouchable. `setContract` is exposed only to `control/` (initial spawn memory or Matching claim); `clearContract` is additionally exposed to validators. Validators may only clear, never set. `agents/` write only their own `creep.memory.move`.
- **Contract shape (AD-4)**: `creep.memory.contract` is a single jobId string, grammar `type:targetId`. Validators clear only on genuine FR-9 invalidity, never on carry state. Sourcing phase is derived, not stored: source iff empty, serve otherwise.
- **Derived Board (AD-3)**: the Board and taken-set are recomputed every Tick; nothing survives from the previous Tick.
- **Matching discipline (AD-7)**: no pathfinding in the scoring path — distances come from the single world/ distance service (Chebyshev `getRangeTo` at MVP). Assignment ordering is tier → within-tier priority → distance; within-tier priority is set by Producers from the policy table (this is how Container-first construction becomes data, not code).
- **Movement choke point (AD-8)**: all movement goes through `agents/movement.ts` (`moveTo` with explicit opts); no behavior calls `move`/`moveTo`/`moveByPath` directly (lint-visible). Stuck detection: position unchanged for N consecutive Ticks AND `fatigue == 0` → one re-path with `ignoreCreeps: true`, then revert to default opts. State tracked as `creep.memory.move = { lastPos (packed y*50+x), stuck }`. Fatigue-waiting is not stuck.
- **Control-cycle order (AD-9)**: generate → taken-set → validate → match → spawn, one pass per Tick, wired in `main.ts`. The taken-set is derived exactly once per Tick and passed to validate and match; it includes Spawning Creeps' Contracts and is never stored.
- **Game-read seam (AD-10)**: all `find`/`look`/`getObjectById`/terrain calls stay inside `world/`; agents/ issue Creep intents on world/-obtained references.
- **Zero colony persistence (AD-5)**: no Memory keys outside `Memory.creeps`.
- **Conventions in play**: strict TS with string-union types (no runtime enums); `ERR_*` codes checked at the callsite; `config.ts` is the single typed home for the policy table (tiers, within-tier priority, maxWorkers, Reserved-vs-Pulled) and MVP constants (TTL replacement threshold, per-Job TTL floors, stuck N, reusePath); Job schema is `{ id, type, targetId, pos, tier, withinTierPriority, maxWorkers, assignmentMode, lifetimeClass, requirements { body, ttlFloor } }`.
- **Test strategy**: vitest unit tests for decision logic (validators, matching) against fake world/Board snapshots; behaviors (actual movement/claiming in the live game) verified in the sim room, not unit-tested. This story also executes a deferred verification: `moveTo` engine internals (`reusePath` default, `_move` behavior, `ignoreCreeps` semantics) checked against current API docs and the result recorded in the README.

## Cross-Story Dependencies

- Builds directly on Epic 2's Board/Job types and world/ distance service — Matching consumes the Board Epic 2 produces.
- Story 3.1 (schema) underlies every other story in the epic: taken-set, validators, and Matching all read/write Contracts through its accessors.
- Story 3.2 (taken-set) must be derived before Story 3.3 (validators) and Story 3.4 (Matching) can run correctly each Tick, per the AD-9 cycle order.
- Story 3.6 wires validate/match into `main.ts`, replacing the Epic 1 stub phases, and must keep the Epic 1 phase-order test passing.
- Feeds Epic 4 (Generalist behaviors execute against the Contracts this epic creates) and Epic 6 (Reserved-slot/mine Contracts and the taken-set's double-spawn protection are reused for Specialist assignment).

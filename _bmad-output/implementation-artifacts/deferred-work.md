# Deferred Work

## Deferred from: code review of story 1.4 (2026-08-11)

- No error isolation between phases [src/main.ts:28-32] — if any phase throws, remaining phases skipped. Deferred: skeleton stage, phases empty stubs.
- Zero Colony Memory test vacuous [test/control-cycle.test.ts:89-108] — test passes trivially because phases empty. Deferred: skeleton stage, acceptable placeholder.
- AC1 [module] vs [control] ambiguity [src/config.ts:13] — AC1 says "[module]-prefixed" but implementation uses literal "[control]". Deferred: defensible reading.
- Sprint-status premature [sprint-status.yaml] — status bumped to review but AC3 AD-10 seam unmet. Deferred: depends on AC3 decision.
- NaN from getUsed() [src/control/metering.ts:8,11] — if getUsed() returns NaN, delta.toFixed(2) = "NaN". Deferred: edge case.


## Deferred from: code review of story 2.1 (2026-08-12)

- Snapshot only captures one visible room [src/world/snapshot.ts:69-70] — MVP single-room scope; multi-room support deferred per architecture.
- `findMyStructures` omits store-based neutral structures [src/game.ts:84-92] — `energyCapacity > 0` filter excludes Containers/Storage/Terminals; not needed until later Producer stories.
- Snapshot omits terrain/resources needed by later Producers [src/world/snapshot.ts] — sources/minerals/terrain absent; deferred to distance/Producer stories.
## Deferred from: code review of story 2.2 (2026-08-12)

- `addJob` uninitialized guard only catches the first-Tick case; a later missed `resetBoard()` silently serves stale Board data rather than throwing [src/board/registry.ts:39-46] — deferred until Producers land in Story 2.3; fix should add a per-Tick generation marker or equivalent staleness guard.


## Deferred from: code review of story 2.4 (2026-08-12)

- `liveDistance` does not use `Game.getRangeTo` literally, despite AC2 wording — it delegates to the pure `chebyshevDistance`. Story T2 explicitly chose option (b) for the MVP seam, and the function is correct for same-room distances. Reconcile spec wording if future stories need actual `getRangeTo`. `[src/world/distance.ts:31]`
- `liveDistance` does not guard against cross-room `RoomPositionData`. MVP is single-room, so this is acceptable; multi-room pathfinding is deferred to Phase 2 per architecture. `[src/world/distance.ts:31]`


## Deferred from: code review of story 3.2 (2026-08-13)

- `spawn` phase is not given the `TakenSet`, though Reserved-slot spawning (FR-16) needs capacity data to avoid double-filling [src/main.ts:167] — deferred to Epic 5, which owns spawn queueing; passing it now would add an unused parameter with no consumer.
- Contracts naming a `jobId` that is absent from this Tick's Board are still counted toward capacity [src/control/taken.ts:102] — deferred to Story 3.3, which owns validators and clears invalid Contracts per FR-9.
- `hasCapacity` is only tested against locally-built Jobs, never against Jobs produced by `world/producers/` from `JOB_POLICY_TABLE` [test/control/taken.test.ts] — deferred to Story 3.4, where Matching becomes the first production consumer.


## Deferred from: code review of story 3.3 (2026-08-13)

- `requirements.body` is never validated, only `requirements.ttlFloor` — a Creep that loses its WORK/CARRY parts keeps a Contract it can no longer perform (FR-4) [src/agents/validators.ts] — deferred; not in Story 3.3's AC, and body loss has no current in-game trigger at MVP scope (no dismemberment mechanic in play).
- `validate` clears Memory but leaves the current Tick's `snapshot.creeps[i].contract` set for the rest of the Tick [src/control/validate.ts, src/world/snapshot.ts:143] — deferred to Story 3.4; `match` must read Memory/the taken-set post-validate, not assume the snapshot's Contract field is current.
- `createMockGame`/`createCreep` test fixtures are duplicated across `test/control-cycle.test.ts`, `test/world/creeps.test.ts`, and `test/control/validate.test.ts`, each with slightly divergent shapes — deferred cleanup; a shared `test/helpers/game.ts` factory would prevent drift the next time `GameAdapter` gains a method.
- `releaseContracts`' partial-decrement branch (two Creeps on one Job, one cleared, count 2→1) is unit-tested (Story 3.2) but not exercised at the `loop()` integration level — deferred; the underlying logic is covered, this is additional confidence only.
- Malformed `creep.memory.contract` strings are never cleaned up — `getContract` (Story 3.1) already treats them as "no contract" so `validate` never sees them, but the raw junk string persists in Memory indefinitely — deferred; a Memory garbage-collection pass would need to scan `Memory.creeps` directly, out of scope for any current story.


## Deferred from: code review of story 3.4 (2026-08-13)

- `selectJob` in `src/control/match.ts` never checks `job.requirements.body` against `creep.body` — a Creep with the wrong Body parts (e.g. no `work`) can still be matched to and keep a `fill`/`build`/`upgrade` Job. Same gap already deferred from Story 3.3's validators (`requirements.body` never checked there either); MVP has only one Body composition (Generalist) so it's currently unreachable — deferred until Epic 6 introduces Specialist Bodies with different part sets.
- `job.maxWorkers` is never validated to be a positive number before `selectJob` compares a running count against it — a `0` or negative `maxWorkers` slipping through a future Producer/config bug would silently make that Job unselectable with no diagnostic. Deferred; `config.ts`'s `JOB_POLICY_TABLE` is hand-authored and currently the only source of `maxWorkers`, so this is not reachable today — belongs with Producer/policy-table validation if one is ever added, not with Matching.

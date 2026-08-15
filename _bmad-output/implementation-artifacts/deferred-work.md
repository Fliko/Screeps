# Deferred Work

## Deferred from: code review of story 1.4 (2026-08-11)

- No error isolation between phases [src/main.ts:28-32] — if any phase throws, remaining phases skipped. Deferred: skeleton stage, phases empty stubs.
- Zero Colony Memory test vacuous [test/control-cycle.test.ts:89-108] — test passes trivially because phases empty. Deferred: skeleton stage, acceptable placeholder.
- AC1 [module] vs [control] ambiguity [src/config.ts:13] — AC1 says "[module]-prefixed" but implementation uses literal "[control]". Deferred: defensible reading.
- Sprint-status premature [sprint-status.yaml] — status bumped to review but AC3 AD-10 seam unmet. Deferred: depends on AC3 decision.
- NaN from getUsed() [src/control/metering.ts:8,11] — if getUsed() returns NaN, delta.toFixed(2) = "NaN". Deferred: edge case.


## Deferred from: code review of stories 6.1-6.4 (2026-08-14)

- source_spec: `_bmad-output/implementation-artifacts/spec-6-4-reserved-slot-spawning-specialist-bodies.md`
  summary: `spawn()` has no fallback to a lower-priority present reason (e.g. population-topup) when the selected reason's body is unaffordable — it returns without spawning that Tick even if a cheaper reason could have fired.
  evidence: Spec's own I/O Matrix and AC explicitly specify "no spawnCreep call" on insufficient energy for the selected reason, with no fallback behavior defined; self-healing next Tick (population-topup re-evaluates), not a functional regression, but worth deliberate design attention alongside Story 6.7's spawn-policy transition logic.

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

## Deferred from: bmad-review of Story 3.5 movement choke point (2026-08-13)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-movement-choke-point-review-fixes.md`
  summary: Tighten movement/state test assertions from `expect.objectContaining`/`expect.any(Number)` to exact expected values (opts objects and computed `lastPos`), so an accidental `reusePath`/`packPos` regression would actually fail a test.
  evidence: Adversarial and verification-gap lenses both flagged that partial-match assertions (`objectContaining`, `expect.any(Number)`) would pass even if the underlying value drifted — the tests exist but don't pin the exact contract.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-movement-choke-point-review-fixes.md`
  summary: Remove the unused `_unpackPos` function from `src/agents/movement.ts` (dead code — no caller, no test).
  evidence: Adversarial and verification-gap (missing-adoption-gap) lenses both flagged it as untested, uncalled code kept only for "future use."
- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-movement-choke-point-review-fixes.md`
  summary: Add one line to README.md's Movement note documenting that `moveCreep` in `agents/movement.ts` is the sole sanctioned move call site, so future Epic 4 behaviors don't reach for `creep.moveTo` directly.
  evidence: Adversarial lens noted AC1's single-choke-point requirement has no discoverable developer-facing statement — only a manual grep check in the story file.

## Deferred from: bmad-build review of spec-3-5-movement-choke-point-review-fixes (2026-08-13)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-movement-choke-point-review-fixes.md`
  summary: `getMoveState` in `src/state/move.ts` validates `lastPos` is a finite number but not that it falls in the valid packed-position range (0-2499, per `y * 50 + x` with x,y ∈ [0,49]) or is an integer — a finite-but-out-of-range or fractional `lastPos` currently passes validation and would decode to a bogus or off-map position.
  evidence: Edge-case-hunter lens flagged this on the review of the `lastPos` NaN/Infinity fix. Deliberately out of this spec's narrowed scope — the spec's own Boundaries section anticipated range validation might follow ("out-of-range is a validation failure, not a value to coerce") but the Tasks section scoped only NaN/Infinity to keep the hardening pass small per the human's split decision.

## Deferred from: bmad-build review of spec-3-5-movement-choke-point-deferred-cleanup (2026-08-13)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-5-movement-choke-point-deferred-cleanup.md`
  summary: `getMoveState` in `src/state/move.ts` validates `lastPos` for finiteness, integer-ness, and range, but `stuck` is only validated for `typeof === "number" && Number.isFinite(...)` — a corrupted `stuck` (negative or fractional) still passes validation and is returned as a valid `MoveState`, unlike the now-hardened `lastPos`.
  evidence: Blind-hunter lens flagged the asymmetry between the two fields' validation rigor on the review of the `lastPos` range/integer fix. Real gap (same self-healing rationale that motivated the `lastPos` hardening would apply here), but a new scope beyond this spec's four already-approved items — deferred rather than expanding scope mid-review.

## Deferred from: bmad-build review of spec-5-3-body-selection-affordability + spec-5-4-spawn-priority-ordering-colony-observation (2026-08-14)

- source_spec: `_bmad-output/implementation-artifacts/spec-5-3-body-selection-affordability.md`
  summary: The upgrade Job's `lifetimeClass` was flipped `"transient"` -> `"persistent"` in `src/config.ts` as an undocumented, unspecified side effect of Story 5.3's implementation, fixing a pre-existing config/test mismatch noted (but left unresolved) in Story 5.2's residual risks — confirm this is the intended permanent value and give it a proper Story/AD citation comment, since no downstream code currently reads `lifetimeClass` to catch a wrong choice at runtime (verification-gap confirmed zero consumers today; Epic 6 is expected to add one).
  evidence: Blind-hunter lens flagged the change as unexplained and unrelated to either spec's Intent; neither spec's Code Map or Tasks mention `upgrade`'s Job policy. Verification-gap confirmed the new value is asserted by `test/world/producers/upgrade.test.ts:40` (pre-existing test, unmodified by this diff) and traced no current reader of `lifetimeClass` in `src/`, so nothing is broken today — the concern is purely an undocumented, out-of-scope production-value change riding along in the diff, not a correctness bug.

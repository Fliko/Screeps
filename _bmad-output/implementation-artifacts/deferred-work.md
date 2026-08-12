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

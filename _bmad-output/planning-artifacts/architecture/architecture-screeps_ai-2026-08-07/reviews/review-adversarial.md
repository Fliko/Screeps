# Adversarial Review — screeps_ai Architecture Spine

- **Lens:** two compliant-but-incompatible units one level down (configured finalize reviewer)
- **Mode:** inline fallback — subagents unavailable at gate time (two dispatch failures); reviewer-gate.md sequential fallback followed: file written first, summary second
- **Inputs:** ARCHITECTURE-SPINE.md (post-reconcile, post-gate-fix state)

## Verdict

The spine holds up well after the reconcile fixes: most attack pairs collapse into existing ADs. One high hole (taken-set must include Spawning Creeps or Reserved slots get double-spawned), two medium holes (object-reference caching on global; aggregate-vs-per-object Jobs), one low (validator carry-state clearing), one informational (Phase-3 runtime-mutable config read semantics). All close with single clauses.

## Pairs attempted

| Pair | ADs obeyed | Result |
| --- | --- | --- |
| build behavior vs fill validator on phase/carry semantics | AD-4, AD-9 | **Hole L1** — nothing forbids a validator clearing a Contract when carry hits empty; behavior would re-pull while another validator type keeps the Contract. Divergent validator semantics across Job types. |
| fill Producer built by two different builders | AD-3, AD-4 (id grammar), FR-2 | **Hole M2** — `type:targetId` implies per-object Jobs but never says it; an aggregate `fill:room` Job is arguably compliant and changes Matching + maxWorkers semantics. |
| Matching vs Spawn on a Reserved slot | AD-2 (field ownership), FR-6 convention | Closed for assignment — **but exposed H1**: a Spawning Creep's Contract exists (written at spawnCreep) while the Creep is not yet walking; a taken-set scan that skips Spawning Creeps sees the slot as vacant → double-spawn. |
| behavior stashing extra fields in creep.memory | AD-2, state/ schema | Closed — agents may write only their own `.move`. |
| distance service caching Game object references on `global` | AD-6, AD-7 | **Hole M1** — AD-6 licenses global caches but doesn't say refs go stale every Tick; one builder caches Source objects, another caches ids. |
| config.ts read timing (load-time vs per-Tick) | conventions (Config) | Info only at MVP (static values) — becomes a hole when Phase 3 makes config runtime-mutable; Deferred note added. |

## Holes and fixes

- **[high] Taken-set excludes Spawning Creeps** (AD-9) — *Fix applied:* AD-9 Rule now states the taken-set derives from all Creeps' Contracts including Spawning ones.
- **[medium] Game object references cached on global go stale** (AD-6) — *Fix applied:* AD-6 forbids caching references; ids and plain data only.
- **[medium] Aggregate vs per-object Jobs unspecified** (AD-3) — *Fix applied:* one Job per world object that needs work (FR-2), never aggregate Jobs.
- **[low] Validator carry-state clearing** (AD-4) — *Fix applied:* validators clear only on FR-9 invalidity conditions, never on carry state.
- **[info] Phase-3 runtime-mutable config** — *Fix applied:* Deferred entry notes a read-semantics AD arrives with that phase.

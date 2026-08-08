# Reconcile: PRD Addendum → Architecture Spine

*Source: `prds/prd-screeps_ai-2026-08-07/addendum.md` → `architecture-screeps_ai-2026-08-07/ARCHITECTURE-SPINE.md`. The spine's frontmatter already lists the addendum under `sources`, so traceability is declared.*

## 1. Landed

| Addendum item | Where it landed |
| --- | --- |
| Per-Tick loop ordering (generate → taken-set → validate → match → feed Spawn) | **AD-9** (fixed control-cycle order, one pass per Tick) + Design Paradigm mermaid + `main.ts` seed entry |
| Ordering rationale (validate before match so released capacity is visible) | **AD-9** Prevents line: "matching against stale capacity (validate must precede match)" |
| Within-Tick claim lock (FR-13) makes matching correct | Paradigm mermaid ("match idle Creeps, claim-locked") + seed `control/matching.ts # scoring + claim lock` |
| Sticky SEEKING / WORKING; IDLE pulls a new Job | Implicit: **AD-9** validate-working / match-idle split + **AD-4** (contract in `creep.memory` is the only lifecycle state; re-validate, never reassign) |
| Sourcing-phase stickiness within a Job | **AD-4**: "sourcing phase is derived, never stored: source iff empty, serve otherwise" |
| DYING branch at low TTL (spawn side) | Seed `control/spawn.ts # proactive replacement` + config constants "TTL threshold/floors" |
| Bodies-as-data per Job class × energy-capacity band | **Deferred**: "Bodies-as-data per energy-capacity band — Phase 2 (see PRD addendum)"; body selection seeded in `control/spawn.ts`; the "config change, not code change" spirit echoed by `config.ts` as "seed of the Phase-3 configurable-strategy surface" |
| Post-MVP RCL growth is engine-native (new Extensions auto-emit fill Jobs) | Structural via **AD-3** (Board is a per-Tick derived projection); the genuinely new part (upscaling) is Deferred (above) |
| Throttled Board regeneration CPU lever | **Deferred**: "Validation/Board throttling (backoff) — Phase-3 configurable-strategy lever"; its conflict with FR-1's every-Tick rule stays visible via AD-3 |
| Phase-3 study map (Kubernetes, SLURM/YARN, deferrable/sporadic/constant-bandwidth servers, Erlang-C/B) | Nowhere — consciously omitted; see Notes |

## 2. Gaps

- **End-of-life unload has no home.** "A dying Creep delivers its carried energy to the nearest needy structure rather than dying loaded" appears nowhere in the spine. DYING exists only spawn-side (proactive replacement, TTL constants in config); nothing binds the behavior-side unload. A story-writer would have to discover it in the addendum by chance.
- **The state machine is never named, only scattered.** SPAWNING→SEEKING→WORKING→IDLE→DYING is reconstructable from AD-4 (contract = sole lifecycle state), AD-9 (the validate/match split supplies the stickiness), and the spawn seed — but no AD, seed entry, or capability-map row says "the creep lifecycle is a state machine owned by `agents/behaviors`." Partially findable for a careful reader; not findable as a thing. SPAWNING in particular has no owner: `control/spawn.ts` writes spawn decisions, but no artifact owns the spawning-to-first-Job transition creep-side.

## Notes (not gaps)

- **Study map:** correctly absent from the spine — it is Phase-3 learning material, not build substrate. The spine's `sources` frontmatter points at the addendum, so the reference is recoverable when Phase 3 arrives. No action needed.
- **Throttled-regeneration caveat:** the addendum's "conflicts with FR-1 as written; interacts with NFR-1" is not restated in the Deferred entry, but the tension is structurally self-evident against AD-3. Not a gap.

## 3. Verdict

The mechanism handoff landed almost completely — loop ordering and its rationale, the claim lock, bodies-as-data, and the throttled-regeneration lever all have explicit homes (AD-9, AD-3/AD-4, Deferred, config seed). The one real hole is the creep lifecycle: the state machine and especially the dying-creep unload behavior lack a visible home, and a story-writer cannot find them from the spine alone.

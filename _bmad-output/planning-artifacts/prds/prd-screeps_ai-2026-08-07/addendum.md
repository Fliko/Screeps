# Addendum: screeps_ai

*Depth that belongs to downstream phases (architecture, strategy & tuning) — captured 2026-08-07 during PRD coaching, from the author and `input/perplexity_thread.md`. Not PRD content.*

## Post-MVP: Continued RCL Progression

Author's framing: "As the controller upgrades I will want to build extensions that will need to be filled and will give more options for the specialist bodies."

- RCL3+ unlocks additional Extensions → more fill demand and larger energy capacity.
- Larger capacity enables upscaled Specialist Bodies (more WORK per Harvester, more CARRY per Collector) and eventually 2 Harvesters per Source, Haulers, tower/storage logistics.
- **Engine-native growth:** because the Job Board is a derived projection (FR-1/FR-2), newly built Extensions automatically emit fill Jobs and operator-placed sites automatically emit build Jobs — no new capability needed for that part.
- **The genuinely new post-MVP capability is Body upscaling** with energy capacity.

## Architecture Handoff Notes

Mechanism depth preserved for the architecture phase:

- **Per-Tick loop ordering:** generate (Producers emit the Job list, cached for the Tick) → derive taken-set (scan all Contracts once) → validate working Creeps (re-validate, never reassign) → match idle Creeps (score, claim-lock as you go) → feed the Spawn.
- **Ordering rationale:** validation runs before matching so released capacity is visible; the within-Tick claim lock (FR-13) is what makes matching correct.
- **Creep state machine:** SPAWNING → SEEKING → WORKING → IDLE → (pull new Job) → SEEKING …, with a DYING branch at low TTL. SEEKING and WORKING are sticky by construction. End-of-life behavior: a dying Creep delivers its carried energy to the nearest needy structure rather than dying loaded (FR-12 already forbids long dispatches).
- **Bodies as data** (see Post-MVP upscaling above): define Bodies as data per Job class and energy-capacity band, not hard-coded part lists — so post-MVP upscaling is a config change, not a code change. Foreshadows the configurable-strategy roadmap goal.
- **Study map for Phase 3 (this is a learning vehicle):** reference designs — the Kubernetes scheduler (priority classes, preemption policies, pod-disruption-budgets), SLURM/YARN (reservations + backfill). Real-time reservation servers for deadline work: deferrable server, sporadic server, constant-bandwidth server. Erlang-C/B for pool sizing.
- **CPU lever, deferred to world-domination scale:** throttled Board regeneration — regenerate every N Ticks and let validation catch staleness in between. Conflicts with FR-1's every-Tick rule as written and interacts with NFR-1; revisit only when maximizing every CPU unit matters.

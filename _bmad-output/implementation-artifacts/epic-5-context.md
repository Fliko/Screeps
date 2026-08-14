# Epic 5 Context: Spawn Management — the Colony Replaces Itself

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

The Spawn is the colony's capacity reservoir: it keeps the worker pool topped up so the colony survives losses without operator intervention. This epic replaces the Epic 1 spawn stub with real logic that derives population every Tick, proactively replaces Creeps nearing end-of-life, selects an affordable Body from a typed composition table, and — when energy is contested — spends it on the most critical vacancy first. By the end of this epic, deaths become non-events: the colony self-replenishes indefinitely in the Generalist era with no console commands.

## Stories

- Story 5.1: Population Maintenance & the spawnCreep Issuer
- Story 5.2: Proactive TTL Replacement
- Story 5.3: Body Selection & Affordability
- Story 5.4: Spawn Priority Ordering & Colony Observation

## Requirements & Constraints

- Population maintenance: when living-plus-in-progress Creep count falls below a configured target, queue a replacement with no manual intervention; the colony must return to target after losses.
- Spawning (in-progress) Creeps count toward population — never over-spawn while the Spawn is busy.
- Proactive replacement: a Creep whose TTL drops below a configured replacement threshold (distinct from per-Job TTL floors) triggers its own replacement before it dies, so vacancies are already being filled when they open.
- Body selection: every spawn request pulls a Body from a typed composition table in config — never an inline part list — and must never exceed current `energyAvailable`. No spawn is ever queued that the colony can't afford; skip the Tick instead.
- At MVP only the Generalist Body composition is active (balanced, self-sourcing worker); Specialist Bodies (Harvester, Collector) belong to Epic 6 and are out of scope here except as forward-compatible shape.
- Spawn priority ordering (fixed order, highest first): (1) vacant Reserved mine slots, (2) demand pressure (e.g. Collectors below minimum), (3) general population top-up. In the Generalist era only rule (3) is active — rules (1) and (2) must still be provable now via fabricated/fake inputs since their real triggers (mine Jobs, Collector minimums) don't exist until Epic 6.
- Long-run observable outcome: in the Generalist-era sim room, population climbs to and holds at target across ongoing Creep deaths, with CPU per Tick staying under budget (NFR-1).
- MVP numeric constants (target population, TTL replacement threshold, Collector minimum used for priority-rule 2 testing) are configuration values in `config.ts`, not invented ad hoc — pin them where each story first needs them.

## Technical Decisions

- Module ownership: all spawn logic lives in `control/spawn.ts` (population, proactive replacement, reserved-slot fill, Body selection); priority policy for era-driven spawn behavior is a separate concern (`control/evolution.ts`, Epic 6) — Epic 5 implements only the fixed, non-era-branching parts of priority ordering.
- Write ownership: only `control/` sets Contracts and makes spawn decisions; a Contract for a Reserved slot is written at spawn time via `spawnCreep` initial memory (the Creep's first Contract exists before it takes its first step) — `world/` and `board/` stay read-only to `control/`.
- Control-cycle order is fixed and already wired: generate -> derive taken-set -> validate -> match -> spawn, exactly one pass per Tick. The spawn phase runs last, replacing its Epic 1 stub in that same final position — do not reorder the cycle.
- The taken-set used earlier in the cycle is derived from all Creeps' Contracts, including Creeps still Spawning (whose Reserved Contracts were written at spawnCreep time) — this is why Spawning Creeps must count toward population and why a Reserved slot won't look vacant and get double-queued.
- Zero colony-level persistence: population, spawn demand, and replacement decisions are derived fresh from world state every Tick — no Memory keys outside `Memory.creeps`. Nothing about "who needs replacing" or "what's queued" persists between Ticks.
- The `spawnCreep` intent is issued only by `control/spawn`; Game API reads happen only inside `world/`, which exposes the snapshot that `control/spawn` consumes (population counts, energyAvailable, etc.) — `control/spawn` never touches the Game read API directly.
- Config is the single source for tunables relevant to this epic: the Body compositions table (Generalist at MVP; Harvester/Collector reserved for Epic 6), the MVP constants (target population, TTL replacement threshold, Collector minimum), and the Priority Tier / policy table used elsewhere in the system. This epic only needs the Body table and MVP constants; wiring a new Job type's policy entry is out of scope.
- Testing pattern established across the codebase: spawn logic is unit-tested against fake/fabricated world-state snapshots (population counts, TTLs, energyAvailable, contrived Reserved-vacancy and demand-pressure inputs), with sim-room observation reserved for confirming end-to-end behavior (log lines, client-visible Body parts, population holding steady over a long window).

## Cross-Story Dependencies

- Story 5.1 replaces the Epic 1 spawn stub and establishes the `spawnCreep` issuance path that 5.2, 5.3, and 5.4 all extend — it should land first.
- Story 5.2 (proactive replacement) and Story 5.3 (Body selection/affordability) both feed spawn requests into the same issuer built in 5.1; 5.4's priority ordering arbitrates between whatever requests 5.1–5.3 can produce plus fabricated Reserved-vacancy/demand-pressure inputs.
- Story 5.4's rules (1) and (2) — Reserved-slot vacancies and Collector-minimum demand pressure — have no real producers until Epic 6 (mine Producer, Specialist Bodies, Evolution). Story 5.4 must prove the ordering machinery with fabricated inputs now, since Epic 6 will plug real triggers into the same priority policy without changing this epic's code.
- Epic 6 depends on this epic's Body-selection mechanism (5.3) and priority ordering (5.4) being in place and correctly shaped before Specialist Bodies and Reserved mine-slot spawning can be added.

# Epic 6 Context: Evolution — Graduation to Specialists (MVP exit)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

This epic takes the colony from a self-sustaining Generalist economy to a fully-Specialist workforce, with no operator action beyond placing Container sites once. The colony must continuously detect readiness (RCL >= 2, all 5 Extensions built, a Container adjacent to every Source), prioritize building those Containers first, let Generalists age out naturally while Harvesters and Collectors take over, and — critically — degrade back to the Generalist era gracefully if the Evolution conditions ever stop holding (e.g. a destroyed Container). This is the MVP exit: it proves the colony can graduate unattended and survive disruption without operator intervention or any persisted "era" state.

## Stories

- Story 6.1: Era Derivation in the Snapshot
- Story 6.2: Mine Producer & Era Gating
- Story 6.3: Container-First Construction
- Story 6.4: Reserved-Slot Spawning & Specialist Bodies
- Story 6.5: Harvester Behavior
- Story 6.6: Collector Behavior
- Story 6.7: Deprecation & Graceful Degradation
- Story 6.8: Evolution Observation — MVP Exit

## Requirements & Constraints

- Evolution trigger: all three conditions must hold simultaneously — RCL >= 2, all 5 Extensions built, a Container adjacent to every Source. The trigger is derived from world state every Tick, never a manual flag or persisted value. Evolution begins the Tick all conditions first hold.
- Once RCL2 is reached, Source-adjacent Container construction sites outrank all other construction (build Job within-tier priority).
- Deprecation, not deletion: once in the Specialist era, no new Generalist is ever queued, but living Generalists keep executing their existing Contracts until they die naturally — no kill or reassignment code. Full transition to an all-Specialist workforce should complete within roughly one Creep lifetime (~1,500 Ticks) with no energy drought.
- At Evolution, the mine Producer activates (posts exactly one Reserved mine Job per Source, `mine:<sourceId>`, persistent, Body = Harvester) and Spawn Management switches to issuing Specialist Bodies (Harvester for mine vacancies, Collector for delivery demand).
- Each Source has exactly one Reserved mine slot at MVP scale; each vacancy is independently detected and refilled via spawn (not Matching).
- Reserved mine Jobs are never offered to idle Creeps through Matching — filled only by Spawn Management writing the Contract into initial Creep memory at spawn time.
- Harvester: source-locked for its entire life — travels to its one Source once, harvests, transfers into the adjacent Container, waits out Source regen and full-Container conditions, and never enters Matching again. Its Contract ends only with death. A depleted Source or full Container does not invalidate the Contract (FR-9's explicit persistent-Job exception).
- Collector: CARRY/MOVE-heavy Body with exactly one WORK part (the minimum needed for build/upgrade); serves fill/build/upgrade Pulled Contracts; sources exclusively by withdrawing from Containers, never harvests from a Source; when no Container has energy it waits near its supply point rather than draining Spawn reserves (wait threshold lives in config.ts).
- Graceful degradation: if Evolution conditions cease to hold post-Evolution (e.g. a Container is destroyed), spawn policy reverts to Generalists within one Tick; living Specialists keep their Contracts; the missing Container is rebuilt with Container-first priority; the colony re-evolves automatically once conditions hold again. A full Memory wipe mid-degradation cannot strand the colony in the wrong era, since era is never persisted.
- Container construction sites are placed manually by the operator at MVP — automated base-layout placement is explicitly post-MVP.
- Spawn priority ordering (from Epic 5, now live with real data): (1) vacant Reserved mine slots, (2) demand pressure, (3) general population top-up — a vacant mine slot wins over Collector demand and top-up.
- MVP exit criterion (SM-1): from a fresh room to a fully-Specialist colony with the operator only placing Container sites once, Sources containerized, Controller continuously upgrading throughout.
- No stalled economy (SM-3): while any Creep lives and any Job is open, no Creep stands idle without a Contract, over any rolling 1,000-Tick window.
- CPU discipline (NFR-1, SM-C1) applies through the Evolution transition spike — sustained average CPU/Tick must stay comfortably under the account limit even during transition.

## Technical Decisions

- Era is computed as a pure function of world state (RCL, Extensions, Containers) inside `world/`'s per-Tick snapshot and exposed as a snapshot field — no Memory key for era exists anywhere (AD-5). Recomputed fresh every Tick.
- Module boundaries (AD-1) hold: adding the mine Producer must not require editing any existing Producer file. World writes the Board; only `control/` sets Contracts (including at spawn time via initial memory, per AD-2); validators only clear.
- Board/Job discipline (AD-3): the mine Job is `mine:<sourceId>`, Reserved assignment mode, persistent lifetime class, requirements = Harvester Body — one Job per Source, never aggregated.
- Matching discipline (AD-7): within-tier priority for the Container-first build Job comes from the policy table as data, not special-cased code — Container site priority beats a nearer ordinary site purely through tier/priority-then-distance ordering already built in Story 3.4.
- Reserved-slot spawning bypasses Matching entirely: `control/spawn` detects the vacant Reserved Job and issues `spawnCreep` with the Contract written into the Creep's initial memory (AD-2) — the Creep never enters the Matching path.
- Body compositions for Harvester (WORK-heavy) and Collector (CARRY/MOVE-heavy, exactly one WORK part) are added to the typed `config.ts` Body compositions table alongside the existing Generalist entry; affordability checks (never exceed energyAvailable) apply unchanged.
- Taken-set derivation (Story 3.2) already accounts for Spawning Creeps' Contracts, which is what prevents double-spawning into the same Reserved mine slot.
- Degradation is not new code — it falls out of era being re-derived every Tick from live world state rather than persisted; the same spawn-policy and Container-first-construction logic that drives Evolution forward drives it backward when the Container disappears.

## Cross-Story Dependencies

- Story 6.2 (mine Producer) depends on 6.1 (era on the snapshot) to gate its emission.
- Story 6.3 (Container-first construction) reuses the existing build Producer and Matching (Story 3.4) — it is a policy-table/priority change, not new matching logic.
- Story 6.4 (Reserved-slot spawning) depends on 6.2 (mine Jobs existing) and on Epic 5's spawn priority-ordering machinery (Story 5.4), which fabricated Reserved-vacancy demand ahead of this epic so it now has real data.
- Stories 6.5 (Harvester behavior) and 6.6 (Collector behavior) depend on 6.4 issuing Bodies and Contracts correctly, and reuse the Epic 4 behavior frame and sourcing/movement conventions (AD-1, AD-4, AD-8).
- Story 6.7 (deprecation/degradation) depends on all of 6.1–6.6 being in place: it exercises the full forward-and-backward era transition across Producers, spawn policy, and living Creep populations.
- Story 6.8 (MVP exit observation) is the final acceptance pass over the entire epic (and implicitly the whole MVP) and depends on every prior story in Epic 6 being complete.

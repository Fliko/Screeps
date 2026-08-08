---
title: screeps_ai — Autonomous Colony AI for Screeps: World
status: final
created: 2026-08-07
updated: 2026-08-07
---

# PRD: screeps_ai

## 0. Document Purpose

- **Audience:** the author (Fliko — sole PM, designer, implementer) and the downstream BMad workflows that consume this PRD (architecture, epics/stories, dev).
- **Source input:** `input/perplexity_thread.md` (path relative to project root; original thread: <https://www.perplexity.ai/computer/tasks/scheduling-jobs-with-costly-ta-InESFIJnQYmcbpxZLBx2iw>) — a requirements discussion on non-preemptive scheduling applied to Screeps, extracted here, not duplicated.
- **Game target:** Screeps: **World**. Screeps: Arena is a different game with a different API and is not targeted.
- **Conventions:** vocabulary is anchored in the Glossary (§3); FRs carry globally stable IDs; assumptions are tagged inline and indexed in §9; deferred items are tagged `(→ §6.2 Phase N)`.
- **Constraint:** the author directs and reviews all code — AI codegen is in scope (stories are implemented via the dev workflow), but **the agent never commits**: the human reviews every diff and owns every commit. *(Amended 2026-08-07: the original no-codegen constraint was reversed to exercise the AI-codegen half of the workflow.)*

## 1. Vision

**screeps_ai** is an autonomous colony AI for Screeps: World. It runs a colony unattended — creeps harvest, build, supply, and upgrade without a single hard-coded role, coordinated through a job board: the world posts work, idle creeps pull contracts, and assignment is sticky and non-preemptive because switching tasks is what kills colonies. The architecture is built to evolve: generalists give way to specialists, and later to haulers, remote mining, and beyond — new strategy plugs in, the engine is never rewritten.

The bot is also a deliberate learning vehicle. Every concept it embodies — blackboard scheduling, capacity reservation, backfill, TTL-aware assignment — is designed at the concept level and implemented under the author's direction. The process is production-grade on purpose: a real PRD, real architecture, small reviewable features, no vibe-coded mush. AI writes the code; the human directs, reviews every diff, and owns every commit.

Success shows up on two scoreboards. In game: the bot climbs to the **top of the shard leaderboard** and stays there, unattended, through evolutions that would stall lesser colonies. Out of game: an engineer who can point at a running, evolving system and truthfully say *"I designed and directed every piece of that myself."*

## 2. Target User

The target user is the author — a software engineer building this as a deliberate practice project. There is no second audience in v1.

### 2.1 Jobs To Be Done

- **JTBD-1 (professional):** *When I practice this project's process* (PRD → architecture → small reviewable features), *I want it to feel like production work* — so the discipline transfers to my day job.
- **JTBD-2 (emotional / proof):** *When I look at the shard leaderboard, I want proof at the top* that what I designed and directed actually works.

### 2.2 Non-Users (v1)

- Other players looking for a plug-and-play bot to download and run. `[ASSUMPTION: not explicitly confirmed by the author — declared to bound v1; revisit if distribution ever becomes a goal.]`

*§2.3 Key User Journeys intentionally omitted: single operator, no UI surface. The operator's dev loop (design → implement → deploy → watch → tune) is carried by the FRs and the process constraints instead.*

## 3. Glossary

*All FRs, SMs, and downstream artifacts use these terms exactly. No synonyms.*

- **Tick** — The game's atomic time unit; all bot logic re-runs each Tick.
- **Creep** — A worker unit. Has a Body and a TTL.
- **Body** — A Creep's part composition (WORK, CARRY, MOVE, …); determines which Jobs the Creep can fulfill.
- **TTL** — Ticks-to-live: a Creep's remaining lifespan (~1,500 Ticks). Creeps die at 0; low TTL is penalized in assignment scoring.
- **Spawn** — The structure that builds Creeps. Acts as the colony's capacity reservoir and owns the spawn queue.
- **Source** — An energy node. Regenerates every 300 Ticks; has limited access tiles; the economy's input.
- **Container** — Passive storage placed adjacent to a Source. Enables Specialists: a Harvester drops energy in, a Collector picks it up.
- **Controller** — The room's progression structure; upgrading it is the Backfill Job.
- **RCL (Room Controller Level)** — The Controller's level; gates progression (5 Extensions unlock at RCL2).
- **GCL (Global Control Level)** — The player's shard-wide progression level, grown by upgrading Controllers; the axis the shard leaderboard ranks (SM-2).
- **Extension** — Energy-storage structure feeding the Spawn. Filling Spawn + Extensions is the critical-priority Job.
- **Job Board** — The shared registry of open Jobs, recomputed each Tick as a derived projection of world state. Never persisted.
- **Job** — A unit of work bound to a target object, defined by the action it requires. Job types: mine, fill, build, upgrade — the Board posts *needs only*; sourcing is folded into Creep behavior, so there are no collect or compound mine-and-collect Job types. Carries: id, type, target, Priority Tier, max workers, assignment mode, lifetime class, and requirements.
- **Contract** — The binding of a Creep to a Job. Stored in the Creep's memory; sticky and non-preemptive; ends on completion, invalidation, or Creep death.
- **Producer** — A per-Tick scan of world state that emits Jobs of one type.
- **Priority Tier** — The global Job ordering: critical > high > medium > low.
- **Backfill** — The infinitely available, lowest-tier Job (Controller upgrade) that absorbs idle capacity.
- **Reserved Job** — A supply-managed Job filled proactively at spawn time (mine slots). Counterpart of Pulled Job.
- **Pulled Job** — A demand-driven Job claimed by an idle Creep via scoring. Counterpart of Reserved Job.
- **Generalist** — A balanced WORK/CARRY/MOVE Body; fulfills any Pulled Job, sourcing energy by harvesting (FR-19); the MVP-era default.
- **Specialist** — A Body optimized for one Job class. MVP Specialists: Harvester, Collector.
- **Harvester** — A WORK-heavy Specialist that fulfills mine Jobs; source-locked for its whole life; drops energy to its Container.
- **Collector** — A CARRY/MOVE-heavy Specialist with a single WORK part (the minimum enabling build and upgrade); fulfills delivery Jobs (fill, build, upgrade), sourcing energy from Containers instead of harvesting.
- **Hauler** — A post-MVP Specialist variant that moves energy from storage to towers and remote targets. *(Roadmap term.)*

## 4. Features

### 4.1 Job Board

**Description:** The Job Board is the colony's single source of truth about work — a registry of open Jobs, rebuilt from live world state every Tick by independent Producers. It is never persisted. The world is the truth; the Board is a projection. This is what makes the colony self-healing: a Creep dying mid-Contract needs no cleanup code — the unmet need simply reappears as a Job next Tick. Serves JTBD-2 (unattended operation).

**Functional Requirements:**

#### FR-1: Per-Tick regeneration

The system regenerates the complete set of open Jobs every Tick as a pure function of current world state.

**Consequences (testable):**
- A construction site that disappears (completed or removed) has no build Job on the Board the following Tick — with no explicit removal logic.
- Wiping the bot's persisted memory loses no Job information; the Board is identical on the next Tick.

#### FR-2: Independent Producers

Each Job type is emitted by its own Producer — a self-contained scan of world state (Sources → mine Jobs; construction sites → build Jobs; Spawn/Extensions below capacity → fill Jobs; Controller → upgrade Job).

**Consequences (testable):**
- A new Job type can be introduced by adding one Producer without modifying any existing Producer.
- Disabling a single Producer removes exactly its Job type from the Board and no others.

#### FR-3: Deterministic Job identity

Every Job has an id derived deterministically from its type and target, stable across Ticks.

**Consequences (testable):**
- The same unmet need on two consecutive Ticks yields the same Job id.
- A Contract (§4.2) can reference a Job by id and re-validate it against the current Tick's Board.

#### FR-4: Complete Job metadata

Every Job carries: type, target (object id + position), Priority Tier, max workers, assignment mode (Reserved or Pulled), lifetime class (persistent or transient), and requirements (Body and TTL floors).

**Consequences (testable):**
- Matching (§4.3) and Spawn Management (§4.4) operate on any Job without type-specific logic.
- A Job whose requirements exclude a Creep's Body or TTL is never offered to that Creep.

#### FR-5: Capacity-limited availability

The Board knows, each Tick, how many active Contracts each Job holds, and stops offering a Job once it reaches its max workers (1 for build/fill; access-tile count for mine; unlimited for upgrade-as-Backfill).

**Consequences (testable):**
- A max-1 Job is never held by two Creeps at once.
- The upgrade Job is always available to any number of idle Creeps.

#### FR-6: Assignment-mode separation

Reserved Jobs (mine slots) are fillable only through Spawn Management and are never offered to idle Creeps; Pulled Jobs are fillable only by idle Creeps.

**Consequences (testable):**
- An idle Creep's query never returns a Reserved Job, even when a Source has no Harvester.
- A Reserved vacancy is visible to Spawn Management on the Tick it opens.

**Notes:**
- The active Producer set is era-dependent: in the Generalist era the Board posts fill / build / upgrade (sourcing is folded into Creep behavior); the mine Producer activates at Evolution (§4.6) emitting Reserved Jobs.

### 4.2 Contract Lifecycle

**Description:** A Contract binds one Creep to one Job. Contracts are the *only* scheduling state the colony persists — each lives in its own Creep's memory — and they are sticky: a working Creep is never reassigned, only re-validated. New work is pulled at exactly one moment in a Creep's life: when it is idle. A Contract ends in exactly three ways: the Job completes, the Contract fails validation, or the Creep dies.

**Functional Requirements:**

#### FR-7: Exclusive sticky binding

A Creep holds at most one Contract, and the system never reassigns a Creep while its Contract is valid.

**Consequences (testable):**
- A Creep mid-Contract keeps its target across Ticks even when a higher-priority Job appears.
- No code path reassigns a working Creep during normal operation.

#### FR-8: Contract persistence in Creep memory

Each Contract is stored in its own Creep's memory and survives across Ticks; the Contract is the sole unit of scheduling persistence.

**Consequences (testable):**
- A Creep resumes its Contract after a code deploy within the same life.
- A Creep's death destroys its Contract with it — no orphaned claims exist; the unmet need re-emerges via FR-1.

#### FR-9: Per-Tick validation

Each Tick, every Contracted Creep validates its Contract against current world state: target exists, target still needs work, Creep still capable, TTL sufficient. Validation rules are type-specific.

**Consequences (testable):**
- A finished construction site releases its builder on the same Tick it completes.
- A filled Extension releases its filler; the Creep becomes idle immediately.
- A depleted Source does **not** invalidate a mine Contract — a Harvester waits out the 300-Tick regen rather than abandoning its Source.

#### FR-10: Idle-only assignment

A Creep pulls a new Contract only when it holds no valid Contract.

**Consequences (testable):**
- A newly spawned or just-released Creep enters Matching (§4.3) on its idle Tick — and only then.

**Out of Scope (MVP):**
- **Emergency / cost-based preemption** — excluded by decision; stickiness is absolute in MVP, and Spawn starvation is addressed through capacity reservation (§4.4) and idle-first dispatch. Revisited post-MVP (→ §6.2 Phase 3).

### 4.3 Job Matching

**Description:** Matching is the colony's dispatch brain — the single place where idle Creeps meet open Pulled Jobs. MVP scoring follows the thread's "easier to reason about and tune" advice: **lexicographic ordering** — Priority Tier first, travel cost second, TTL-aware — rather than the full weighted formula. And because the bot's code runs sequentially within a Tick, a simple claim lock defeats the thundering herd.

**Functional Requirements:**

#### FR-11: Tier-first matching

An idle Creep is assigned an available Pulled Job from the highest Priority Tier with open capacity; within a tier, the Job with the lowest travel cost *for that Creep* wins.

**Consequences (testable):**
- A critical fill Job across the room is chosen over a medium build Job next door.
- Of two eligible Jobs in the same tier, the nearer one is chosen.

#### FR-12: TTL-aware matching

A Creep is never assigned a Job whose TTL floor exceeds its remaining life, and among eligible Jobs, Matching prefers work the Creep can plausibly reach and serve within its life.

**Consequences (testable):**
- A near-death Creep is never dispatched on a long journey.
- A full-life Creep remains eligible for distant or long Jobs.

#### FR-13: Within-Tick claim lock

Each assignment reduces the Board's availability immediately, within the same Tick, before the next idle Creep is matched.

**Consequences (testable):**
- N Creeps going idle on the same Tick receive N distinct Jobs (when N are available).
- A max-1 Job is claimed at most once per Tick, no matter how many Creeps go idle simultaneously.

**Notes:**
- The thread's weighted scoring formula — `score = priority − k·distance − TTL penalty` — and its tuning knobs are deferred post-MVP (→ §6.2 Phase 3). MVP's lexicographic rule is a deliberate simplification, not an oversight.

### 4.4 Spawn Management

**Description:** The Spawn is the colony's capacity reservoir — the factory that keeps the worker pool topped up so bursts of critical work always find a Creep without touching the economy's floor. It watches population, anticipates deaths, fills Reserved mine slots directly, and spends every spawn on the most critical vacancy first.

**Functional Requirements:**

#### FR-14: Population maintenance

The system maintains a target Creep population; when living plus in-progress Creeps fall below target, it queues a replacement.

**Consequences (testable):**
- After a Creep dies, a replacement is queued with no manual intervention.
- The colony returns to target population after losses.

#### FR-15: Proactive replacement

The system anticipates death: a Creep whose TTL drops below a replacement threshold triggers its own replacement in the spawn queue *before* it dies.

**Consequences (testable):**
- A vacancy caused by old age is already being filled when it opens.
- A Harvester's replacement is bound to its Source at spawn time (via FR-16), so a Source never sits unattended longer than spawn + travel time.

#### FR-16: Reserved-slot spawning

When a Reserved Job (mine slot) is vacant, the system spawns the appropriate Specialist and writes its Contract at spawn time — the Creep is pre-allocated and never enters Matching for that role.

**Consequences (testable):**
- A Source without a Harvester triggers a Harvester spawn bound to that Source.
- A Reserved-slot Creep's first Contract exists before it takes its first step.

#### FR-17: Spawn priority ordering

The spawn queue spends energy on the most critical vacancy first: (1) vacant Reserved mine slots, (2) demand pressure (e.g. Collectors below minimum), (3) general population top-up.

**Consequences (testable):**
- With one spawn's worth of energy and both a vacant mine slot and a missing Collector, the Harvester is queued first.
- In the Generalist era, only rule (3) is active.

#### FR-18: Body selection

Every spawn request specifies a Body matched to the Job class it will serve — balanced Generalist in the Generalist era; WORK-heavy Harvester or CARRY/MOVE-heavy Collector post-Evolution — and within current energy capacity.

**Consequences (testable):**
- The Spawn never queues a Body the colony cannot afford.
- A post-Evolution spawn is never a Generalist (§4.6 deprecation).

**Notes:**
- Principled pool sizing (how many Collectors per Source, container-fill-driven demand — the thread's Erlang-C intuition) is deferred post-MVP (→ §6.2 Phase 3). MVP uses fixed minimums.
- **MVP constants are pinned at architecture time, as configuration values** — target population (FR-14), Collector minimums (FR-17), TTL replacement threshold (FR-15), per-Job TTL floors (FR-4). The PRD deliberately invents no numbers; these become the first entries of the configurable-strategy surface (§6.2 Phase 3).

### 4.5 Generalist Economy

**Description:** The Generalist era is the MVP bootstrap: every Creep is a balanced Generalist executing Pulled Jobs — fill, build, upgrade — and sourcing its own energy along the way. Because every Contract begins with "harvest if empty," the Sources get drained *without* a standalone harvest Job, and the Controller Backfill guarantees that continues even when nothing needs filling or building.

**Functional Requirements:**

#### FR-19: Self-sourcing execution

A Contracted Generalist sources its own energy: when empty it harvests from a Source; when carrying, it serves its Contract's target.

**Consequences (testable):**
- A Generalist with an empty carry and a build Contract harvests before building — no separate dispatch required.
- Energy income continues whenever any Creep holds any Contract.

#### FR-20: Job execution fidelity

A Contracted Generalist performs the game action its Job type names, on the Job's target, until the Contract ends: transfer for fill, build for build, upgrade for upgrade.

**Consequences (testable):**
- Fill Contracts raise Spawn/Extension stored energy until full.
- Build Contracts progress sites to completion; upgrade Contracts raise Controller progress.

#### FR-21: Backfill default

The upgrade Job is always posted, unlimited workers, lowest Priority Tier; any Generalist with no better Job upgrades the Controller.

**Consequences (testable):**
- No Generalist stands idle while it can carry energy to the Controller.
- Controller progress continues through lulls in fill/build demand — and, via FR-19, Sources keep draining even then: the economy never sleeps.

#### FR-22: Priority tier policy

Tier assignments by Job type: **fill = critical, build = medium, upgrade = low (Backfill)**. The *high* tier is held open for future Job types (post-MVP).

**Consequences (testable):**
- With fill and build Jobs both open, idle Generalists fill first (via FR-11).
- Changing a Job type's tier is a one-place policy change — not scattered through Producers.

**Notes:**
- The thread's "high = harvest with a protected floor" tier intentionally has no Job in the Generalist era: under needs-only, the floor is *expressed* as self-sourcing + Backfill (every Contract drains Sources; the Backfill makes that perpetual). Post-Evolution the floor returns explicitly as Reserved mine slots (FR-16).

### 4.6 Evolution

**Description:** Evolution is the colony's graduation from Generalists to Specialists — deprecation, not deletion. When the world shows the colony is ready, the system stops queueing Generalists, activates the mine Producer, and lets the existing workforce age out naturally. No hard cutover, no energy drought — the transition rides the spawn queue over roughly one Creep lifetime.

**Functional Requirements:**

#### FR-23: Evolution trigger detection

The system continuously detects when all three Evolution conditions hold: **RCL ≥ 2, all 5 Extensions built, and a Container adjacent to every Source.**

**Consequences (testable):**
- The trigger is derived from world state — no manual flag is set.
- Evolution begins on the Tick the conditions first all hold.

#### FR-24: Container-first construction

Once RCL2 is reached, building Source-adjacent Containers outranks all other construction.

**Consequences (testable):**
- With a Container site and any other site both open, the Container is built first.

#### FR-25: Deprecation, not deletion

At Evolution, the system stops queueing Generalist spawns; living Generalists keep executing Contracts until they die naturally.

**Consequences (testable):**
- No Generalist is killed or reassigned early at Evolution.
- The workforce is fully Specialist within roughly one Creep lifetime (~1,500 Ticks) with no energy drought.

#### FR-26: Specialist activation

At Evolution, the mine Producer activates — posting one Reserved mine Job per Source — and Spawn Management switches to Specialist Bodies (Harvester for mine slots, Collectors for demand) per FR-17/FR-18.

**Consequences (testable):**
- Each Source gains a source-locked Harvester as spawn capacity allows.
- Collectors begin serving delivery Contracts, sourcing from Containers.

#### FR-27: Derived era with graceful degradation

The era is re-derived from world state every Tick — never persisted. *(Amended during architecture: the author requires the colony to degrade under attack rather than trust a remembered era.)* When the Evolution conditions cease to hold post-Evolution — e.g. a destroyed Source Container — the colony degrades to the Generalist era: spawn policy reverts, living Specialists keep their Contracts, and the missing Container is rebuilt with Container-first priority (FR-24).

**Consequences (testable):**
- Destroying a Source Container post-Evolution reverts spawn policy to Generalists within one Tick.
- Rebuilding the Container re-triggers Evolution with no operator action (FR-23).
- No era state exists in Memory; a full Memory wipe cannot strand the colony in the wrong era.

**Notes:**
- Container construction sites are placed **manually by the operator** in MVP. Automated placement — base-layout planning that anticipates future walls, ramparts, and defensive strategy — is post-MVP; see OQ-1 (§8).
- Beyond MVP, the same pattern extends without rewrite — new Job types and new rooms plug into the same engine (→ §6.2).

### 4.7 Specialist Economy

**Description:** Post-Evolution, the colony runs on body economics: every Body packs only the parts its Job class needs, so each unit of spawn energy buys more useful work. The Harvester is the extreme case — source-locked for life, Contract duration equals Creep lifetime, zero switching. The MVP Collector is a pragmatic hybrid: CARRY/MOVE-heavy with a single WORK part, so one class can fill, build, and upgrade while sourcing from Containers.

**Functional Requirements:**

#### FR-28: Harvester source-lock

A Harvester is bound to one Source's Reserved mine Job for its entire life: it travels to the Source once, harvests, and transfers energy into the Source's Container — waiting out both Source regen and a full Container.

**Consequences (testable):**
- A Harvester never enters Matching after spawn (FR-16); its Contract ends only with its death.
- A Source's Container fills whenever its Harvester lives.

#### FR-29: Source coverage

Each Source has exactly one Reserved mine slot — one Harvester per Source at MVP scale (RCL3+ may raise this).

**Consequences (testable):**
- A colony with N Sources posts exactly N Reserved mine Jobs.
- Each vacancy is independently detected and refilled (FR-16).

#### FR-30: Hybrid Collector execution

A Collector executes Pulled Contracts — fill, build, and upgrade — sourcing energy by withdrawing from Containers, never harvesting. Its Body is CARRY/MOVE-heavy with exactly one WORK part: the minimum that makes build and upgrade physically possible.

**Consequences (testable):**
- A Collector never harvests from a Source; an empty Collector withdraws from a Container before serving its Contract.
- One Collector class serves all three Pulled Job types post-Evolution.
- A Collector can always build and upgrade, at single-WORK-part rate.

**Notes:**
- **Why hybrid (decision):** `build` and `upgradeController` require WORK parts, so a pure CARRY/MOVE courier cannot serve all Pulled Jobs. MVP answer: one WORK part per Collector. Post-MVP (strategy & tuning phase): split into pure couriers plus dedicated WORK-capable Specialists (Builder, Upgrader) sourcing from Containers — the thread's full body economics (→ §6.2 Phase 3).

### 4.8 Cross-Cutting NFRs

System-wide qualities, not tied to a single feature:

- **NFR-1: CPU discipline per Tick.** Working Creeps run only their validation check; only idle Creeps run Matching; the Board and taken-set are computed once per Tick and shared; travel costs are approximated or cached rather than re-pathed every Tick. *Testable:* sustained average CPU/Tick stays comfortably under the account limit — including during the Evolution transition spike.
- **NFR-2: Bounded persisted state.** Only Creep-level state persists — the Contract and small movement-helper state per Creep. No colony-level state is persisted, and the Board is never persisted. *Testable:* Memory footprint stays flat over long unattended runs — no unbounded growth.
- **NFR-3: Self-healing under disruption.** The colony recovers with no operator action from individual Creep deaths, full Memory wipes, code deploys, and Container loss. *Testable:* after a full Memory wipe, every living Creep holds a valid Contract again within a few Ticks (via FR-9/FR-10).
- **NFR-4: Runtime fit.** Everything runs inside the Screeps runtime — real JavaScript, single-threaded per-Tick execution, JSON-serialized Memory, CPU limit + bucket. No external services, no off-platform compute. *Testable:* deploys and runs unmodified on the official World shard; iteration happens in the official simulation room.

**Notes:**
- An inspectability/observability NFR (console or room-visual dashboards of Jobs, Contracts, spawn queue) was proposed and **rejected**: the operator inspects Memory directly in MVP. Revisit at the strategy-and-tuning phase if manual inspection becomes the bottleneck.

## 5. Non-Goals (Explicit)

- **Not a plug-and-play bot for other players** (§2.2). Single author, single audience.
- **No combat or defense in v1** — no towers, no military creeps, no retaliation logic. Deferred to the military/expansion phase.
- **No multi-room play** — no claiming new rooms, no remote mining, no scouts. Deferred to the expansion phase.
- **No automated construction placement** — the operator places all sites manually (OQ-1).
- **No emergency / cost-based preemption** (§4.2) — deferred to the configurable-strategy phase.
- **No weighted scoring, knobs-as-config, or Erlang-C pool sizing** — deferred to the configurable-strategy phase.
- **No pure-courier specialist split** — Builder/Upgrader classes are post-MVP (§4.7).
- **No Haulers or tower/storage logistics** — the RCL3/4 evolution step.
- **No market trading, no power creeps** — not considered for v1.
- **No custom observability tooling** — manual Memory inspection suffices (§4.8).

## 6. MVP Scope

### 6.1 In Scope

- One room, one Spawn, on the official World shard (iterated in the official simulation room).
- The scheduling engine: Job Board (FR-1–FR-6), Contract Lifecycle (FR-7–FR-10), Job Matching (FR-11–FR-13), Spawn Management (FR-14–FR-18).
- The Generalist-era economy (FR-19–FR-22).
- Evolution to Specialists (FR-23–FR-27), with operator-placed Container sites.
- The Specialist economy (FR-28–FR-30).
- Cross-cutting NFRs 1–4.

**MVP exit criterion:** Evolution completes unattended — after the operator places Container sites once, the colony reaches a fully-Specialist workforce with zero further intervention, Sources containerized, Controller upgrading.

### 6.2 Out of Scope for MVP

Roadmap phases in intended order:

- **Phase 2 — Continued RCL progression:** RCL3+ Extensions (filled and built engine-natively via the derived Board), Body upscaling with energy capacity, 2 Harvesters per Source, tower/storage logistics (Haulers). *Deferred: the MVP proves the engine at RCL2 scale first.*
- **Phase 3 — Configurable strategy** *(the author's named roadmap goal)*: weighted scoring formula and tuning knobs as configuration, Erlang-C-guided pool sizing, demand-responsive population targets (burst anticipation — e.g. raise the worker limit when the Controller nears upgrade), emergency-preemption policy, pure-courier + Builder/Upgrader split. *Deferred: tuning needs a running MVP to tune.*
- **Phase 4 — Military & expansion:** towers and defense, combat creeps, multi-room claiming, remote mining, automated base layout (OQ-1). *Deferred: shard domination is the north star, not the starting move.*
- **Not yet considered:** market trading, power creeps, custom observability tooling (rejected for MVP — §4.8).

## 7. Success Metrics

**Primary**
- **SM-1: MVP exit, unattended.** From a fresh room to a fully-Specialist colony with the operator acting only to place Container sites once. *Validates FR-23–FR-30, NFR-3.*
- **SM-2 (north star): top of the shard leaderboard.** Long horizon; the MVP milestone is establishing visible GCL progression. *Validates the Vision.* `[ASSUMPTION: leaderboard = the game's shard-wide player ranking; exact rank target is set at the strategy-and-tuning phase.]`

**Secondary**
- **SM-3: no stalled economy.** While any Creep lives and any Job is open, no Creep stands idle without a Contract, over any rolling 1,000-Tick window. *Validates FR-21.*
- **SM-4: learning transfer.** Every shipped feature maps to a concept the author can explain unaided; self-assessed at each feature review. *Serves JTBD-1.*

**Counter-metrics (do not optimize)**
- **SM-C1: CPU per Tick.** Never chase SM-2/SM-3 by burning CPU — sustained average stays under the account limit with headroom (NFR-1). *Counterbalances SM-2.*
- **SM-C2: process integrity.** Never chase SM-1 velocity by skipping the pipeline — every feature lands via PRD → architecture → small reviewable stories. *Counterbalances SM-1; serves JTBD-1.*

## 8. Open Questions

1. **OQ-1: Automated base layout.** Can the bot auto-place construction sites (Containers now; walls, ramparts, towers, storage later) with a layout that anticipates future defensive strategy? Needs ideation. Placement is manual by the operator in MVP. *(Post-MVP; feeds the configurable-strategy roadmap.)*

## 9. Assumptions Index

*Every `[ASSUMPTION]` from the document, surfaced for explicit confirmation:*

- **§2.2 — Non-user boundary.** "Not for players seeking a plug-and-play bot" was declared by the facilitator to bound v1, not explicitly confirmed by the author. *Low risk — confirm or strike.*
- **§7 / SM-2 — Leaderboard definition.** "Top of the shard leaderboard" means the game's shard-wide player ranking; the exact rank target is deferred to the strategy-and-tuning phase.

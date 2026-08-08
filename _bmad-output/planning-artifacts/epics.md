---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments: [_bmad-output/planning-artifacts/prds/prd-screeps_ai-2026-08-07/prd.md, _bmad-output/planning-artifacts/prds/prd-screeps_ai-2026-08-07/addendum.md, _bmad-output/planning-artifacts/architecture/architecture-screeps_ai-2026-08-07/ARCHITECTURE-SPINE.md]
---

# screeps_ai - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for screeps_ai, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR-1: Per-Tick regeneration — the system regenerates the complete set of open Jobs every Tick as a pure function of current world state.
FR-2: Independent Producers — each Job type is emitted by its own Producer, a self-contained scan of world state.
FR-3: Deterministic Job identity — every Job has an id derived deterministically from its type and target, stable across Ticks (grammar `type:targetId`).
FR-4: Complete Job metadata — every Job carries type, target (object id + position), Priority Tier, max workers, assignment mode (Reserved or Pulled), lifetime class (persistent or transient), and requirements (Body and TTL floors).
FR-5: Capacity-limited availability — the Board knows each Tick how many active Contracts each Job holds and stops offering a Job once it reaches its max workers.
FR-6: Assignment-mode separation — Reserved Jobs (mine slots) are fillable only through Spawn Management and are never offered to idle Creeps; Pulled Jobs are fillable only by idle Creeps.
FR-7: Exclusive sticky binding — a Creep holds at most one Contract, and the system never reassigns a Creep while its Contract is valid.
FR-8: Contract persistence in Creep memory — each Contract is stored in its own Creep's memory and survives across Ticks; the Contract is the sole unit of scheduling persistence.
FR-9: Per-Tick validation — each Tick, every Contracted Creep validates its Contract against current world state (target exists, still needs work, Creep capable, TTL sufficient) with type-specific rules; invalid Contracts are cleared immediately.
FR-10: Idle-only assignment — a Creep pulls a new Contract only when it holds no valid Contract.
FR-11: Tier-first matching — an idle Creep is assigned an available Pulled Job from the highest Priority Tier with open capacity; ordering within the Board is governed by AD-7: tier, then within-tier priority, then lowest travel cost for that Creep.
FR-12: TTL-aware matching — a Creep is never assigned a Job whose TTL floor exceeds its remaining life; Matching prefers work the Creep can plausibly reach and serve within its life.
FR-13: Within-Tick claim lock — each assignment reduces the Board's availability immediately, within the same Tick, before the next idle Creep is matched.
FR-14: Population maintenance — the system maintains a target Creep population; when living plus in-progress Creeps fall below target, it queues a replacement.
FR-15: Proactive replacement — a Creep whose TTL drops below a replacement threshold triggers its own replacement in the spawn queue before it dies.
FR-16: Reserved-slot spawning — when a Reserved Job (mine slot) is vacant, the system spawns the appropriate Specialist and writes its Contract at spawn time; the Creep never enters Matching for that role.
FR-17: Spawn priority ordering — spawn energy goes to the most critical vacancy first: (1) vacant Reserved mine slots, (2) demand pressure (e.g. Collectors below minimum), (3) general population top-up.
FR-18: Body selection — every spawn request specifies a Body matched to the Job class it will serve (balanced Generalist; WORK-heavy Harvester; CARRY/MOVE-heavy Collector with exactly one WORK part) and within current energy capacity.
FR-19: Self-sourcing execution — a Contracted Generalist sources its own energy: when empty it harvests from a Source; when carrying, it serves its Contract's target.
FR-20: Job execution fidelity — a Contracted Generalist performs the game action its Job type names, on the Job's target, until the Contract ends: transfer for fill, build for build, upgrade for upgrade.
FR-21: Backfill default — the upgrade Job is always posted, unlimited workers, lowest Priority Tier; any Generalist with no better Job upgrades the Controller.
FR-22: Priority tier policy — tier assignments by Job type: fill = critical, build = medium, upgrade = low (Backfill); the high tier is held open for post-MVP; changing a Job type's tier is a one-place policy change.
FR-23: Evolution trigger detection — the system continuously detects when all three Evolution conditions hold: RCL >= 2, all 5 Extensions built, and a Container adjacent to every Source; the trigger is derived from world state.
FR-24: Container-first construction — once RCL2 is reached, building Source-adjacent Containers outranks all other construction.
FR-25: Deprecation, not deletion — at Evolution, the system stops queueing Generalist spawns; living Generalists keep executing Contracts until they die naturally.
FR-26: Specialist activation — at Evolution, the mine Producer activates (one Reserved mine Job per Source) and Spawn Management switches to Specialist Bodies per FR-17/FR-18.
FR-27: Derived era with graceful degradation — the era is re-derived from world state every Tick, never persisted; when Evolution conditions cease to hold, the colony degrades to the Generalist era (spawn policy reverts, living Specialists keep Contracts, the missing Container is rebuilt with Container-first priority).
FR-28: Harvester source-lock — a Harvester is bound to one Source's Reserved mine Job for its entire life: travels to the Source once, harvests, and transfers energy into the Source's Container, waiting out both Source regen and a full Container.
FR-29: Source coverage — each Source has exactly one Reserved mine slot (one Harvester per Source at MVP scale).
FR-30: Hybrid Collector execution — a Collector executes Pulled Contracts (fill, build, upgrade), sourcing energy by withdrawing from Containers, never harvesting; its Body is CARRY/MOVE-heavy with exactly one WORK part.

### NonFunctional Requirements

NFR-1: CPU discipline per Tick — working Creeps run only their validation check; only idle Creeps run Matching; the Board and taken-set are computed once per Tick and shared; travel costs are approximated or cached rather than re-pathed every Tick. Sustained average CPU/Tick stays comfortably under the account limit, including during the Evolution transition spike.
NFR-2: Bounded persisted state — only Creep-level state persists (the Contract and small movement-helper state per Creep); no colony-level state is persisted; the Board is never persisted. Memory footprint stays flat over long unattended runs.
NFR-3: Self-healing under disruption — the colony recovers with no operator action from individual Creep deaths, full Memory wipes, code deploys, and Container loss; after a full Memory wipe every living Creep holds a valid Contract again within a few Ticks.
NFR-4: Runtime fit — everything runs inside the Screeps runtime: real JavaScript, single-threaded per-Tick execution, JSON-serialized Memory, CPU limit + bucket; no external services or off-platform compute; deploys and runs unmodified on the official World shard; iteration happens in the official simulation room.

### Additional Requirements

From the Architecture Spine (AD-1..AD-10, conventions, stack — binding on every story):

- **Toolchain scaffold (Epic 1 Story 1 material — hand-rolled, no starter):** Node 24 LTS toolchain; npm scripts `build` (esbuild 0.28.1, single-file CJS bundle src/main.ts -> dist/main.js, target es2022, no minify/sourcemaps in dev), `typecheck` (typescript 7.0.2, tsc --noEmit; fallback pin ~5.9.3 if @types/screeps 3.4.0 misbehaves under TS7), `test` (vitest 4.1.10), `lint`/`format` (@biomejs/biome 2.5.7), `push` (screeps-api 2.1.0 script; token in gitignored screeps.json).
- **AD-1 module topology:** exactly one blackboard role per module (world/, board/, control/, agents/, state/); dependencies flow one way — world/ writes board/, control/ and agents/ read world/ and board/, nothing calls control/.
- **AD-2 write ownership:** only world/ regenerates the Board; only control/ SETS Contracts (via spawnCreep initial memory or Matching claim) and spawn decisions; validators may only CLEAR; agents/ write only their own creep.memory.move; state/ owns schemas/serialization, no business logic.
- **AD-3 derived Board:** recomputed per Tick; nothing survives the Tick; one Job per world object that needs work, never aggregate Jobs.
- **AD-4 Contract shape:** creep.memory.contract is one jobId string `type:targetId`; validators clear only on FR-9 invalidity, never on carry state; sourcing phase derived — source iff empty, serve otherwise.
- **AD-5 zero colony persistence:** no Memory keys outside Memory.creeps; era derived inside world/ snapshot (pure function of RCL/Extensions/Containers); the mine Producer emits only when era = Specialist.
- **AD-6 volatile caches:** on global, lazily rebuildable any Tick, never Memory; never cache Game object references — ids and plain data only.
- **AD-7 Matching discipline:** no pathfinding in the scoring path; distances from the single world/ distance service (Chebyshev getRangeTo at MVP); assignment ordering tier -> within-tier priority -> distance (within-tier priority set by Producers from the policy table; this is what makes FR-24 data).
- **AD-8 movement choke point:** all movement through agents/movement.ts (moveTo with explicit opts); no behavior calls move/moveTo/moveByPath directly; stuck := position unchanged N consecutive Ticks AND fatigue == 0 -> one re-path with ignoreCreeps: true, then revert; creep.memory.move = { lastPos packed y*50+x, stuck }.
- **AD-9 control-cycle order:** generate -> taken-set -> validate -> match -> spawn, one pass per Tick; taken-set derived in main.ts, includes Spawning Creeps' Contracts, never stored.
- **AD-10 Game-read seam:** find/look/getObjectById/terrain only inside world/ (the per-Tick snapshot); Creep intents issued by agents/ on world/-obtained references; the spawnCreep intent by control/spawn with initial memory per AD-2.
- **Conventions:** config.ts is the single typed home for the policy table (tiers, within-tier priority, maxWorkers, Reserved-vs-Pulled per Job type), MVP constants (target population, Collector minimum, TTL replacement threshold, per-Job TTL floors, stuck N, reusePath), and MVP Body compositions — names/types pinned by the spine, values pinned at the first consuming story; creep lifecycle SPAWNED -> SEEKING -> WORKING -> IDLE -> DYING with DYING = deliver carried energy to nearest needy structure then idle; CPU metering via Game.cpu.getUsed() per cycle phase behind a config flag, with a sim-room CPU observation window at MVP exit; console logging prefixed by module; Job schema { id, type, targetId, pos, tier, withinTierPriority, maxWorkers, assignmentMode, lifetimeClass, requirements { body, ttlFloor } }; strict TS with string-union types (no runtime enums); ERR_* codes checked at the callsite.
- **Test strategy:** vitest unit tests for decision logic only (producers, matching, spawn, evolution, validators) against fake world snapshots; behaviors verified in the sim room, not unit-tested (FR-19/20/28/30 acceptance at story time in sim).
- **Implementation-time verification flags:** @types/screeps under TS7 at first build; moveTo engine internals (reusePath default, _move behavior, ignoreCreeps semantics) at the movement-helper story.

### UX Design Requirements

No UX design document — the product has no UI surface (single operator via the game client).

### FR Coverage Map

FR-1: Epic 2 — per-Tick Board regeneration
FR-2: Epic 2 — independent Producers
FR-3: Epic 2 — deterministic Job identity (`type:targetId`)
FR-4: Epic 2 — complete Job metadata
FR-5: Epic 3 — capacity-limited availability (taken-set)
FR-6: Epic 3 — assignment-mode separation (Reserved vs Pulled)
FR-7: Epic 3 — exclusive sticky binding
FR-8: Epic 3 — Contract persistence in Creep memory
FR-9: Epic 3 — per-Tick validation
FR-10: Epic 3 — idle-only assignment
FR-11: Epic 3 — tier-first matching (ordering per AD-7)
FR-12: Epic 3 — TTL-aware matching
FR-13: Epic 3 — within-Tick claim lock
FR-14: Epic 5 — population maintenance
FR-15: Epic 5 — proactive replacement
FR-16: Epic 6 — reserved-slot spawning
FR-17: Epic 5 — spawn priority ordering
FR-18: Epic 5 — Body selection
FR-19: Epic 4 — self-sourcing execution
FR-20: Epic 4 — job execution fidelity
FR-21: Epic 2 (upgrade Producer posting) + Epic 4 (Backfill execution)
FR-22: Epic 3 — priority tier policy (policy table in config.ts)
FR-23: Epic 6 — Evolution trigger detection
FR-24: Epic 6 — Container-first construction
FR-25: Epic 6 — deprecation, not deletion
FR-26: Epic 6 — Specialist activation
FR-27: Epic 6 — derived era with graceful degradation
FR-28: Epic 6 — Harvester source-lock
FR-29: Epic 6 — Source coverage (one Reserved mine slot per Source)
FR-30: Epic 6 — hybrid Collector execution

NFR-1: Epic 1 (metering) + Epic 3 (single-pass cycle, claim lock) + Epic 6 (Evolution-spike observation)
NFR-2: Epic 2 (derived Board) + Epic 3 (creep-level-only persistence)
NFR-3: Epic 3 (wipe recovery) + Epic 6 (graceful degradation)
NFR-4: Epic 1 (build/deploy/runtime fit)

## Epic List

### Epic 1: Walking Skeleton — Build, Deploy, Tick
The operator can build, typecheck, lint, test, deploy, and watch the bot run its control cycle every Tick in the sim room — with logging and CPU metering live.
**FRs covered:** none directly — carries NFR-4 (runtime fit), the NFR-1 metering convention, the toolchain, `config.ts`, `state/` schema. Enables everything.

### Epic 2: The Job Board — the Colony Sees Its Work
Every Tick the bot perceives and reports the colony's needs: world snapshot, era derivation, distance service, the fill/build/upgrade Producers, the derived Board.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-21 (posting half: the upgrade Producer).

### Epic 3: Dispatch — Creeps Claim and Keep Work
Idle Creeps pull the best Job and hold it sticky: Contract schema, validators, Matching (tier → within-tier → distance, TTL-aware), claim lock, taken-set (including Spawning Creeps), and the movement choke point with stuck escalation — claimed Creeps visibly walk to their work.
**FRs covered:** FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12, FR-13, FR-22.

### Epic 4: The Generalist Economy — the Colony Sustains Itself
Energy actually flows: source-iff-empty execution, fill/build/upgrade behaviors, the upgrade Backfill, DYING unload. The colony does useful work with zero intervention.
**FRs covered:** FR-19, FR-20, FR-21 (execution half).

### Epic 5: Spawn Management — the Colony Replaces Itself
Deaths become non-events: population maintenance, proactive TTL replacement, spawn priority ordering, Generalist Body selection, the `spawnCreep` issuer.
**FRs covered:** FR-14, FR-15, FR-17, FR-18.

### Epic 6: Evolution — Graduation to Specialists (MVP exit)
The colony detects readiness, builds Containers first, deprecates Generalists organically, spawns source-locked Harvesters and hybrid Collectors into Reserved slots — and degrades gracefully under attack.
**FRs covered:** FR-16, FR-23, FR-24, FR-25, FR-26, FR-27, FR-28, FR-29, FR-30.

## Epic 1: Walking Skeleton — Build, Deploy, Tick

The operator can build, typecheck, lint, test, deploy, and watch the bot run its control cycle every Tick in the sim room — with logging and CPU metering live.

### Story 1.1: Repository & Toolchain Scaffold

As the operator,
I want a hand-rolled TypeScript project scaffold with pinned, verified tooling,
So that every later story builds on a consistent, checked foundation.

**Acceptance Criteria:**

**Given** a fresh checkout on Node 24 LTS
**When** I run `npm install`, `npm run typecheck`, `npm run lint`, and `npm test`
**Then** all four exit 0, with at least one trivial vitest test present
**And** typecheck runs typescript 7.0.2 in `strict` mode against `@types/screeps` 3.4.0 — if TS7 rejects the typings, the fallback `typescript ~5.9.3` is pinned instead and the swap is noted in the README
**And** the directory skeleton matches the spine's Structural Seed exactly (`world/producers/`, `board/`, `control/`, `agents/behaviors/`, `agents/movement.ts`, `agents/validators.ts`, `state/`, `test/`, `scripts/`, `dist/`)
**And** a deliberately introduced lint violation makes `npm run lint` fail (verified, then reverted)

### Story 1.2: Bundle & Sim Deploy

As the operator,
I want a one-command bundle I can paste into the official simulation room,
So that I can watch my bot run inside the real game engine.

**Acceptance Criteria:**

**Given** the scaffold
**When** I run `npm run build`
**Then** esbuild emits a single `dist/main.js` — CJS format, `target=es2022`, unminified, no sourcemap — exporting `loop`
**And** the emitted file is readable JavaScript I can inspect by eye (dev build)
**Given** `dist/main.js` pasted into the simulation room
**When** the sim runs
**Then** a boot marker logs on the first Tick and no errors are thrown across 50 consecutive Ticks

### Story 1.3: Shard Push

As the operator,
I want `npm run push` to upload the bundle to the official World shard via screeps-api,
So that deploying live is one command and my token never enters git.

**Acceptance Criteria:**

**Given** a gitignored `screeps.json` holding my credentials
**When** I run `npm run push`
**Then** `scripts/push.ts` uploads `dist/main.js` to the configured shard and reports success or failure non-interactively
**And** `screeps.json` is covered by `.gitignore` (verified via `git check-ignore`)
**And** a secret-free `screeps.sample.json` is committed for reference

### Story 1.4: Control-Cycle Skeleton with Logging & CPU Metering

As the operator,
I want `main.ts` to run the fixed control cycle with per-phase logging and CPU metering,
So that I can see each phase execute in order and at what cost — the observable foundation of NFR-1.

**Acceptance Criteria:**

**Given** the bundle running in the sim room
**When** a Tick executes
**Then** the five phases run in AD-9 order (generate → taken-set → validate → match → spawn) with empty implementations, and each logs a `[module]`-prefixed line with its `Game.cpu.getUsed()` delta when metering is enabled
**And Given** the metering flag set off in `config.ts`
**When** a Tick executes
**Then** no metering logs are emitted
**And** a vitest suite asserts the phase invocation order using a fake world snapshot — the first exercise of the AD-10 seam
**And Given** N Ticks with zero Creeps
**Then** Memory holds no colony-level keys (AD-5), verifiable from the sim console

## Epic 2: The Job Board — the Colony Sees Its Work

Every Tick the bot perceives and reports the colony's needs: world snapshot, distance service, the fill/build/upgrade Producers, the derived Board.

### Story 2.1: World Snapshot & Game-Read Seam

As the operator,
I want all Game API reads confined to a `world/` module that builds one snapshot per Tick,
So that the rest of the bot never touches the read API and stays unit-testable (AD-10).

**Acceptance Criteria:**

**Given** the running bot
**When** a Tick begins
**Then** `world/` builds exactly one snapshot exposing the reads the Producers need — my structures with energy stores, construction sites, the Controller — via typed accessors
**And Given** any module outside `world/`
**When** it needs world data
**Then** it reads the snapshot or a `world/` accessor — no `find`/`look`/`getObjectById`/terrain calls outside `world/`
**And** a vitest suite constructs a fake snapshot as plain data — proving Producers need no Game API mock

### Story 2.2: Job & Contract Types + Per-Tick Board Registry

As the operator,
I want the Job and Contract types and the Board registry in `board/`,
So that work has one canonical, freshly-derived representation every Tick (FR-3, FR-4, AD-3).

**Acceptance Criteria:**

**Given** the type definitions
**When** a Job is created
**Then** it carries the full schema: `{ id, type, targetId, pos, tier, withinTierPriority, maxWorkers, assignmentMode, lifetimeClass, requirements { body, ttlFloor } }`
**And** Job ids follow the `type:targetId` grammar — a vitest suite round-trips `makeJobId`/`parseJobId` for every Job type
**And Given** the Board on two consecutive Ticks
**When** the second Tick begins
**Then** the registry is rebuilt from scratch — no Jobs survive from the previous Tick (unit-tested)

### Story 2.3: Producers + Policy Table

As the operator,
I want independent Producers emitting fill, build, and upgrade Jobs from the snapshot, with their priorities and capacities read from one typed policy table,
So that what-needs-doing is derived from the world and tunable in one place (FR-1, FR-2, FR-4, FR-21 posting, FR-22).

**Acceptance Criteria:**

**Given** a fake snapshot with an unfilled Extension, a construction site, and a Controller
**When** Producers run
**Then** the Board contains exactly one fill Job (critical, maxWorkers 1, Pulled, transient), one build Job (medium, maxWorkers 1, Pulled, transient), and one upgrade Job (low, unlimited, Pulled, persistent) — one Job per object, never aggregates
**And** tier, within-tier priority, maxWorkers, assignment mode, lifetime class, and requirements come from the `config.ts` policy table — this story pins the first values
**And Given** two identical world states on different Ticks
**When** Producers run
**Then** the emitted Job ids are identical (FR-3 determinism)
**And Given** a world state where a need disappears
**When** the next Tick regenerates
**Then** its Job is absent with no removal code (FR-1)

### Story 2.4: Distance Service & Sim-Room Board Visibility

As the operator,
I want the `world/` distance service and a per-Tick Board log line wired into the cycle's generate phase,
So that Matching has its single source of distances (AD-7) and I can watch the Board think in the sim room.

**Acceptance Criteria:**

**Given** two same-room positions expressed as plain `{ x, y }` data
**When** the distance function is called
**Then** it returns Chebyshev distance (`max(|dx|, |dy|)`) — unit-tested with plain data, no Screeps runtime and no mocks (AD-10 keeps the function pure)
**And Given** the live game in the sim room
**When** a live-object distance is needed
**Then** the `world/` wrapper resolves it via `getRangeTo` — verified by sim observation, not unit test
**And Given** the bundle in a sim room with an unfilled Extension and a construction site
**When** Ticks run
**Then** each Tick's `[board]` log line lists the open Jobs by type and tier, with the expected fill and build Job ids
**And** the generate phase is wired into `main.ts` in AD-9 position, replacing the Epic 1 stub

## Epic 3: Dispatch — Creeps Claim and Keep Work

Idle Creeps pull the best Job and hold it sticky: Contract schema, validators, Matching, claim lock, taken-set, and the movement choke point — claimed Creeps visibly walk to their work.

### Story 3.1: Contract & Memory Schema

As the operator,
I want `state/` to own the `creep.memory` schema with typed accessors,
So that Contract reads/writes have exactly one shape and one owner per field (AD-2, FR-8).

**Acceptance Criteria:**

**Given** the schema module
**When** any module touches Creep memory
**Then** it goes through `state/` accessors — `contract` (jobId string or absent), `move` (lastPos packed, stuck) — with the engine-owned `_move` documented as untouchable
**And** unit tests prove the accessors enforce the shapes (a non-`type:targetId` contract string is rejected)
**And** the write-ownership rule is structural: `setContract` is exposed to `control/` only, `clearContract` additionally to validators (AD-2 field ownership)

### Story 3.2: Taken-Set Derivation

As the operator,
I want the taken-set derived fresh each Tick from all Creeps' Contracts — including Creeps still Spawning,
So that capacity accounting is exact and Reserved slots never double-fill (FR-5, FR-16, FR-29).

**Acceptance Criteria:**

**Given** a set of Creeps with Contracts, one of them Spawning with a Reserved Contract
**When** the taken-set is derived
**Then** the Spawning Creep's Job counts as taken — unit-tested (the double-spawn trap from the adversarial review)
**And Given** two consecutive Ticks
**When** the second derives
**Then** nothing carries over — the set is recomputed, never stored (AD-9)
**And** the derivation runs exactly once per Tick in `main.ts`, passed to validate and match

### Story 3.3: Validators

As the operator,
I want per-type Contract validators that clear only on genuine invalidity,
So that sticky Contracts survive noise but die the Tick their work disappears (FR-9, AD-4).

**Acceptance Criteria:**

**Given** a Contracted Creep
**When** its target vanishes, is fulfilled, or its TTL drops below the Job's floor
**Then** the validator clears the Contract that same Tick and the Creep becomes idle
**And Given** a mine Contract on a depleted Source
**When** validation runs
**Then** the Contract stays valid (FR-9's explicit exception)
**And Given** any valid Contract with any carry state
**When** validation runs
**Then** it is never cleared on carry state alone (AD-4) — all rules unit-tested via fake `world/` reads

### Story 3.4: Matching & Claim Lock

As the operator,
I want Matching to assign idle Creeps by tier → within-tier priority → distance, with TTL eligibility and a within-Tick claim lock,
So that dispatch is deterministic, cheapest-first, and herd-proof (FR-6, FR-10, FR-11, FR-12, FR-13).

**Acceptance Criteria:**

**Given** an idle Creep and open Jobs across tiers
**When** Matching runs
**Then** a critical fill across the room beats a medium build next door (FR-11), and a Container-priority build Job beats a nearer ordinary site (within-tier priority — FR-24 as data)
**And Given** two same-tier, same-priority Jobs
**When** Matching runs
**Then** the nearer by the distance service wins
**And Given** three idle Creeps and one max-1 Job on the same Tick
**When** Matching runs
**Then** exactly one Creep claims it and the others take distinct next-best Jobs (FR-13)
**And Given** a Creep below a Job's TTL floor, or a Reserved Job on the Board
**When** Matching runs
**Then** no assignment is made in either case (FR-12, FR-6) — all unit-tested against fake snapshots
**And** assignment writes the Contract via `state/` (AD-2), and the Creep leaves Matching until its Contract ends (FR-10)
**And Given** an idle Creep with only the upgrade Job open (always posted, unlimited workers, lowest tier)
**When** Matching runs
**Then** the Creep is assigned the upgrade Job through the ordinary scoring path — the Backfill default is produced by the Board plus Matching, and no fallback code path exists anywhere (FR-21 by calculation, not code)

### Story 3.5: Movement Choke Point + Stuck Escalation

As the operator,
I want every move routed through one helper with explicit `moveTo` opts and fatigue-aware stuck escalation,
So that movement policy is consistent and congestion resolves itself (AD-8, NFR-1).

**Acceptance Criteria:**

**Given** any behavior needing to move
**When** it moves
**Then** it calls `agents/movement.ts` — no behavior calls `move`/`moveTo`/`moveByPath` directly (lint-visible)
**And Given** a Creep whose position is unchanged for N consecutive Ticks with `fatigue == 0`
**When** the helper detects it via `{ lastPos, stuck }`
**Then** it re-paths once with `ignoreCreeps: true`, then reverts to default opts — transitions unit-tested with plain data
**And Given** a fatigue-waiting Creep
**When** N Ticks pass
**Then** no escalation fires (fatigue ≠ stuck)
**And** this story executes the Deferred verification: `reusePath` default, `_move` memory behavior, and `ignoreCreeps` semantics are checked against the current API docs and the result recorded in the README

### Story 3.6: Cycle Wiring & Wipe Recovery

As the operator,
I want validate and match wired into the control cycle and proven in the sim room,
So that I can watch a Creep claim work and the colony survive a full Memory wipe (NFR-3).

**Acceptance Criteria:**

**Given** the sim room with open Jobs and a console-spawned Creep
**When** Ticks run
**Then** the Creep pulls the highest-tier appropriate Job and walks to its target — observed via the `[matching]` log
**And Given** a mid-run full Memory wipe
**When** a few Ticks pass
**Then** every living Creep holds a valid Contract again (NFR-3) — observed in the sim console
**And** the Epic 1 phase-order test still passes with the real validate/match phases (AD-9 intact)

## Epic 4: The Generalist Economy — the Colony Sustains Itself

Energy actually flows: source-iff-empty execution, fill/build/upgrade behaviors, the upgrade Backfill, DYING unload. The colony does useful work with zero intervention.

### Story 4.1: Behavior Frame & the Sourcing Rule

As the operator,
I want one behavior file per Job type sharing a common execution frame with the derived sourcing rule,
So that behaviors stay thin and the "source iff empty, serve otherwise" rule lives in exactly one place (AD-1, AD-4, FR-19).

**Acceptance Criteria:**

**Given** the behavior frame
**When** any behavior executes
**Then** the sourcing decision is derived from carry state only — empty → harvest via the shared `agents/` sourcing helper; otherwise serve the Contract's target — with no stored phase
**And** a vitest suite pins the anti-ping-pong predicate: a partially-loaded Creep (e.g. 45/50) keeps serving rather than returning to the Source
**And** each Job type's behavior is one file in `agents/behaviors/` — adding a Job type touches no existing behavior (AD-1)

### Story 4.2: Fill Behavior

As the operator,
I want Generalists on fill Contracts to keep the Spawn and Extensions fed,
So that spawning never starves (FR-19, FR-20).

**Acceptance Criteria:**

**Given** a Generalist with a fill Contract and empty carry
**When** Ticks run
**Then** it harvests, travels, and transfers to the Contract's structure until full — observed in the sim room
**And Given** the structure becomes full mid-delivery
**When** validation next runs
**Then** the Contract clears and the Creep re-pulls within the same Tick (FR-9)
**And** `ERR_*` results from `transfer` are checked at the callsite per the state convention

### Story 4.3: Build Behavior

As the operator,
I want Generalists on build Contracts to progress construction sites to completion,
So that the colony's infrastructure gets built unattended (FR-19, FR-20).

**Acceptance Criteria:**

**Given** a Generalist with a build Contract
**When** Ticks run
**Then** it sources energy and builds until the site completes — observed in the sim room
**And Given** the site completes
**When** the next Tick regenerates the Board
**Then** the build Job is gone and the Creep re-pulls with no cleanup code (FR-1)

### Story 4.4: Upgrade Behavior

As the operator,
I want Generalists holding upgrade Contracts to upgrade the Controller,
So that Backfill work produces progression (FR-20, FR-21 execution half).

**Acceptance Criteria:**

**Given** a Generalist holding an upgrade Contract
**When** Ticks run
**Then** it sources energy and calls `upgradeController` on the Controller until the Contract ends — observed in the sim room
**And** the behavior executes only when a Contract of type upgrade is held — the Creep's decision to upgrade is made by Board + Matching (Story 3.4), never by a code path inside the behavior
**And Given** a mid-life tier change in the policy table (e.g. build promoted in a test config)
**When** Matching next runs for idle Creeps
**Then** assignment order follows the new table with no behavior edits — proving the default lives in data

### Story 4.5: DYING Unload & Economy Observation

As the operator,
I want end-of-life Creeps to deliver their carried energy before dying, and a sim-room observation pass over the whole economy,
So that nothing is wasted and the epic's value is proven by watching (creep lifecycle convention; FR-19/20/21 acceptance).

**Acceptance Criteria:**

**Given** a Creep below the DYING TTL threshold carrying energy
**When** Ticks run
**Then** it delivers its carry to the nearest needy structure, then idles until death
**And Given** the sim room running the full Generalist economy
**When** I observe a rolling 1,000-Tick window
**Then** Sources keep draining, the Spawn stays fed, sites get built, the Controller progresses, no Creep stands idle without a Contract (SM-3), and per-phase CPU stays visibly under budget via the metering logs (NFR-1, SM-C1)

## Epic 5: Spawn Management — the Colony Replaces Itself

Deaths become non-events: population maintenance, proactive TTL replacement, spawn priority ordering, Generalist Body selection, the `spawnCreep` issuer.

### Story 5.1: Population Maintenance & the spawnCreep Issuer

As the operator,
I want `control/spawn` to derive population each Tick and issue `spawnCreep` when living-plus-in-progress falls below target,
So that the workforce self-replenishes with no console commands (FR-14).

**Acceptance Criteria:**

**Given** population (living + Spawning) below the `config.ts` target
**When** the spawn phase runs
**Then** `control/spawn` issues `spawnCreep` with a Generalist Body and initial memory per AD-2 — unit-tested with fake world state
**And Given** population at or above target
**When** the spawn phase runs
**Then** no spawn is issued
**And** Spawning Creeps count toward population (no over-spawning while the Spawn is busy)
**And** the spawn phase replaces its Epic 1 stub in AD-9's final position

### Story 5.2: Proactive TTL Replacement

As the operator,
I want a Creep whose TTL drops below the replacement threshold to trigger its own replacement before it dies,
So that vacancies are already being filled when they open (FR-15).

**Acceptance Criteria:**

**Given** a Creep with TTL below the replacement threshold (a `config.ts` constant, distinct from per-Job TTL floors)
**When** the spawn phase runs
**Then** a replacement is queued while the elder still works — unit-tested at the threshold boundary
**And Given** the sim room
**When** an elder Creep dies of age
**Then** its replacement is already Spawning or alive — observed via the `[spawn]` log
**And Given** a Creep with TTL above the threshold
**When** the phase runs
**Then** no replacement is queued

### Story 5.3: Body Selection & Affordability

As the operator,
I want spawn requests to pick a Body from the typed compositions in `config.ts`, never exceeding current energy,
So that the Spawn never queues what the colony can't afford (FR-18).

**Acceptance Criteria:**

**Given** the Body compositions table (Generalist at MVP)
**When** a spawn request is built
**Then** the Body comes from the table — not from inline part lists — unit-tested
**And Given** `energyAvailable` below a Body's cost
**When** the spawn phase runs
**Then** no spawn is issued that Tick (never an unaffordable queue)
**And Given** the sim room
**When** a Generalist spawns
**Then** its parts match the configured composition — observed in the client

### Story 5.4: Spawn Priority Ordering & Colony Observation

As the operator,
I want spawn energy spent by the fixed priority order — Reserved vacancies, then demand pressure, then top-up —
So that a contested Spawn always serves the most critical vacancy first (FR-17).

**Acceptance Criteria:**

**Given** simultaneous demand — a vacant Reserved slot, Collectors below minimum, and population below target
**When** the spawn policy decides
**Then** it queues them in exactly that order — unit-tested with fabricated inputs (Reserved vacancies are fabricated pre-Epic 6; the machinery is proven before it has real users)
**And Given** the Generalist-era sim room
**When** I observe a long window
**Then** only rule (3) top-up fires, the colony climbs to target population, and holds it across Creep deaths (FR-14/FR-15 live) — with CPU per Tick still under budget (NFR-1)

## Epic 6: Evolution — Graduation to Specialists (MVP exit)

The colony detects readiness, builds Containers first, deprecates Generalists organically, spawns source-locked Harvesters and hybrid Collectors into Reserved slots — and degrades gracefully under attack.

### Story 6.1: Era Derivation in the Snapshot

As the operator,
I want the era derived inside `world/` as a pure function of world state and exposed on the snapshot,
So that nothing persists or remembers what the world can answer (FR-23, AD-5).

**Acceptance Criteria:**

**Given** a fake world state
**When** era is derived
**Then** it is Specialist iff RCL >= 2 **and** 5 Extensions are built **and** a Container stands adjacent to every Source — unit-tested as a truth table across all eight combinations
**And** the value is recomputed every Tick and exposed on the snapshot; no Memory key exists for it (AD-5)

### Story 6.2: Mine Producer & Era Gating

As the operator,
I want the mine Producer to emit one Reserved mine Job per Source, only in the Specialist era,
So that Reserved work appears exactly when the colony can serve it (FR-26, FR-29).

**Acceptance Criteria:**

**Given** a Generalist-era snapshot
**When** Producers run
**Then** no mine Jobs are posted
**And Given** a Specialist-era snapshot with N Sources
**When** Producers run
**Then** exactly N Reserved mine Jobs appear (`mine:<sourceId>`, Reserved, persistent, requirements = Harvester Body) — and Matching never offers them to idle Creeps (FR-6)
**And** adding the mine Producer touched no existing Producer file (FR-2/AD-1) — demonstrated by the diff

### Story 6.3: Container-First Construction

As the operator,
I want Source-adjacent Container sites to outrank all other construction from RCL2 on,
So that the Evolution's precondition gets built first (FR-24).

**Acceptance Criteria:**

**Given** an RCL-2 room with a Container site and an ordinary site both open
**When** the build Producer emits Jobs
**Then** the Container site carries a higher within-tier priority — from the policy table, as data (AD-7)
**And Given** Matching (Story 3.4 already proves within-tier beats distance)
**When** an idle Creep is nearer the ordinary site
**Then** it takes the Container site — unit-tested end-to-end of Producer → policy → Matching

### Story 6.4: Reserved-Slot Spawning & Specialist Bodies

As the operator,
I want vacant mine slots to trigger Harvester spawns with Contracts written at spawn time, and Specialist Bodies in the config table,
So that Reserved work is filled proactively, never pulled (FR-16, FR-18).

**Acceptance Criteria:**

**Given** the Specialist era and a Source with no assigned Harvester
**When** the spawn phase runs
**Then** `spawnCreep` issues a WORK-heavy Harvester Body with the mine Contract in initial memory (AD-2) — the Creep never enters Matching
**And Given** simultaneous demands
**When** the policy decides
**Then** the vacant mine slot wins over Collector demand and top-up (FR-17 rule 1, now live)
**And** the config table gains Harvester and Collector (CARRY/MOVE-heavy, exactly one WORK part) compositions — affordability checks unchanged

### Story 6.5: Harvester Behavior

As the operator,
I want Harvesters source-locked for life — travel once, harvest into the Container, wait out regen and full Containers,
So that mining runs at maximum affinity with zero switching (FR-28).

**Acceptance Criteria:**

**Given** a Harvester with a mine Contract
**When** Ticks run
**Then** it travels to its Source once, harvests, and transfers into the adjacent Container — and never enters Matching again
**And Given** a depleted Source or a full Container
**When** the Harvester acts
**Then** it waits in place (FR-9 keeps the Contract valid) — sim-observed
**And** its Contract ends only with its death (AD-4)

### Story 6.6: Collector Behavior

As the operator,
I want Collectors to serve fill/build/upgrade Contracts by withdrawing from Containers — never harvesting,
So that delivery runs on body economics (FR-30).

**Acceptance Criteria:**

**Given** a Collector with a delivery Contract and empty carry
**When** it sources
**Then** it withdraws from the nearest non-empty Container — a unit test proves it never calls `harvest`
**And Given** its single WORK part
**When** it holds a build or upgrade Contract
**Then** it executes at single-WORK rate — sim-observed
**And Given** no Container with energy
**When** it sources
**Then** it waits near its supply point rather than draining the Spawn's reserves — threshold in `config.ts`

### Story 6.7: Deprecation & Graceful Degradation

As the operator,
I want Generalists deprecated organically and the colony to degrade era under attack,
So that transitions are gradual forward *and* backward (FR-25, FR-27).

**Acceptance Criteria:**

**Given** the Specialist era
**When** the spawn phase runs
**Then** no Generalist is ever queued — while living Generalists keep their Contracts until natural death (no kill/reassign code exists)
**And Given** a destroyed Source Container in the sim room (console-deleted mid-run)
**When** the next Tick derives era
**Then** spawn policy reverts to Generalists within one Tick, living Specialists keep working, and the missing Container is rebuilt Container-first — then the colony re-evolves when it completes (FR-23/FR-24)
**And Given** a full Memory wipe mid-degradation
**When** Ticks pass
**Then** the colony is in the correct era anyway — era was never in Memory (NFR-3)

### Story 6.8: Evolution Observation — MVP Exit

As the operator,
I want a full unattended Evolution run in the sim room as the MVP exit check,
So that SM-1 is demonstrated, not assumed.

**Acceptance Criteria:**

**Given** a fresh sim room and the complete bot
**When** I place Container sites once and otherwise never intervene
**Then** the colony bootstraps Generalists, reaches RCL2, builds the Containers first, transitions to a fully-Specialist workforce within roughly one Creep lifetime, and the Controller keeps progressing throughout (SM-1)
**And** the metering log shows the Evolution transition spike within CPU budget (NFR-1, SM-C1)
**And** the run is captured as the MVP-exit note in the README (what was observed, at what tick counts)

---
id: SPEC-screeps_ai
companions:
  - architecture-diagrams.md
  - node-pool-model.md
  - stack.md
  - conventions.md
  - deferred.md
  - ../../planning-artifacts/architecture/architecture-screeps_ai-2026-08-16/ARCHITECTURE_SPINE.md
  - ../../planning-artifacts/prds/prd-screeps_ai-2026-08-07/prd.md
  - ../../planning-artifacts/prds/prd-screeps_ai-2026-08-07/addendum.md
sources:
  - ../../planning-artifacts/prds/prd-screeps_ai-2026-08-16/prd.md
  - ../../planning-artifacts/prds/prd-screeps_ai-2026-08-16/addendum.md
  - ../../implementation-artifacts/epic-6-retro-2026-08-16.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# screeps_ai — Colony-Bot Engine

## Why

A pain to solve, immediately followed by an opportunity to capture. Stage 1 shipped a working Blackboard-architecture colony bot, but its Job-matching policy (`tier → within-tier priority → distance`, no colony-wide cap) let one Job type structurally absorb the entire idle population as the colony grew — live-observed as 10 of 11 Creeps stuck on `fill` while `build` starved, directly contradicting the MVP's own exit metric (`epic-6-retro-2026-08-16.md`, verdict: rejected). Stage 2 replaces that flat policy with a Kubernetes-shaped Node/Pool scheduler — colony-wide pool caps, configurable balancers, and continuous per-Node population/priority functions driven purely by config — so the sole operator can experiment with colony strategy by editing one file and watch the result converge in minutes on a new local private server instead of hours on the live shard. This SPEC is the resolved, build-ready contract for that system as it stands after `bmad-architecture`'s 2026-08-16/17 coaching pass finalized the design.

## Capabilities

- **CAP-1 Job Board**
  - **intent:** Producers emit exactly one Job per world object needing work, each tagged with a Node, rebuilt from world state every Tick with zero persistence.
  - **success:** The Board fully regenerates each Tick from world state; every needy structure carries exactly one Job; no Board data survives past its own Tick.

- **CAP-2 Contract Lifecycle**
  - **intent:** A Creep's Contract is exactly one jobId string (`type:node:targetId`); validators clear it only on defined invalidity; non-Matching delivery paths never target a structure that already carries a live incoming Contract.
  - **success:** A committed-but-traveling worker's target is never sniped by another delivery path (e.g. DYING-unload) mid-flight.

- **CAP-3 Node-Gated Matching and Workforce Pools**
  - **intent:** Idle Creeps are ranked by Node Priority → within-Node balancer (`LEAST_FULL` or `STICKY`) → distance; a Node's live `NumWorkers()` caps its colony-wide headcount, counted via the Job id's `node` prefix against current Contracts.
  - **success:** SM-2 — over a rolling 1,000-Tick window, no Job type with open eligible demand goes fully unserved while a lower-priority pool sits at capacity and a higher-priority pool has spare, uncommitted capacity.

- **CAP-4 Spawn Management**
  - **intent:** Population targets, proactive replacement, and Reserved-slot target selection all consult the same per-Node config (`Priority`/`NumWorkers`/`balancer`) that Matching uses; Reserved Contracts written at `spawnCreep` are included in the Tick's taken-set.
  - **success:** A Reserved slot never looks vacant to Spawn while a Spawning Creep already holds it — no double-queue.

- **CAP-5 Generalist and Specialist Economy**
  - **intent:** One behavior file per Job type serves both generalist and specialist bodies; a body-kind is eligible for a Node only if its tolerations list includes the Node's taint, checked alongside existing body/requirements eligibility.
  - **success:** A specialist body's Node never silently accepts an unrelated body-kind; a generalist body still serves every Node it tolerates.

- **CAP-6 Continuous Workforce Graduation**
  - **intent:** Each Node's `NumWorkers()`/`Priority()` is a pure function of a world-state summary (RCL, structure counts, population), evaluated fresh every Tick, replacing the retired discrete generalist/specialist Era; a Node's population-target function may return nonzero for a reduced-capability specialist-lite role as soon as its own minimal precondition is met.
  - **success:** SM-1 — from a fresh room, with the operator only placing Container sites once, workforce composition converges to every Node's `NumWorkers()` target within a bounded observation window, demonstrated on the local server first.

- **CAP-7 Local Development Server**
  - **intent:** The operator bootstraps a private Screeps server with one command, resets the room to fresh RCL1 without restarting the process, deploys the identical `dist/main.js` build artifact used for sim/shard, and runs ticks unthrottled; it becomes the default dev-loop target ahead of PTR/live.
  - **success:** A full generalist-to-graduated run compresses from hours/days on the live shard to minutes locally; every per-story sim-room verification step can run against the local server first.

- **CAP-8 Config Experimentation Surface**
  - **intent:** Every threshold, cap, priority function, taint, and balancer choice governing colony strategy lives in one per-room, per-Node table in `config.ts`, successor to `JOB_POLICY_TABLE`.
  - **success:** SM-3 — each of the three named example strategies ("first 6 workers all fill"; "specialist-lite on first container"; "`LEAST_FULL`-balanced across N extensions") is expressible as a config edit alone, with zero change to `control/match.ts` or any producer.

- **CAP-9 Movement Choke Point**
  - **intent:** Every Creep move goes through one movement helper with explicit opts; stuck (position unchanged N Ticks AND `fatigue == 0`) triggers one `ignoreCreeps` re-path, then reverts to default opts.
  - **success:** No behavior file calls `move`/`moveTo`/`moveByPath` directly outside the helper.

- **CAP-10 Resolved-Config Observability**
  - **intent:** The console log surfaces each active Node's fully-resolved `NumWorkers()`/`Priority()` output values for the current Tick, computed fresh each Tick same as the functions themselves — no discrete phase, no persistence.
  - **success:** With debug logging enabled (CAP-11), an operator reading the console for any Tick can see every Node's live population target and priority without inferring them from Contract counts by hand.

- **CAP-11 Gated Logging**
  - **intent:** All console output beyond critical errors is gated behind a single config-set log level; default level suppresses everything except critical errors; CPU metering and CAP-10's per-Tick resolved-config output only emit when the operator raises the level for debugging.
  - **success:** At default log level, a Tick's console output contains nothing but critical-error lines, if any; raising the level surfaces CPU metering and resolved-config lines with no other code change.

## Constraints

- Blackboard role separation: every module is exactly one of `world/`, `control/`, `board/`, `agents/`, `state/`; dependencies flow one way (`world/` writes `board/`; `control/`+`agents/` read `world/`+`board/`; nothing calls `control/`). A new capability is a new file inside a role directory, never a cross-role module.
- Field-level write ownership: `world/` regenerates the Board per Tick; only `control/` sets Contracts (at spawn or claim); `agents/` write only their own `creep.memory.move`; a Creep's own validator may only clear its Contract, never set one; `state/` holds no business logic.
- The Board is a per-Tick derived projection: recomputed from world state every Tick, no Board data persists, nothing references a previous Tick's Board.
- Zero colony-level Memory persistence outside `Memory.creeps`: spawn demand and population targets are derived fresh from world state every Tick, never remembered.
- Volatile caches live only on `global`, rebuilt lazily from world state, never written to Memory, never cache Game object references — ids/plain data only.
- No pathfinding (`PathFinder`/`findPath`/`moveByPath`) inside the Matching scoring path — distance is Chebyshev range only, from the single `world/` distance service.
- A Node's `Priority()` is evaluated once per Node per Tick, not once per Job — every Job under that Node in a given Tick carries the same Tick's single Node-Priority value.
- Config-supplied functions (`NumWorkers`, `Priority`, any per-Node function) take exactly one argument — an already-derived world-state summary — and read nothing else: no Game/Memory calls, no closures over mutable state.
- The control cycle runs exactly one pass per Tick in fixed order: generate → taken-set → validate → match → spawn; the taken-set derives from all Creeps' Contracts, including Spawning ones.
- Game API reads exist only inside `world/`; all other modules, including validators and `config.ts`, read the game only through `world/`'s exposed snapshot.
- The local private server introduces no new persistence and no bot-code branching: same `dist/main.js`, same `config.ts`, across all three deploy targets (sim room, local server, official shard).
- Pool/stage evaluation must not raise per-Tick CPU cost materially above Stage 1's baseline, including through stage-transition spikes.
- Test strategy for the Node-gated cascade must include at least one population-distribution test class — N Jobs of type A + M Jobs of type B + population P competing across pools — not only single-pair scoring tests.
- Stage 2 ships in fixed order: the local private server (CAP-7) first, the Node/Pool scheduler (CAP-3/6/8) second — the scheduler is tuned and observed against the local server, so building it against the live shard's tick cadence would slow all of Stage 2's development, not just its later use.
- All non-critical logging (per-phase CPU metering, per-Tick resolved-config values, any future debug output) must check a single config.ts log-level flag before emitting; default level is errors-only.

## Non-goals

- No new Job types beyond `mine`, `fill`, `build`, `upgrade`.
- No automated/headless test harness against the local server — manual fast-iteration only.
- No UI/dashboard beyond existing console logging conventions.
- No multi-room support — config is keyed by room profile to leave room for it, but Stage 2 ships exactly one default profile.
- No hot-reload of config without a rebuild/push — redeploy-per-change is an accepted iteration cost.
- No discrete stage/phase value anywhere in the design — Era is fully retired, not replaced by another discrete concept.
- No behavior-level unit tests for MVP — sim-room/local-server manual verification only.

## Success signal

From a fresh room, with the operator only placing Container sites once, the colony's workforce composition converges unattended to every Node's `NumWorkers()` target within a bounded window (SM-1). Over a rolling 1,000-Tick window, no Job type with open eligible demand ever goes fully unserved while a lower-priority pool sits at capacity and a higher-priority pool has spare, uncommitted capacity (SM-2). All three of the operator's named example strategies are each reachable by a config edit alone (SM-3), and sustained CPU stays under the account limit with headroom through stage-transition spikes (SM-C1, counter-metric).

## Assumptions

- "Unthrottled tick cadence" (local server) has no numeric target — treated as "as fast as the local server naturally runs, uncapped."
- Stage 1's full FR-1..30 detail was not independently re-derived in this run; this SPEC relies on `ARCHITECTURE_SPINE.md`'s carried-forward summary of Stage 1 decisions, with the Stage 1 PRD and its addendum linked as adopted companions for full traceability.

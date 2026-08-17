---
title: screeps_ai — Stage 2: Config-Driven Scheduler
status: final
created: 2026-08-16
updated: 2026-08-17
---

# PRD: screeps_ai — Stage 2 (Scheduler Pivot)

## 0. Document Purpose

This PRD scopes **Stage 2** of screeps_ai: a pivot, not an increment, of the Stage 1 MVP (Epics 1–6, `prd-screeps_ai-2026-08-07`, status `final`). Stage 1 shipped a working blackboard architecture but its Job-matching policy — strict tier-first, no colony-wide or proportional capacity — structurally starves lower-tier work as the colony grows, blocking the MVP's own exit criterion. `epic-6-retro-2026-08-16.md` is the evidence trail for that verdict (**rejected**) and is treated as a primary input here, not re-litigated. This document scopes the two things Stage 2 adds: a local private server for fast iteration, and a config-driven scheduler that replaces the binary Era with continuous, per-Node population/priority functions and flat per-Job caps with colony-wide, distributed workforce pools.

**Wording note (synced from architecture, 2026-08-17):** `bmad-architecture`'s coaching pass replaced the discrete "stage ladder with gates" mechanism this PRD originally described with continuous per-Node functions — same capability, different mechanism. FR-6, FR-7, FR-9, FR-11, and the Glossary below reflect the resolved architecture; see `ARCHITECTURE-SPINE.md` AD-5, AD-7, AD-11, AD-12 and `reconcile-prd-s2.md` for the full reconciliation.

Most of Stage 1 is unaffected and carries forward unchanged: blackboard module topology (AD-1/AD-2/AD-10), per-Tick Board regeneration (AD-3), Contract shape and validation (AD-4, Stage 1's FR-7–FR-13), the movement choke point (AD-8), spawn priority ordering (Stage 1's FR-17), and the Game/Memory adapter seam. This PRD does not re-describe or re-approve any of that.

**Numbering note:** this document's own FR/NFR/SM IDs (FR-1–13, NFR-1–4, SM-1–3/SM-C1–2) restart fresh and are local to Stage 2 — they are not a continuation of Stage 1's FR-1–30/NFR-1–4/SM-1–4. Any reference to a Stage 1 ID is written out as "Stage 1's FR-N" to keep the two numbering spaces from colliding (e.g., this document's own FR-7 is unrelated to Stage 1's FR-7).

## 0.1 Glossary

Inherited unchanged from the Stage 1 PRD (`prd-screeps_ai-2026-08-07`): **Job**, **Contract**, **Board**, **Producer**, **Tier**, **Matching**, **Creep**. Not redefined here.

New in Stage 2:
- **Node** — a config-defined pool of work, finer-grained than Job type (e.g. `spawns` and `extensions` are separate Nodes though both are `fill`-type Jobs); replaces **Era**'s two-state model. Every Job carries a `node` tag.
- **`NumWorkers()` / `Priority()`** — a Node's population-target and priority, each a plain value or a pure function of world state (population, structure counts, etc.), evaluated fresh every Tick. No discrete stage or gate list — graduation is continuous, expressed by parameterizing these functions over more world-state inputs (FR-6, FR-7).
- **Workforce pool** — the colony-wide capacity + distribution rule for one Node (FR-8, FR-9); the unit that replaces flat per-Job `maxWorkers` as the thing that caps a Node's total draw on population.
- **Pool cap** — the colony-wide ceiling `NumWorkers()` enforces for a Node (FR-8), distinct from a single Job instance's own `maxWorkers`.
- **Balancer** — how a Node spreads population across its open targets: `LEAST_FULL` (route to whichever target currently has the fewest assigned workers, recomputed live) or `STICKY` (permanently lock to the first assigned target) (FR-9).
- **Burst allowance** — a temporary, config-defined excess over a Node's steady-state `NumWorkers()` cap (FR-10).
- **Specialist-lite** — a reduced-capability specialist role a Node's `NumWorkers()` unlocks (returns nonzero) as soon as its own minimal world-state precondition is met, independent of the full Stage 1 Specialist precondition set (FR-12).

## 1. Vision

The operator can freely experiment with colony strategy — how workers get distributed across competing needs, how the colony graduates toward specialization — by editing a single config surface, and can watch the consequences of a change in minutes on a local machine instead of hours on a live shard. Strategy becomes something to try, not something to redesign code for.

## 2. Why This Pivot (context, not requirements)

Stage 1's Job-matching (`selectJob`, `src/control/match.ts`) orders eligible Jobs strictly by tier → within-tier priority → distance, with no cap on how much of the colony-wide population one Job *type* can absorb. `fill`'s total capacity scales with the number of open fill targets (spawn + extensions), which grows exactly as the colony approaches the RCL/Extension/Container thresholds that gate Specialist transition — so fill's pull on population peaks precisely when construction (`build`, medium tier) most needs attention. Live-observed: 10 of 11 creeps on `fill`, 0 on `build`, extensions and containers left unbuilt. This directly contradicted SM-1, the Stage 1 PRD's sole declared MVP-exit metric. Full evidence: `epic-6-retro-2026-08-16.md`.

Separately, the binary Era (`generalist` | `specialist`, AD-5) requires every Specialist precondition simultaneously — no intermediate state — which makes "a nerfed specialist as soon as the first container exists" structurally impossible as designed, not merely untried.

## 3. Sequencing

Stage 2 ships in two steps, in this order:

1. **Local private server** (Feature 4.1) — ships first. It is the iteration environment the scheduler work (step 2) will be tuned and observed against; building the scheduler against the live shard's tick cadence would make the rest of Stage 2 slower to develop, not just slower to use afterward.
2. **Config-driven scheduler** (Features 4.2–4.4) — the continuous per-Node workforce functions, workforce pools, and the config surface that exposes them.

## 4. Features

### 4.1 Local Development Server

**FR-1: One-command local bootstrap.** The operator can start a private Screeps server on their own machine, hosting a runnable room, with a single command — no dependency on network access, the official PTR, or the live shard.

**FR-2: Fast, cheap reset.** The operator can reset the local room to a fresh start (RCL1, spawn only, no other structures/creeps) without restarting the server process itself, so a strategy experiment doesn't require standing up a new account or room each time.

**FR-3: Identical deploy artifact.** The same build output (`dist/main.js`) that ships to the official shard also deploys to the local server through one build/push script — code under local test is the exact code that would ship, not a fork of it.

**FR-4: Unthrottled tick cadence.** The local server runs ticks as fast as the operator's machine allows, not gated by the official shard's real-time tick interval — a full Generalist-to-top-stage run compresses from hours/days to minutes.

**FR-5: Local becomes the default dev loop.** Per-story sim-room verification (the existing convention: "behaviors verified in the sim room, not unit-tested") happens against the local server first; the PTR/live shard remains the final-validation target, used before something actually matters, not for every iteration.

### 4.2 Job Scheduler — Continuous Workforce Functions (replaces the binary Era)

**FR-6: Continuous, config-driven workforce graduation.** Each Node's population target and priority (`NumWorkers()`/`Priority()`) are computed every Tick as pure functions of world state — not gated by a discrete list of named stages. Graduating the workforce (e.g., shrinking generalist headcount as specialist Nodes' targets grow) is expressed by parameterizing these functions over more world-state inputs; adding or changing a graduation rule is a config change to a function, not new code. This replaces AD-5's two-state Era (`generalist`/`specialist`) entirely — there is no discrete stage value anywhere in the design.

**FR-7: Multi-dimensional world-state inputs.** A Node's `NumWorkers()`/`Priority()` function can read any combination of RCL, structure existence/counts (extensions, containers, etc.), and population count/composition from the world-state summary — the same mechanism expresses both "specialist-lite unlocks at the first container" (e.g. a miner Node's `NumWorkers()` returns `NumContainers × MINER_CONSTANT`, naturally zero pre-container) and "the first 6 workers are all fill, then other positions open up" (a generalist Node's population target is `DESIRED_POP` minus a function of specialist headcount).

**FR-12: Specialist-lite unlock.** A Node's population-target function can return a nonzero headcount for a reduced-capability specialist role (e.g., a Harvester/Collector-equivalent Job, nerfed) as soon as its own minimal world-state precondition is met — independent of the full RCL/Extension/Container set the old Era required all at once. Decouples "a specialist role exists" from "every Specialist precondition is done."

### 4.3 Workforce Pools & Distribution (replaces flat per-Job `maxWorkers`)

**FR-8: Colony-wide pool caps.** Each Job type's demand is served by a config-defined pool carrying a colony-wide capacity cap — distinct from any per-Job-instance `maxWorkers` — so one Job type can never structurally absorb the whole population regardless of how many individual targets (e.g., 5 extensions) it has open. This is the direct fix for the failure in §2.

**FR-9: Configurable balancer.** A Node distributes population across its open targets using a configurable balancer — `LEAST_FULL` (route to whichever open target currently has the fewest assigned workers, recomputed live from current Contracts each Tick, no rotating state) or `STICKY` (permanently lock to the first assigned target, for roles like mining that must never switch) — so N similar targets get spread across workers instead of one target hogging attention while others starve, without trapping a committed worker mid-transit when the picture changes underneath it.

**FR-10: Burst allowance.** A pool can temporarily exceed its steady-state cap under a config-defined condition (e.g., freshly-built, still-empty extensions), without changing the steady-state cap that governs normal operation.

**FR-11: World-state-scoped pool activation.** A Node's `NumWorkers()`/`Priority()` can be conditioned on any world-state-summary input, including population thresholds — e.g., "the fill Node's `NumWorkers()` equals population while population < 6, then caps at 2 once population ≥ 6."

### 4.4 Config Experimentation Surface

**FR-13: One-place strategy definition.** Every threshold, cap, and distribution choice that governs colony strategy — stage gates, pool caps, distribution mode, burst rules — lives in a single config surface, successor to `JOB_POLICY_TABLE`/`config.ts`. The operator changes strategy by editing config; no story requires touching `control/match.ts` or a producer to try a different strategy. Extends Stage 1's FR-22 "one-place policy change" convention.

## 5. NonFunctional Requirements

**NFR-1: Local server is a test environment, not a design surface.** It introduces no new persistence or state model into the bot itself — the bot's code, config, and behavior are identical whether deployed locally or to the official shard. Nothing added for local-server support may weaken AD-5/AD-6 (zero colony persistence, volatile-caches-only).

**NFR-2: Scoring stays pure and pathfinding-free.** The stage ladder and workforce-pool distribution are pure functions of Board + snapshot + taken-set, computed fresh each Tick, no persistence, no pathfinding in the scoring path — carrying AD-3/AD-7's non-pathfinding-in-scoring discipline forward unchanged; only the cascade's proportionality changes, not its purity or its cost profile.

**NFR-3: CPU discipline preserved.** Pool/stage evaluation must not raise per-Tick CPU cost materially above Stage 1's baseline — carries Stage 1's NFR-1 forward.

**NFR-4: Population-distribution coverage in tests.** Test strategy for FR-8/FR-9/FR-11 includes at least one test modeling colony-wide distribution across competing pools (N jobs of type A + M jobs of type B + population P) — not only single-pair scoring tests. `epic-6-retro-2026-08-16.md` Finding 3 names this exact gap as what let Stage 1's starvation ship untested.

## 6. Additional Requirements — Spine Deltas

Binding on Stage 2, read against `ARCHITECTURE-SPINE.md`:

- **Retired:** AD-5 (binary Era, two states only) — replaced by FR-6/FR-7's continuous per-Node functions. AD-7's *ordering* clause ("tier → within-tier priority → distance," no colony-wide cap) — replaced by FR-8/FR-9's Node-gated cascade (Node Priority → balancer → distance). AD-7's *no-pathfinding-in-scoring* clause is explicitly **kept** (NFR-2) — only the proportionality/cap gap is retired, not the whole decision.
- **Kept, unchanged:** AD-1, AD-2, AD-3, AD-6, AD-8, AD-9, AD-10 — none of Stage 2's scope touches module topology, write ownership, Board regeneration, caching discipline, the movement choke point, cycle ordering, or the Game-read seam. **AD-4 is amended, not kept as-is:** the Job id grammar gained a `node` segment (`type:node:targetId`) and a Contract-commitment rule that protects a committed-but-traveling worker from having its target sniped by DYING-unload or any other non-Matching energy delivery.
- **Resolved (architecture, 2026-08-17):** the Node/pool config's home is `config.ts`'s per-room, per-Node function table (AD-12); Node tagging is `board/job.ts`'s new `NodeName` union, assigned per-Job by each Producer (AD-11); taints/tolerations gate specialist-vs-generalist Node eligibility (AD-13); the local server is a third deploy target (AD-14). Full detail: `ARCHITECTURE-SPINE.md`.

## 7. Success Metrics

- **SM-1 (revised, replaces Stage 1's SM-1): Graduated MVP-exit, unattended.** From a fresh room, with the operator only placing Container sites once, the colony's workforce composition converges to its fully-graduated target — every Node's population target from `NumWorkers()` is met — within a bounded observation window, demonstrated first on the local server, confirmed on PTR/live shard before it matters. *Validates FR-6, FR-7, FR-12.*
- **SM-2: No structural starvation.** Over a rolling 1,000-Tick observation window (reusing Stage 1's SM-3 convention), no Job type with open, eligible demand goes fully unserved while a lower-priority pool sits at capacity and a higher-priority pool has spare, uncommitted capacity. This is the corrected replacement for the exact failure `epic-6-retro-2026-08-16.md` documents. *Validates FR-8, FR-9, FR-11.*
- **SM-3: Strategy changeable without code change.** All three of the operator's named example strategies — "first 6 workers all fill," "specialist-lite on first container," "`LEAST_FULL`-balanced across N extensions" — are each expressible as a config edit alone, with no change to `control/match.ts` or any producer. *Validates FR-13.*
- **SM-C1 (counter-metric, carried from Stage 1): CPU discipline.** Never chase SM-1/SM-2 by burning CPU — sustained average stays under the account limit with headroom, including through stage-transition spikes (NFR-3).
- **SM-C2 (counter-metric, carried from Stage 1): process integrity.** Every feature still lands via PRD → architecture → small reviewable stories, even though the local server (§4.1) makes it cheap to skip that and just try things.

## 8. Non-Goals (Stage 2)

- No new Job types beyond Stage 1's set (`mine`, `fill`, `build`, `upgrade`) — a new Job type is a future PRD's scope, not this pivot's.
- No automated/scripted/headless test harness against the local server — the operator chose manual fast-iteration use, not CI-style automation (§9 records this as a deferred option, not a rejected one).
- No UI/dashboard beyond existing console logging conventions.
- No multi-room support.
- No hot-reload of config without a rebuild/push — the operator confirmed redeploy-per-change is an acceptable iteration cost given FR-1–FR-4's fast local loop.

## 9. Open Questions / Assumptions

- **[ASSUMPTION]** "Unthrottled tick cadence" (FR-4) has no numeric target — treated as "as fast as the local server naturally runs, uncapped," not a specific ticks/sec figure. Flag if a concrete target matters.
- **[RESOLVED, 2026-08-17]** Private-server tooling: `screeps-launcher` (v1.17.0, web-verified against Node 24 compatibility), wrapping the `screeps` engine (~v4.3.0) — decided in `bmad-architecture`, AD-14.
- **[OPEN]** Whether Epic 6's still-`backlog` stories (`6-7-deprecation-graceful-degradation`, `6-8-evolution-observation-mvp-exit`) get reframed as Stage 2 stories (their concepts — graceful degradation, exit observation — still apply under a stage ladder) or formally dropped, is an epics/stories-phase decision, not this PRD's.

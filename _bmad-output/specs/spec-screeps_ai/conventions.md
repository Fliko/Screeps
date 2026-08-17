# Conventions & Structure — screeps_ai

Reference for all capabilities in [SPEC.md](SPEC.md). Source: `ARCHITECTURE_SPINE.md` Consistency Conventions, Structural Seed, Capability → Architecture Map.

## Consistency conventions

| Concern | Convention |
| --- | --- |
| Naming | Job ids `type:node:targetId`; one Producer per file `world/producers/<jobType>.ts`; a Producer may emit Jobs under several `node`s; one behavior per Job type `agents/behaviors/<jobType>.ts`; directories = blackboard roles |
| Data & formats | Contract = jobId string; `creep.memory = { contract, move, _move(engine) }`; Job = `{ id, type, node, targetId, pos, priority, maxWorkers, assignmentMode, lifetimeClass, requirements { body, ttlFloor } }`; `priority` reuses the `PriorityTier` union (`critical`\|`high`\|`medium`\|`low`), now a per-Node, potentially per-Tick value; `maxWorkers` stays a **per-target** cap, distinct from a Node's colony-wide `NumWorkers()`; JobType and friends are string-union types, not runtime enums; `strict` TypeScript |
| State & mutation | ownership per SPEC.md Constraints (write ownership); colony Memory forbidden; action return codes (`ERR_*`) checked at the callsite; no exceptions across the control cycle |
| Config | everything tunable lives typed in `src/config.ts`: `{ <roomProfile>: { <nodeName>: { NumWorkers: fn(worldSummary)->number \| number, Priority: fn(worldSummary)->PriorityTier \| PriorityTier, taint: string, balancer: "LEAST_FULL" \| "STICKY", body, lifetimeClass, requirements } } }`. Matching never offers Reserved Jobs to idle Creeps |
| Creep lifecycle | behaviors implement SPAWNED → SEEKING → WORKING → IDLE → DYING, always derived, never a stored phase; DYING = deliver carried energy to the nearest needy structure **that carries no live incoming Contract**, then idle |
| Observability (dev) | per-phase CPU metering via `Game.cpu.getUsed()`, gated by the log level (CAP-11); each active Node's fully-resolved `NumWorkers()`/`Priority()` values are logged per Tick when debug-level (CAP-10) — no discrete phase, computed fresh same as the functions themselves; a sim-room CPU observation window is part of the MVP-exit check; the local server makes a fast CPU-observation loop possible for the first time — still manual, not automated |
| Logging | `console` only, prefixed by module (`[matching] …`); no framework; every non-critical line checks a single `config.ts` log-level flag before emitting — default errors-only, raised to debug to surface CPU metering and resolved-config output (CAP-11) |

## Structural seed

```text
src/
  main.ts            # the control cycle ONLY
  config.ts           # typed constants + per-Node config functions
  world/              # snapshot + Game reads + distance service; world-state summary for config functions derives from the existing snapshot
    producers/        # one file per Job type: mine.ts, fill.ts, build.ts, upgrade.ts — each tags Jobs with a node
  board/              # Job + Contract types; the per-Tick registry; Job.node + Job.priority
  control/
    matching.ts       # scoring + claim lock; Node Priority -> balancer -> distance
    spawn.ts          # population, proactive replacement, reserved slots (consults Node config's balancer for target selection), body selection
    evolution.ts       # retired as a discrete era gate; Node-driven spawn demand now lives alongside spawn.ts
  agents/
    behaviors/         # one per Job type: mine.ts, fill.ts, build.ts, upgrade.ts; dying.ts respects live Contract commitments
    movement.ts        # the choke point
    validators.ts      # per-type Contract validation, parses type:node:targetId
  state/               # creep.memory schema + (de)serialization guards
test/                  # vitest: producers, matching, spawn, validators vs fake snapshots
scripts/push.ts        # screeps-api deploy — gains a local-server push profile
screeps-launcher/       # local private-server config (launcher.yml or equivalent)
dist/                   # esbuild output: main.js
```

## Capability → Architecture Map

Traceability from this SPEC's capabilities back to the underlying PRD sections and architecture rules (`ARCHITECTURE_SPINE.md` AD-N).

| SPEC capability | Lives in | Governed by (AD-N) |
| --- | --- | --- |
| CAP-1 Job Board | world/producers + board/ | AD-1, AD-2, AD-3, AD-10, AD-11 |
| CAP-2 Contract Lifecycle | agents/validators + state/ | AD-2, AD-4, AD-5 |
| CAP-3 Node-Gated Matching & Workforce Pools | control/matching | AD-2, AD-7, AD-9, AD-11, AD-13 |
| CAP-4 Spawn Management | control/spawn | AD-2, AD-5, AD-7, AD-9 |
| CAP-5 Generalist & Specialist Economy | agents/behaviors + control/spawn | AD-1, AD-4, AD-8, AD-13 |
| CAP-6 Continuous Workforce Graduation | config.ts Node functions + world/ state summary | AD-5 (amended), AD-12 |
| CAP-7 Local Development Server | deployment scripts + screeps-launcher/ config | AD-14 |
| CAP-8 Config Experimentation Surface | config.ts | AD-12 |
| CAP-9 Movement Choke Point | agents/movement.ts | AD-8 |
| CAP-10 Resolved-Config Observability | logging convention (all modules) | AD-6, AD-12 |
| CAP-11 Gated Logging | logging convention (all modules) | — (Stage 2 addition, no prior AD) |

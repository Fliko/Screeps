# Node/Pool Model — screeps_ai

Reference for [SPEC.md](SPEC.md) CAP-3, CAP-4, CAP-5, CAP-6, CAP-8. The Stage 2 scheduler is a Kubernetes-shaped model, designed from scratch by the operator. Source: `ARCHITECTURE_SPINE.md` AD-11..AD-13, `prd-screeps_ai-2026-08-16/addendum.md`.

## Concept mapping

| Kubernetes concept | screeps_ai concept |
| --- | --- |
| Cluster | Room |
| Node | Producer-pool (per structure-kind — `spawns`, `extensions`, `mines`, …) |
| Kubelet | the Node's Worker Pool — its `NumWorkers()` gate + `balancer` |
| Pod | Worker (Creep) |
| Taint / Toleration | Node taint / body-kind tolerations |
| Control Plane | N/A — implicit in `config.ts` + Matching; no separate module |

## Node, defined

A Node is a config-defined pool of work, finer-grained than Job type — e.g. `spawns` and `extensions` are separate Nodes even though both are `fill`-type Jobs. Every Job carries a `node` field, assigned by its own Producer per target. `NodeName` is a single shared typed union, defined once in `board/job.ts` alongside `JobType` — a Producer tags a Job with a `NodeName`, and the config's per-Node table is keyed by that same union. A Job whose `node` has no matching config entry in the active room profile is never eligible — treated as `NumWorkers() = 0`, never a runtime throw.

## Resolved config shape

Per-room, per-Node table in `config.ts`, successor to `JOB_POLICY_TABLE`:

```ts
const config = {
  DefaultRoom: {
    spawns:     { NumWorkers: fn(world) => number, Priority: fn(world) => PriorityTier, taint: "FILLER", balancer: "LEAST_FULL" },
    extensions: { NumWorkers: fn(world) => number, Priority: fn(world) => PriorityTier, taint: "FILLER", balancer: "LEAST_FULL" },
    mines:      { NumWorkers: fn(world) => number, Priority: "critical",                taint: "WORKER", balancer: "STICKY" },
  },
};
```

`NumWorkers`/`Priority` are each a plain value or a pure function of a `world`-state-summary argument only (the summary type is `world/`-owned, exported for `config.ts` to import). Occupancy/target-selection is fully stateless, recomputed from live Contract counts each Tick via the Job id's `node` segment (`type:node:targetId`) — no volatile global cache, no rotating state.

## NumWorkers() / Priority()

A Node's population-target and priority are each a plain value or a pure function of world state (RCL, structure existence/counts, population count/composition), evaluated fresh every Tick — no discrete stage or gate list. Graduating the workforce (e.g. shrinking generalist headcount as specialist Nodes' targets grow) is expressed by parameterizing these functions over more world-state inputs; adding or changing a graduation rule is a config change to a function, not new code. Examples:

- Specialist-lite unlock: a miner Node's `NumWorkers()` returns `NumContainers × MINER_CONSTANT` — naturally zero pre-container, nonzero as soon as the first container exists, independent of the full RCL/Extension/Container set the old Era required all at once.
- Population-scoped activation: "the fill Node's `NumWorkers()` equals population while population < 6, then caps at 2 once population ≥ 6."
- Generalist drawdown: a generalist Node's population target is `DESIRED_POP` minus a function of specialist headcount.

`Priority` is evaluated once per Node per Tick, not once per Job — every Job emitted under a Node in a given Tick carries that Tick's single Node-Priority value.

## Workforce pool / pool cap

The colony-wide capacity + distribution rule for one Node. `NumWorkers()` is a **hard cap on total headcount for a Node whether Reserved or Pulled** — `control/spawn` spawns for a vacant Reserved target only while that Node's current headcount is below `NumWorkers()`; it is never a Pulled-only concept a Reserved Node can silently ignore. This is what makes SM-2 (no structural starvation) hold: a saturated Node's Jobs stop being eligible candidates entirely, so population spills over to the next-highest-Priority Node with room.

## Balancer

How a Node spreads population across its open targets:

- **`LEAST_FULL`** — route to whichever open target currently has the fewest assigned workers, recomputed live from current Contracts each Tick, no rotating state. Spreads N similar targets across workers instead of one hogging attention.
- **`STICKY`** — permanently lock to the first assigned target. For roles like mining that must never switch.

Reserved-mode spawn-time target selection (`control/spawn`) consults the same Node config (`Priority`, `NumWorkers`, `balancer`) when choosing which vacant Reserved slot to spawn a Harvester for — one mechanism, two call sites, not a separate spawn-side algorithm.

## Burst allowance

A pool can temporarily exceed its steady-state cap under a config-defined condition (e.g. freshly-built, still-empty extensions), without changing the steady-state cap that governs normal operation. Burstiness is not a separate structure — it is `NumWorkers()` itself spiking under a condition.

## Taints / tolerations

A Node carries a small taint tag (e.g. `FILLER`, `WORKER`); each body-kind's config carries a `tolerations` list — the generalist body tolerates every known taint, a specialist body's tolerations list only its own. A candidate is eligible for a Node only if its body-kind's tolerations include the Node's taint, checked alongside (not instead of) existing body/requirements eligibility.

## Job id grammar (amended)

`type:node:targetId` (was `type:targetId`) — the `node` segment is the Producer-assigned pool tag, which makes per-Node occupancy a live prefix-count over current Contracts each Tick, with no separate lookup table. Validators parse `type`, `node`, and `targetId` from the id and check the live object via `world/` reads.

# Addendum — screeps_ai Stage 2

Technical-how, options-considered, and depth that doesn't belong in the PRD's main narrative. Architecture-phase input.

## Local private server — tooling (FR-1–FR-5) [RESOLVED, `bmad-architecture` AD-14, 2026-08-17]

**Decided: `screeps-launcher`** (v1.17.0, web-verified — adds Node 24 support, compatible with the existing toolchain pin), wrapping the `screeps` private-server engine package (~v4.3.0). Front-runner reasoning below held up; the two alternatives were not chosen.

- ~~Official `screeps/screeps` private-server package directly~~ — more manual setup; the launcher wraps exactly this, no reason to skip it.
- ~~Docker packaging~~ — not needed; not pursued unless native-module setup turns out to be painful on the operator's machine in practice.

Existing `push` tooling (`grunt-screeps` + `screeps-api`, gitignored `screeps.json` token) already deploys to PTR/live shard by config profile — FR-3 (identical deploy artifact) most likely extends that same script with a `local` profile pointed at the local server's mod API port, rather than inventing a second deploy path.

Reset (FR-2) is either the private server's own room-reset console command/API, or a scripted wipe-and-reseed of its local save-file/sqlite state between runs — whichever the chosen tool exposes.

## Workforce scheduler — config shape [RESOLVED, `bmad-architecture` AD-5/AD-7/AD-11/AD-12/AD-13, 2026-08-17]

The `StageGate`/`WorkforcePool` sketch originally drafted here (discrete named stages, a `distribution` field, an `activeWhile.stage` clause) was **superseded during architecture coaching**, not built as sketched. The user's own from-scratch Kubernetes-shaped design (Room=Cluster, Node=Producer-pool, Pod=Worker) replaced it entirely — no discrete stage concept survives anywhere in the resolved design (AD-5 amendment). Resolved shape, per-room per-Node config:

```ts
const config = {
  DefaultRoom: {
    spawns:     { NumWorkers: fn(world) => number, Priority: fn(world) => PriorityTier, taint: "FILLER", balancer: "LEAST_FULL" },
    extensions: { NumWorkers: fn(world) => number, Priority: fn(world) => PriorityTier, taint: "FILLER", balancer: "LEAST_FULL" },
    mines:      { NumWorkers: fn(world) => number, Priority: "critical",                taint: "WORKER", balancer: "STICKY" },
  },
};
```

`NumWorkers`/`Priority` are pure functions of a `world`-state-summary argument only (AD-12, `world/`-owned type). All three open design questions this section originally posed are resolved: `NodeName` is a shared typed union in `board/job.ts` (not a separate module); the config table lives in `config.ts` as shown (not inside a renamed `JobPolicyTable`); occupancy/target-selection is fully stateless, recomputed from live Contract counts each Tick via the Job id's `node` segment (`type:node:targetId`, AD-4) — no volatile global cache. Full detail: `ARCHITECTURE-SPINE.md`.

## Deferred: automated local-server test harness

The operator chose manual fast-iteration (§8 Non-Goals) over scripted headless runs for Stage 2. If that changes later, the local server (once built per §4.1) is the natural target for a `run-N-ticks-and-assert` harness — noted here so it isn't rediscovered from scratch, not scoped now.

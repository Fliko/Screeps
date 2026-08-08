user:
I have a coding problem where I have jobs that need to be done and a pool of workers. Some jobs should always be being done and others are short lived high priority. What work a worker is doing is important because switching tasks is extremely expensive and often times requires the whole job needing to be redone. What algorithms should I use to accomplish this?

system:
This is a **non-preemptive scheduling problem with admission control** — and the catastrophic switch cost is the load-bearing constraint. The goal is to make preemption the exception, not the default. Here's how I'd approach it.

## The core principle
Never interrupt running work. Since switching a worker off a task destroys all progress on that task, you want to design the system so high-priority jobs get served *without* preempting persistent jobs. That flips the naive design ("priority jobs interrupt everything") into "reserve capacity + queue non-preemptively + preempt only as a last resort."

## The algorithm stack

**1. Capacity reservation (guard channels / trunk reservation)**
Keep K workers permanently reserved for high-priority bursts; only N−K workers ever run persistent jobs. This is the single most important technique. It looks wasteful (idle workers), but it's the price of avoiding catastrophic preemption. If utilization matters, let reserved workers run *interruptible backfill* of persistent work (see #4) so they're not actually idle until a high-priority job arrives.

**2. Non-preemptive priority queueing**
When a worker frees up *naturally* (job completes), assign the highest-priority queued job. High-priority jobs jump the front of the queue but never interrupt running work. This is your baseline dispatch policy.

**3. Worker affinity (processor affinity / sticky assignment)**
Once a worker starts a job, bind them together until completion. This eliminates switch cost for persistent jobs entirely. Consistent hashing is one implementation if jobs map deterministically to workers; otherwise just track ownership and never reassign.

**4. Backfill scheduling (conservative / easy backfill)**
Borrowed from HPC schedulers like SLURM: schedule high-priority jobs first, then pack persistent jobs into the gaps around them. This is how you keep reserved workers productive without losing the ability to eject them instantly for high-priority work — the backfilled persistent job is explicitly marked interruptible and cheap to lose.

**5. Capacity partitioning with minimum guarantees**
Reserve M workers for baseline/persistent jobs and K for burst jobs, with explicit *borrowing rules* (e.g. burst pool can borrow from baseline only when baseline queue is empty). This formalizes "persistent jobs should always be running" as a minimum-service guarantee.

**6. Cost-based emergency preemption (the escape hatch)**
If the reservation is exhausted and a high-priority job *must* run now, treat preemption as a cost-benefit decision: preempt only when (value of the high-priority job) exceeds (lost progress + restart cost on the preempted task). A simple threshold policy is usually enough; a full MDP is only worth it if you want formal optimality and can estimate values/costs well.

**7. (If hard deadlines exist) Real-time reservation servers**
If high-priority jobs have deadlines, the canonical methods are the **deferrable server**, **sporadic server**, and **constant-bandwidth server** — these reserve a guaranteed slice of capacity for aperiodic high-priority work while protecting periodic/background work. Worth knowing if your "high priority" actually means "deadline."

## Sizing the reservation
Use **Erlang-C / Erlang-B** queueing models to size K: given the arrival rate and mean service time of high-priority jobs, compute how many reserved workers you need to hit a target wait-time or blocking probability. This is sizing guidance, not the dispatch algorithm itself.

## Putting it together
- Don't preempt by default.
- Reserve capacity for bursts; let reserved workers run interruptible backfill.
- Queue non-preemptively by priority.
- Preserve worker affinity so persistent jobs never get switched.
- Reserve emergency preemption for a cost-justified threshold only.

A practical mental model: this is exactly what the **Kubernetes scheduler** does with priority classes + preemption policies + pod-disruption-budgets, and what **SLURM/YARN** do with reservations + backfill. Those are good reference designs to crib from.

Want me to sketch a concrete design (pool sizing, state machine for a worker, and the preemption-cost rule) for your specific job mix?

user:
Yes, help me by sketching a design. For context, I am playing the game screeps, it is a coding game so I do not want to see code. I want to learn new concepts and implement them. Currently I am low level, trying to get a colony of harvesters, builders, and upgraders going. I see that all these workers are the same and do not want to do as the tutorial does and assign them all a permanent task.

system:
Great context — Screeps maps onto this model almost perfectly, and the fact that all your creeps are the same body is an advantage, not a problem. Let me sketch the design in concepts.

## Mapping Screeps to the model

| Concept | In Screeps |
|---|---|
| Worker | A creep (same body, generalist) |
| Pool | All living creeps |
| Worker factory / reservoir | Your Spawn (+ energy to build creeps) |
| Job | Atomic task at a location: harvest a source, build a site, upgrade controller, fill a structure |
| Switch cost | Travel time (ticks spent walking) + losing a source access slot |
| Worker expiry | `ticksToLive` — creeps die on a timer, constantly |
| Persistent "always running" jobs | Harvesting sources (your economy) |
| Short-lived high-priority jobs | Filling the spawn/extensions, building a new structure |

The tutorial's sin is assigning `creep.role = 'harvester'` permanently. That's preemptive role-based scheduling. You want the opposite: a **job board** with **sticky non-preemptive assignment**.

## The central idea: a Job Board

Maintain a live list of *jobs*, not *roles*. Each job is a contract: `{ type, target, position, priority }`. The world generates jobs:
- A source with energy available → harvest job (persistent)
- A construction site exists → build job
- Spawn/extensions below capacity → fill job (high priority, short-lived)
- Controller → upgrade job (always present, lowest priority)

A creep is never a "harvester." A creep is a generalist that is *currently contracted* to a job. When the job is done (source empty, site built, structure full), the creep goes idle and pulls the next job off the board.

This is the **blackboard pattern**: jobs are posted to a shared board, idle workers pull work, nobody is hard-assigned.

## The creep state machine (stickiness is the point)

A creep cycles through states, and the key rule is: **only pull a new job when idle.**

```
SPAWNING → SEEKING (walking to target) → WORKING → IDLE → (pull new job) → SEEKING ...
                                                          ↘ DYING (low TTL)
```

`SEEKING` and `WORKING` are *sticky* — you never interrupt them. That's your non-preemptive guarantee. Reassignment happens at exactly one moment: the creep finishes its current contract. No thrashing, no mid-task switching.

Because Screeps re-runs your code every tick, store the creep's current contract id in its memory so it survives across ticks. The contract is the unit of persistence.

## Assignment rule: priority + proximity

When a creep goes idle and pulls a job, don't pick randomly. Score each open job:

\[
\text{score} = \text{priority} - k \cdot \text{distance}
\]

where `distance` is path length to the job and `k` is a tuning weight. Pick the highest-scoring job. This is greedy **affinity scheduling**: high-priority jobs jump the queue, but among equal priority you always take the nearest one, minimizing the switch cost (travel).

At low level you can simplify to lexicographic ordering: sort by priority first, then by distance within a tier. That's easier to reason about and tune.

## Priority tiers (with the controller as your backfill sink)

- **Critical** — Fill spawn/extensions when you need to spawn. If the spawn is starved, the colony stalls. Short-lived, bursts.
- **High** — Harvest sources. This is your "persistent, always running" work. Reserve enough creeps here that sources get drained each 300-tick regen cycle.
- **Medium** — Build construction sites.
- **Low / background** — Upgrade the controller.

The controller is your **backfill job**, and it's perfect for it: it's infinitely available, at a fixed known location, and never "finishes." Any idle creep with no higher-priority job nearby defaults to upgrading. When a critical fill job appears, the nearest creep finishing its work picks it up. This is exactly the backfill-scheduling idea — fill idle capacity with cheap interruptible work.

## Reserving the persistent work (sources)

Don't let the greedy rule starve harvesting. Sources are your economy and have limited access tiles. Treat assigned harvesters as **protected**: once a creep is contracted to a source, don't yank it for a build job. Only let it leave when the source is temporarily empty and a higher-priority job is nearby — and even then, prefer sending an *idle* creep over pre-empting an active one.

This is the guard-channel idea: there's always a floor of creeps on the sources so your energy income is never interrupted.

## The spawn as your capacity reservoir

Your spawn is the factory that keeps the pool topped up. Track a target population (say 6 creeps). When:
- population drops below target, or
- a creep's `ticksToLive` falls below a threshold, or
- you anticipate a burst (lots of construction sites),

queue a new creep. The spawn queue *is* your reserved capacity — it ensures bursts of high-priority work can always find a worker without pre-empting the economy.

## `ticksToLive`-aware routing

This is a constraint unique to Screeps and it matters: workers expire. Fold TTL into the assignment:
- A creep with lots of life left → can take far-away or long jobs.
- A creep near death → only nearby jobs, or just deliver its carried energy to the nearest structure and die. Never send a dying creep on a long walk.

So the scoring rule really becomes:

\[
\text{score} = \text{priority} - k \cdot \text{distance} - \text{TTL penalty if low}
\]

## How it grows (conceptually)

Right now: generalists, single room, job board, sticky contracts. As you scale you'll naturally hit two refinements:

1. **Body specialization, not role specialization.** You'll find a big-WORK creep sitting on a source dropping energy, plus cheap MOVE-heavy haulers carrying that energy around, is far more efficient per energy spent than generalists. This emerges from *body economics*, and it's still not "roles" — it's "what contracts can this body fulfill well."

2. **Hauling as a separate job class** with its own priority tier, once you have storage/containers. Miners harvest into containers; haulers move container → spawn/storage/tower.

Both are natural extensions of the job board, not rewrites.

## The mental model to keep

Every tick: post jobs to the board, let working creeps keep working, let idle creeps pull the nearest highest-priority contract, keep a floor of creeps on the sources, top up the pool through the spawn, and let everything else default to upgrading the controller.

Want me to go deeper on any one piece — for example, how to actually represent and persist a "contract," how to detect when a job is done vs. invalid, or how to tune `k` and the priority weights?

user:
I will most likely ask for help tuning later on, but I am curious of a good strategy for evolution. Because a generalist is necessary at first but if body specialization is better how do I handle that and how does it change the job board. My current thoughts are, use generalists until the collector is level 2 and all 5 extensions are built. Afterwards build harvesters and collectors. I will define jobs by their actions. I will define this as 3 different jobs, a generalist mine and collect, then specialist mine, collect. As we get to the defined evolution stage of 5th extension built, the mine and collect job stops being posted.

system:
Your instinct is solid. Let me pressure-test it and then sketch the full evolution strategy.

## The problem with a hard cutover

Your plan — stop posting mine-and-collect at extension 5 — is the right *idea* but a hard cutover creates a dangerous gap. On the tick you stop posting generalist jobs, your existing generalists finish their current contracts and go idle. The new specialist creeps probably aren't built yet. You get a brief energy drought right when your spawn is hungriest (it needs energy to build the specialists).

The cleaner framing is **job deprecation, not job deletion**. The mine-and-collect job becomes *unpublishable* (spawn won't create more generalists) but existing generalists keep running their current contracts until they die of old age. New creeps spawning from that point forward are specialists. The colony transitions organically over one creep lifetime (~1500 ticks) rather than all at once.

## Rethinking the job definitions slightly

Your three-job framing is close but consider naming them by *what the body needs to be good at* rather than what actions they take:

| Job | Actions | Body it rewards |
|---|---|---|
| Mine-and-Collect (generalist) | harvest → carry → deposit/build/upgrade | Balanced WORK/CARRY/MOVE |
| Mine (specialist) | harvest only, drops to container | Heavy WORK, minimal CARRY |
| Collect (specialist) | carry from container → deposit/build/upgrade | Heavy CARRY/MOVE, minimal WORK |

The key insight is that a pure miner never needs CARRY parts at all once you have containers, so you can pack it with far more WORK per energy spent. A pure collector never touches a source, so WORK parts are dead weight on it. Generalists are a necessary compromise early on; specialists let you escape that compromise.

## The evolution trigger

Extension 5 is reasonable but the *real* trigger is **containers adjacent to sources**. Containers are what make specialization mechanically viable — the miner drops energy in place, the collector picks it up. Without containers, a specialist miner is just wasting its harvest on the ground. So your evolution condition is actually:

> Controller level 2 reached AND all 5 extensions built AND container(s) placed at source(s)

These usually coincide anyway, but containers are the load-bearing requirement. Build them first thing once you hit RCL2.

## The job board changes at evolution

Before evolution, the board has one job class:
- Mine-and-collect (N slots, one per source access tile)

After evolution, the board has two job classes with a new relationship:

**Mine jobs** become *source-locked* — one mine job per source, not per access tile. A specialist miner parks on the source permanently (for its whole life) and never leaves. This is maximum affinity: the contract duration equals the creep's lifetime. No switching at all.

**Collect jobs** become *delivery* contracts — pick up from container X, deliver to target Y. These are short-cycle, high-churn, and numerous. One collector can complete many contracts per lifetime. This is where your priority tiers live: fill spawn first, fill extensions second, build third, upgrade last.

The job board split matters because **mine jobs should be pre-allocated at spawn time**, not pulled by an idle creep. You know exactly how many miners you need (one per source, maybe two per source at RCL3+). Spawn them proactively and assign them a source before they even leave the spawn. Collector slots are demand-driven and can be sized dynamically based on container fill levels.

## The spawn queue as the transition mechanism

The spawn queue is what orchestrates the evolution, not the job board directly. Here's the priority ordering for what to spawn next:

1. If a mine slot is vacant (source has no assigned miner) → spawn miner, highest priority
2. If containers are overflowing or collectors are below minimum → spawn collector
3. If still in generalist era → spawn generalist
4. If generalist era ending → stop queueing generalists, let existing ones age out

This way the transition is spawn-driven and gradual. No hard cutover, no energy gap.

## What stays the same

The blackboard pattern, the priority tiers, the TTL-aware routing, and the non-preemptive stickiness all carry forward unchanged. Evolution only changes:

- What job *types* get posted
- What body gets spawned
- The mine job's contract duration (lifetime vs. task-length)

Collectors inherit the full priority logic from your generalist era — they're just faster and more efficient at the carry half of the job.

## The next evolution after this

When you hit RCL3/4 and get a tower and storage, a third specialist naturally emerges: a **hauler** that moves energy from storage to towers/labs/remote locations. That's just a collector variant with a different target class. Your job board gains a "haul" job tier, and your collector pool shrinks slightly in favor of haulers. The pattern extends without a rewrite.

## Summary of the full arc

```
RCL1–2, no containers   →  generalists only, mine-and-collect job
RCL2, containers built  →  begin spawning miners + collectors, deprecate generalists
RCL3+                   →  add haulers as collector variant, tune ratios by container levels
RCL4+                   →  remote mining, same pattern applied to new rooms
```

The job board never gets thrown away — it just gains new job types and deprecates old ones. That's the right property to design for from the start.

When you're ready to tune ratios (how many collectors per miner, how to size the spawn queue by container fill level), that's a good time to bring in the Erlang-C intuition I mentioned earlier — it gives you a principled way to size the collector pool based on how fast miners fill containers.

user: 'how should I go about designing the job board?'

system:
The job board is the heart of the system, so it's worth designing carefully. The single most important principle first, then the pieces.

## Foundational principle: the board is a derived projection

The world is the source of truth, not the board. Every tick, jobs are *regenerated* from current world state. You do not persist the board in memory and try to keep it in sync — that path leads to drift (the board says a job exists, but the construction site is gone). Instead:

- **Jobs** = a pure function of world state, recomputed each tick.
- **Contracts** (who is working what) = the only thing persisted, and they live in creep memory.

This makes the system self-healing. If a creep dies mid-contract, its contract dies with it; the job it was doing reappears next tick because the underlying need still exists in the world. No cleanup code, no orphaned jobs.

## The job record

Each job is a small, stable record:

- **id** — deterministic, derived from the target so it's recognizable across ticks. e.g. `mine:<sourceId>`, `build:<siteId>`, `fill:<structureId>`, `upgrade:<controllerId>`.
- **type** — mine / collect / build / fill / upgrade
- **target** — the game object id + position
- **priority tier** — critical / high / medium / low, plus a numeric value within the tier
- **max workers** — how many creeps can hold this job (1 for build/fill, N for mine, ∞ for upgrade)
- **assignment mode** — `reserved` (filled proactively by the spawn) or `pulled` (filled by idle creeps)
- **lifetime class** — `persistent` (always emitted) or `transient` (emitted only when a condition holds)
- **requirements** — body capability floor, TTL floor (don't send a dying creep far)

## Producers: who posts jobs

A set of small, independent *producers* each scan the world and emit jobs. Each is a pure function:

- **Mine producer** — for every source, emit a mine job. Always. Persistent.
- **Build producer** — for every construction site, emit a build job. Transient.
- **Fill producer** — for every structure below its threshold (spawn, extensions, towers), emit a fill job. Transient, critical priority.
- **Upgrade producer** — always emit one upgrade job for the controller. Persistent, lowest priority, unlimited workers.

The producers run once per tick and the results get cached. This is the "sensors" layer — it reads the world and translates it into work.

## Two assignment modes on the same board

This is the part that makes the board handle your persistent-vs-burst distinction cleanly:

- **Reserved jobs** (mine slots) — the spawn manager queries the board for unreserved mine vacancies and proactively spawns a miner, binding it to a source for life. These never get pulled by idle creeps.
- **Pulled jobs** (fill, build, upgrade, collect) — idle creeps query the board and take the best-scoring open job.

So the board is unified, but the mine tier is supply-managed while everything else is demand-pulled. This matches the asymmetry: you know exactly how many miners you need (one per source), but the number of collectors/builders you need fluctuates with demand.

## The per-tick loop

Each tick runs this sequence:

1. **Generate** — producers emit the job list; cache it for the tick.
2. **Derive taken set** — scan all creeps' contracts once, build the set of job ids currently being worked, and how many workers each has.
3. **Validate working creeps** — for each creep with a contract, check: target still exists? still needs work? creep still capable and enough TTL? If yes → keep working (sticky, non-preemptive). If no → clear the contract; the creep is now idle.
4. **Match idle creeps** — for each idle creep, query available jobs (taken set excluded, max-workers not reached), score them, pick the best, write the contract to memory, add to the taken set.
5. **Feed the spawn** — spawn manager checks reserved vacancies and demand pressure, queues replacements.

Steps 3 and 4 are where the non-preemptive guarantee lives: a working creep is never reassigned, only re-validated.

## The matching rule and the within-tick lock

The score is what we settled on:

\[
\text{score} = \text{priority} - k \cdot \text{distance} - \text{TTL penalty}
\]

There's a subtle failure mode to design against: the **thundering herd**. If three creeps go idle in the same tick and each independently picks the nearest high-priority job, they'll all grab the same one. The fix is a per-tick *claim lock*: when creep #1 takes a job, it's immediately added to the taken set so creep #2 sees it as unavailable. Because Screeps executes your code sequentially within a tick, this is just an in-memory set you mutate as you assign. No locking primitives needed.

## Validation is where self-healing happens

Each tick, every working creep asks "is my contract still valid?" The checks are cheap and target-specific:

- Build job → does the site still exist and need more energy?
- Fill job → is the structure still below threshold?
- Mine job → is the source depleted? (don't invalidate — just wait; the contract persists)
- Collect job → does the container still have energy, and does a target still need it?

Invalid contract → creep goes idle → repulls. This is how the system reacts to the world changing under it: a build site finishing, a tower filling up, a creep running out of capacity. No events, no callbacks — just re-validation every tick.

## CPU discipline

This matters in Screeps because you pay per tick. The design above is already cheap by construction:

- Working creeps never touch the board — they only run their validator (one target check). Since most creeps are working most ticks, most creeps do almost no work most ticks.
- Only idle creeps run the matcher.
- The job list and taken set are computed once per tick and shared.
- Index jobs by room and priority tier so a query doesn't scan everything.

If you later find CPU pressure, the levers are: cache path distances (don't recompute `PathFinder` every tick — approximate with room-relative distance), and throttle full board regeneration (you can regenerate every N ticks and rely on validation to catch staleness in between).

## One design decision to make consciously: supply-side vs demand-side jobs

Most of your jobs are *demand-side* — "this structure needs energy," "this site needs building." The target is the need. But a collector has a supply step: it must go get energy before delivering. You have two clean options:

- **Fold sourcing into the collector's behavior** — the collector pulls a fill job, then its behavior knows "go to nearest container/storage, withdraw, deliver." The board stays a registry of needs. Simpler, recommended at your level.
- **Model a separate withdraw job** — "container X has surplus energy, take it." More uniform but more moving parts. Worth it only when haulers get complex.

Either way, keep the board as a registry of *targets that need work*, not a registry of creeps. Creeps are ephemeral; needs are what's real.

## The shape that survives evolution

Notice what this design buys you for the evolution we discussed last turn: when you go from generalists to specialists, you change the **producers** (stop emitting mine-and-collect, start emitting mine + collect) and the **spawn manager** (different bodies). The board, the matcher, the validator, the loop — all unchanged. The job record's `assignment mode` and `lifetime class` fields are what let you express "mine is reserved and persistent" vs "fill is pulled and transient" without special-casing everywhere.

That's the property to optimize for in the design: the board should be a dumb, generic registry, and all the smarts should live in the producers (what to post), the scorer (what to take), and the spawn manager (what to build). Change the strategy, don't rewrite the engine.
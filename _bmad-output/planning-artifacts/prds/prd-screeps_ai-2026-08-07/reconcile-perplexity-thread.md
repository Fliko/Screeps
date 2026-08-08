# Reconciliation: perplexity_thread.md → PRD + Addendum

*Source: `input/perplexity_thread.md` (non-preemptive scheduling discussion, 4 turns). Verified against `prd.md` (all FRs, §5 non-goals, §6.2 roadmap, notes) and `addendum.md`. Deferred items listed in PRD §6.2 / FR notes are treated as captured, not gaps.*

## 1. Captured

- **Non-preemptive sticky scheduling as the load-bearing principle** → Vision §1; FR-7 (exclusive sticky binding), FR-10 (idle-only assignment); §4.2 description ("never reassigned, only re-validated").
- **Job Board / blackboard pattern; jobs-not-roles critique of the tutorial** → §4.1, FR-1/FR-2; Glossary "Job Board"; Vision ("without a single hard-coded role").
- **Board as derived projection, never persisted; self-healing; contracts as sole persistence in creep memory** → §4.1 description, FR-1 consequences, FR-8; NFR-2, NFR-3.
- **Job record fields** (deterministic id, type, target id+position, tier, max workers, assignment mode, lifetime class, body/TTL requirements) → FR-3, FR-4; Glossary "Job".
- **Independent producers per job type, era-dependent producer set** → FR-2; §4.1 notes.
- **Priority tiers (critical>high>medium>low); fill=critical, build=medium, upgrade=low backfill** → FR-22, FR-21; Glossary.
- **Controller upgrade as the backfill sink** (infinitely available, fixed location, never finishes) → FR-21; Glossary "Backfill"; §4.5 description.
- **Capacity reservation / guard channels / protected harvest floor** → §4.4 description (Spawn as capacity reservoir), FR-16 (reserved mine slots), §4.5 notes (floor expressed as self-sourcing + backfill in Generalist era; explicit reserved slots post-Evolution). Absolute stickiness (FR-7) subsumes the thread's "prefer idle over preempting active."
- **Spawn as capacity reservoir; population target; proactive TTL-threshold replacement; spawn priority ordering; spawn queue orchestrates Evolution** → FR-14, FR-15, FR-17, FR-25; §4.4 description.
- **TTL-aware matching (never dispatch dying creeps far)** → FR-12; Glossary TTL.
- **Weighted scoring formula `priority − k·distance − TTL penalty`, with lexicographic ordering as the deliberate MVP simplification** → FR-11; §4.3 notes defer weighted formula + knobs to §6.2 Phase 3.
- **Thundering herd + within-tick claim lock (sequential per-tick execution, in-memory taken set)** → FR-13.
- **Per-tick validation as self-healing, type-specific validators; depleted Source does not invalidate a mine Contract** → FR-9.
- **CPU discipline: working creeps only validate, only idle creeps match, board + taken set computed once per tick and shared, cached/approximated travel costs** → NFR-1.
- **Supply-side vs demand-side decision: board posts needs only; sourcing folded into creep behavior (no collect / mine-and-collect job types)** → Glossary "Job"; §4.1 notes; FR-19, FR-30.
- **Evolution strategy: deprecation not deletion, ~1,500-tick organic transition, no energy drought** → FR-25; §4.6 description.
- **Evolution trigger: RCL2 + 5 Extensions + source-adjacent Containers (containers load-bearing; build first at RCL2)** → FR-23, FR-24.
- **Body economics: specialist bodies named by what they reward; pure miner needs no CARRY, pure courier needs no WORK** → §4.7 description; FR-30 notes (hybrid Collector decision; pure-courier + Builder/Upgrader split deferred to §6.2 Phase 3).
- **Mine jobs source-locked, one Reserved slot per Source, contract = lifetime; pre-allocated at spawn, never pulled** → FR-28, FR-29, FR-16, FR-6.
- **Collector slots demand-driven; container-fill-driven sizing intuition** → FR-17(2); §4.4 notes (deferred to §6.2 with Erlang-C).
- **What survives evolution (board, matcher, validator, loop unchanged; only producers + spawn manager change); "change the strategy, don't rewrite the engine"** → Vision §1; §4.6 description + notes; FR-2 consequence.
- **Full growth arc: Generalists → Specialists → Haulers (RCL3/4) → remote mining (RCL4+); 2 Harvesters/Source at RCL3+** → §4.6 notes, §4.7 notes, §6.2 Phases 2 & 4; Glossary "Hauler".
- **Erlang-C/B pool sizing; cost-based emergency preemption; weighted scoring; tuning knobs** → consciously deferred: §4.2 Out-of-Scope, §4.3/§4.4 notes, §5, §6.2 Phase 3. **Not gaps.**


## 2. Gaps

### G-1: The per-tick loop ordering (Generate → derive taken set → Validate → Match → Feed spawn)
- **What it is:** The thread's explicit 5-step per-tick sequence, with the rationale that "steps 3 and 4 are where the non-preemptive guarantee lives" and that the taken set is derived once before matching begins. The PRD has all five *capabilities* (FR-1, FR-5, FR-9, FR-10/11, FR-14–17) but never states the sequence or its ordering constraints (validate-before-match is what lets a released creep re-pull the same Tick; taken-set-before-match is what makes FR-13 work).
- **Where it belongs:** Addendum (architecture-phase mechanism, per §0's convention that mechanism detail is preserved there) — or a §4 overview note.
- **Why it matters:** This is the operational heart of the engine. An architect working only from the FRs could legally validate *after* matching or derive the taken set per-creep, breaking FR-13's guarantee or wasting CPU. The ordering is a design decision with correctness consequences, not an implementation detail.

### G-2: The creep state machine (SPAWNING → SEEKING → WORKING → IDLE → DYING), including dying-creep end-of-life behavior
- **What it is:** The thread names an explicit state machine where SEEKING/WORKING are the sticky states and reassignment happens only at IDLE. PRD FR-7/FR-10 capture the stickiness semantics but the state machine itself has no home. More materially, the **DYING behavior** — "a creep near death only takes nearby jobs, or just delivers its carried energy to the nearest structure and dies; never send a dying creep on a long walk" — is only half-captured: FR-12 blocks the bad dispatch but says nothing about the graceful end-of-life unload.
- **Where it belongs:** State machine → addendum (architecture). Dying-creep unload behavior → a note on FR-12 or §4.2; the routing nuance belongs to the architecture phase.
- **Why it matters:** The state machine is the contract lifecycle's execution view — the thing an implementer actually codes. The dying-creep unload has direct economic value (carried energy dies with the creep otherwise) and is a small, concrete requirement the thread states explicitly.

### G-3: Reference designs (Kubernetes, SLURM/YARN) and real-time reservation servers (deferrable / sporadic / constant-bandwidth)
- **What it is:** The thread explicitly points at Kubernetes (priority classes + preemption policies + pod-disruption-budgets) and SLURM/YARN (reservations + backfill) as "good reference designs to crib from," and names the three canonical real-time servers for deadline-driven high-priority work. Neither appears in the PRD, the addendum, or the §6.2 roadmap. (Preemption itself is deferred; these are the *concept pointers*, not the policy.)
- **Where it belongs:** Addendum — a "references for the architecture / strategy-and-tuning phases" section. Real-time servers could alternatively ride the §6.2 Phase 3 line next to emergency preemption.
- **Why it matters:** This project is a deliberate learning vehicle (JTBD-1, SM-4: "every concept the author can explain unaided"). The Vision lists the concepts the bot embodies; these named external references are the author's study map for exactly the deferred Phase 3 work, and they cost one line to preserve.

### G-4: CPU lever — throttled board regeneration (and job indexing by room/tier)
- **What it is:** The thread's two "if you later find CPU pressure" levers: (a) cache/approximate path distances — captured in NFR-1 — and (b) **throttle full board regeneration to every N Ticks, relying on validation to catch staleness in between** — not captured anywhere. A third lever, indexing jobs by room and priority tier so queries don't scan everything, is also absent.
- **Where it belongs:** A note on NFR-1 (throttle lever); addendum (indexing — pure mechanism).
- **Why it matters:** Lever (b) is in deliberate tension with FR-1, which mandates full regeneration *every* Tick with testable consequences. That may be the right MVP call, but the tension is currently invisible: the architect should know FR-1 is the simple correct baseline and that the thread already named the escape valve if CPU pressure bites. Given SM-C1 (CPU is a counter-metric) and the Evolution transition spike called out in NFR-1, this lever is likely to be needed.

### G-5: Spawn burst-anticipation trigger
- **What it is:** The thread gives three spawn-queue triggers: population below target (FR-14 ✓), TTL below threshold (FR-15 ✓), and **"you anticipate a burst (lots of construction sites)" → queue ahead of demand** (✗). FR-17's "demand pressure" is reactive (Collectors below minimum), not anticipatory.
- **Where it belongs:** A note in §4.4, or explicitly folded into the §6.2 Phase 3 tuning deferral.
- **Why it matters:** Predictive spawning is what makes the "spawn queue *is* your reserved capacity" claim true — reactive-only spawning means every build burst is served late by spawn-time + travel-time. If it's consciously deferred as a tuning refinement, saying so costs one line; right now it's silently dropped.

### Minor gaps (noted for completeness)
- **Numeric priority value within a tier** (thread's job record: "priority tier … plus a numeric value within the tier") — PRD has only the four tiers; within-tier order is travel cost. Mechanism detail → addendum.
- **Capacity-partition borrowing rules** (thread stack #5: "burst pool may borrow from baseline only when baseline queue is empty") — no direct Screeps analog in the needs-only design; arguably superseded by FR-6's assignment-mode split, but never acknowledged. → addendum or Phase 3 note.
- **The "model a separate withdraw job" alternative** (supply-side jobs: "worth it only when haulers get complex") — PRD commits to folded sourcing (correct per the thread's recommendation) but doesn't record the alternative for the Hauler phase, when the thread says it becomes worth it. → §4.7 notes or Phase 2.
- **Collect-validator specifics** ("container still has energy *and* a target still needs it") — FR-9's generic checks cover it; the supply-side validation nuance is mechanism → addendum.
- **Reserved-worker backfill** (thread stack #1: reserved workers run interruptible backfill) — the thread itself resolves this for specialists (miners park for life), so Harvesters waiting out a full Container (FR-28) is faithful; no action. Recorded here only to show it was considered.

## 3. Verdict

**Yes — the PRD is a faithful extraction of the source at the capability level.** Every major idea is either captured in FRs/sections or consciously deferred in §6.2 with the thread's own reasoning ("tuning needs a running MVP to tune"), and the needs-only reframing of the harvest floor (§4.5 notes) shows the thread was understood, not just transcribed. The gaps are real but secondary: mechanism-level material (per-tick loop ordering, state machine, CPU throttle lever) that §0 says should live in the addendum but doesn't, plus a handful of concept pointers (reference designs, real-time servers, burst-anticipation spawning) that matter specifically because this project is a learning vehicle.


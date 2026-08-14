# Epic 4 Context: The Generalist Economy — the Colony Sustains Itself

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Make energy actually flow through the colony via the Generalist Creeps that already claim Contracts (Epic 3). Each Job type gets an execution behavior — fill, build, upgrade — sharing one execution frame with a single, derived sourcing rule (harvest when empty, serve when carrying). The always-open, unlimited-worker upgrade Job acts as Backfill so no Generalist is ever idle with nothing to do, and a dying Creep unloads its carried energy before death instead of wasting it. This epic proves the colony sustains itself with zero operator intervention once Contracts exist.

## Stories

- Story 4.1: Behavior Frame & the Sourcing Rule
- Story 4.2: Fill Behavior
- Story 4.3: Build Behavior
- Story 4.4: Upgrade Behavior
- Story 4.5: DYING Unload & Economy Observation

## Requirements & Constraints

- Self-sourcing execution: a Contracted Generalist sources its own energy — when empty it harvests from a Source; when carrying, it serves its Contract's target (FR-19).
- The sourcing decision is derived from carry state alone, every Tick, and is never stored as a phase. A partially-loaded Creep (e.g. 45/50) keeps serving rather than ping-ponging back to the Source.
- Job execution fidelity: a Contracted Generalist performs the exact game action its Job type names, on the Job's target, until the Contract ends — transfer for fill, build for build, upgradeController for upgrade (FR-20).
- The upgrade Job is always posted, unlimited workers, lowest Priority Tier: any Generalist with no better Job upgrades the Controller. This Backfill behavior must emerge purely from Board + Matching (already built in Epic 3) — no fallback/default code path may exist inside any behavior (FR-21).
- A behavior may only execute the action named by the Contract type it holds; the decision of *which* Contract a Creep holds belongs to Matching (Epic 3), not to the behavior.
- `ERR_*` return codes from game actions (transfer, build, upgradeController, harvest) are checked at the callsite, never ignored.
- Creep lifecycle convention: DYING = when TTL drops below a threshold, deliver any carried energy to the nearest needy structure, then idle until death — nothing is wasted.
- Success criterion for the epic: over a rolling 1,000-Tick sim-room window, Sources keep draining, the Spawn stays fed, construction sites get built, the Controller keeps progressing, and no Creep stands idle without a Contract while any Job is open (SM-3) — with per-phase CPU visibly under budget via the metering logs (NFR-1/SM-C1).

## Technical Decisions

- One behavior file per Job type lives in `agents/behaviors/` (`fill.ts`, `build.ts`, `upgrade.ts`); adding a Job type must touch no existing behavior file (AD-1).
- All behaviors share a common execution frame that derives sourcing (empty → harvest via a shared `agents/` sourcing helper; otherwise serve the Contract's target) — this logic lives in exactly one place, not duplicated per behavior (AD-1, AD-4).
- Contract shape is unchanged from Epic 3: `creep.memory.contract` is the single jobId string `type:targetId`; sourcing phase is always derived from carry state, never stored (AD-4).
- Game API reads stay confined to `world/`; behaviors act on object references obtained via `world/`, issuing Creep intents themselves (harvest, transfer, build, upgradeController) — behaviors are the AD-10 executor side, not readers.
- Any movement a behavior needs must go through the existing `agents/movement.ts` choke point (AD-8) — no direct `moveTo`/`move`/`moveByPath` calls from behavior files.
- CPU metering via `Game.cpu.getUsed()` per cycle phase remains behind the existing `config.ts` flag; behavior execution should keep per-Tick CPU visibly within budget.
- Console logging stays prefixed by module per the existing convention.
- Strict TypeScript with string-union JobType (no runtime enums) — behaviors switch/dispatch on the existing Job type union, no new type system introduced.

## Cross-Story Dependencies

- Depends entirely on Epic 3: Contract & Memory Schema (3.1), Validators (3.3), and Matching & Claim Lock (3.4) must already be in place — this epic only adds execution behind Contracts Epic 3 already assigns.
- Story 4.1's shared execution frame and sourcing helper are a prerequisite for Stories 4.2, 4.3, and 4.4, which each implement one Job type's action on top of it.
- Story 4.4 (Upgrade Behavior) is the concrete proof of the Backfill default (FR-21) whose posting half was already implemented by Epic 2's upgrade Producer — this story only adds execution, and must demonstrate that a tier change in the policy table shifts assignment with no behavior edits.
- Story 4.5 depends on 4.1–4.4 all being functional, since its sim-room economy observation covers the full fill/build/upgrade loop plus DYING unload together.

---
title: Reconciliation — PRD vs Architecture Spine
input: prds/prd-screeps_ai-2026-08-07/prd.md (30 FRs, 4 NFRs)
against: ARCHITECTURE-SPINE.md (AD-1..AD-10, conventions, seed, capability map, deferred)
created: 2026-08-07
---

# Reconciliation: prd-screeps_ai-2026-08-07 → ARCHITECTURE-SPINE

Standard applied: every FR/NFR needs an architectural home (module + governing AD/convention) or a conscious deferral. Quiet requirements (policies, constants, testable consequences) are checked separately from module placement — a module home is not enough if the spine's own rules forbid or omit the mechanism the FR requires.

## 1. Coverage Table

| Req | Home in spine | Governed by | Notes |
| --- | --- | --- | --- |
| FR-1 Per-Tick regeneration | `board/` + `world/producers` | AD-3 (bound), AD-9 | full |
| FR-2 Independent Producers | `world/producers/<jobType>.ts` | AD-3 (bound), AD-1, naming conv | full |
| FR-3 Deterministic Job identity | `board/` Job ids (`type:targetId`) | AD-3, AD-4 (bound), naming conv | full |
| FR-4 Complete Job metadata | `board/` "Job + Contract types"; TTL floors in `config.ts` | AD-3, AD-4; config conv | field list itself implicit — minor note M4 |
| FR-5 Capacity-limited availability | taken-set step of control cycle; claim lock in `control/matching` | AD-9, AD-2 | **maxWorkers values homeless — Gap G3** |
| FR-6 Assignment-mode separation | `control/matching` vs `control/spawn` split | AD-1, AD-9 | "idle query never returns Reserved" stated nowhere — minor note M5 |
| FR-7 Exclusive sticky binding | `agents/validators` + `state/` | AD-4 (bound), AD-9 | full |
| FR-8 Contract persistence | `state/` creep.memory schema | AD-4 (bound), AD-2, data conv | full |
| FR-9 Per-Tick validation | `agents/validators.ts` (per-type) | AD-4 (bound), AD-9 (validate→match), AD-10 | full; per-type rules (e.g. depleted Source ≠ invalid) are story-level |
| FR-10 Idle-only assignment | `control/matching` | AD-4 (bound), AD-9 | full |
| FR-11 Tier-first matching | `control/matching` (Chebyshev via distance service) | AD-7 (bound), AD-9 | tier vocabulary depends on FR-22 table — Gap G2 |
| FR-12 TTL-aware matching | `control/matching`; TTL floors in `config.ts` | AD-7; config conv | thin but homed |
| FR-13 Within-Tick claim lock | `control/matching` claim lock | AD-9 (bound) | full |
| FR-14 Population maintenance | `control/spawn` (population) | AD-5, AD-9; config conv (target population) | full |
| FR-15 Proactive replacement | `control/spawn` — named only in structural-seed comment | AD-5, AD-9 | replacement threshold not explicitly in config list — minor note M1 |
| FR-16 Reserved-slot spawning | `control/spawn` (reserved slots) | AD-2 (only control writes Contracts), AD-5 | full |
| FR-17 Spawn priority ordering | `control/spawn`; Collector minimum in `config.ts` | AD-5, AD-9 | 3-level ordering rule itself unstated but single-module policy; story-level |
| FR-18 Body selection | `control/spawn` (body selection) | AD-5; Deferred: bodies-as-data per energy band → Phase 2 | deferral consistent with FR-18; MVP body compositions have no named home — minor note M2 |
| FR-19 Self-sourcing execution | `agents/behaviors` | AD-4 (bound: "source iff empty, serve otherwise"), AD-10 | full |
| FR-20 Job execution fidelity | `agents/behaviors/<jobType>.ts` | AD-1, AD-10 (intents via agents/), ERR-code conv | full; verified in sim only (behavior tests rejected — conscious deferral) |
| FR-21 Backfill default | `world/producers/upgrade.ts` | AD-3 | ∞ maxWorkers value homeless — Gap G3 |
| FR-22 Priority tier policy | **no home** | config catch-all ("every MVP constant …") arguably, but tiers unnamed and one-place rule unstated | **Gap G2** |
| FR-23 Evolution trigger detection | `control/evolution` (era derivation) | AD-5 | era dataflow to Producers undefined — Gap G4 |
| FR-24 Container-first build priority | **no home** | none — spine's ordering model cannot express it | **Gap G1** |
| FR-25 Deprecation, not deletion | `control/evolution` + `control/spawn` | AD-5 | full |
| FR-26 Specialist activation | `world/producers/mine.ts` + `control/spawn` | AD-5 | mine-Producer era gating hits AD-1/AD-2 — Gap G4 |
| FR-27 Derived era + graceful degradation | `control/evolution` | AD-5 (bound: "degrade, don't remember") | rule homed; "rebuilt with Container-first priority" clause inherits Gap G1 |
| FR-28 Harvester source-lock | `agents/behaviors/mine.ts` + reserved-slot spawn | AD-4 (sticky Contract), AD-9 | full |
| FR-29 Source coverage | `world/producers/mine.ts` (one Reserved Job per Source) | AD-3 | MVP maxWorkers=1 value homeless — Gap G3; PRD-internal tension with FR-5's "access-tile count" (M6) |
| FR-30 Hybrid Collector execution | `agents/behaviors` + `control/spawn` body selection | AD-4, AD-10 | "exactly one WORK part" body constant has no named home — minor note M2 |
| NFR-1 CPU discipline | cross-cutting: AD-3, AD-6, AD-7, AD-8, AD-9, AD-10 | design rules homed | **testable claim unenforceable — Gap G5** |
| NFR-2 Bounded persisted state | `state/`; AD-5 (bound), AD-6 (bound), data conv | crisp rule, review-enforceable | full |
| NFR-3 Self-healing | AD-5 (bound), AD-3, `control/evolution` | sim-room verifiable (Memory wipe, deploy, Container loss) | full |
| NFR-4 Runtime fit | Stack + deployment section; `scripts/push.ts` | two environments, no external infra | full |

PRD-side deferrals (weighted scoring, preemption, Erlang-C sizing, bodies-as-data, base layout/OQ-1, observability tooling, behavior-level unit tests) are either mirrored in the spine's Deferred section or are PRD-phase deferrals needing no architectural home. No orphan requirements on that axis.

## 2. Gaps

### G1 — FR-24 Container-first build priority has no expressible mechanism — **HIGH (blocks Evolution-epic stories)**
The spine's ordering model is: tier per Job *type* (FR-22 table) → within tier, lowest Chebyshev distance (AD-7). FR-24 requires Container sites to outrank *all other construction* once RCL≥2 — a precedence **within** the build type, keyed on target identity and RCL. Nothing in the spine provides within-tier precedence, and the two obvious hacks both violate existing rules: bumping container-build Jobs to another tier contradicts FR-22's "tier assignments by Job type" (and its one-place-change consequence); hardcoding target-type checks in Matching violates the FR-4 consequence "Matching operates on any Job without type-specific logic." FR-27's degradation clause ("the missing Container is rebuilt with Container-first priority") inherits this gap.
**Fix (one convention line):** extend Job metadata with a Producer-set within-tier precedence — e.g. "Producers may attach a within-tier precedence to Jobs; the build Producer ranks Source-adjacent Container sites above all other sites once RCL≥2; Matching orders within a tier by precedence, then distance." Alternatively fold a precedence column into the G2 policy table.

### G2 — FR-22 priority-tier policy table (and its one-place rule) is nowhere — **MEDIUM-HIGH (blocks clean §4.1/§4.5 story implementation)**
The assignments fill=critical, build=medium, upgrade=low, high-reserved, and the testable consequence "changing a Job type's tier is a one-place policy change — not scattered through Producers," appear in no AD or convention. The config convention's catch-all ("every MVP constant … lives typed in `src/config.ts`") is the only candidate home, but tiers are not named among its examples, and the anti-scatter rule is unstated. Meanwhile the naming convention (one Producer per type file) makes tier-inside-Producer the path of least resistance — which would silently fail FR-22's consequence.
**Fix (one line in Config convention):** "Job tier assignments live as one typed map in `src/config.ts`; Producers read it; tiers are never hardcoded inside Producers."

### G3 — FR-5/FR-29 max-workers data has no home — **MEDIUM (blocks Job Board / Matching stories at implementation time)**
The Board capacity mechanism is homed (taken-set per AD-9, claim lock), but the per-type *values* — build/fill = 1, mine = 1 at MVP scale (FR-29; FR-5's parenthetical says access-tile count — see M6), upgrade = ∞ — appear nowhere: not in the config list, not in a Job-schema convention. A dev implementing the Board must invent where they live, with the same scatter risk as G2.
**Fix:** same single-table fix as G2 — one typed per-type policy table in `config.ts` (tier, maxWorkers, assignment mode), or an explicit Job-schema convention in `board/` naming where these values are pinned.

### G4 — Era dataflow contradicts AD-1/AD-2 for the mine Producer (FR-23/FR-26/FR-27) — **MEDIUM-HIGH (blocks Evolution-epic stories)**
Era derivation lives in `control/evolution.ts`, and spawn (a `control/` sibling) can consume it — fine. But the *mine Producer* is era-gated ("the mine Producer activates at Evolution"; "the active Producer set is era-dependent"), Producers live in `world/`, and AD-1 explicitly prevents "Producers calling control"; AD-2 lets only `world/` write the Board. As written, `world/producers/mine.ts` has no lawful way to learn the era.
**Fix (one line, pick one):** (a) derive era in `world/` and expose it on the snapshot (Game reads are already confined there per AD-10; `control/evolution` then consumes it); or (b) state that Producers may re-derive the pure trigger conditions from world state via a shared `world/` helper. Either resolves FR-26 without touching AD-1/AD-2.

### G5 — NFR-1's testable CPU claim is not enforceable from the spine — **MEDIUM (blocks NFR-1 / SM-C1 verification, not stories)**
The design-side rules are well homed (Board once per Tick AD-3; caches on `global` AD-6; no pathfinding in scoring AD-7; movement choke point + reusePath AD-8; one pass per Tick AD-9; reads confined + "unmetered" called out as prevented AD-10). But "sustained average CPU/Tick comfortably under the account limit — including during the Evolution transition spike" requires *measurement*, and the spine specifies no metering mechanism: no `Game.cpu.getUsed()` convention, no CPU budget constant, no sim-room acceptance step, and no Deferred entry acknowledging the omission. MVP exit (SM-1/SM-C1) cannot demonstrate NFR-1.
**Fix:** add a convention line — per-phase CPU metering behind a `config.ts` flag (`Game.cpu.getUsed()` around control-cycle phases, logged via the existing logging convention), plus a documented sim-room CPU check as part of MVP exit — or explicitly defer CPU verification with rationale.

### Minor notes (do not block; close with a phrase each)
- **M1 (FR-15):** proactive replacement exists only as a structural-seed comment on `control/spawn.ts`, and the config list's "TTL threshold/floors" is ambiguous between the FR-15 replacement threshold and FR-4 per-Job TTL floors. Name both constants explicitly.
- **M2 (FR-18/FR-30):** the three MVP Body compositions (Generalist, WORK-heavy Harvester, CARRY/MOVE + exactly-one-WORK Collector) have no named home; the bodies-as-data deferral covers the Phase-2 mechanism, not the MVP values. Add "Body compositions" to the config list.
- **M3 (MVP-constants list, PRD §4.4 Notes):** the PRD says constants are *pinned at architecture time*; the spine names them but pins no numbers. Either pin values in `config.ts` at the first spawn/matching story (state this) or accept architecture-time = naming + typing only.
- **M4 (FR-4):** the Job record's field list (type, target id+pos, tier, maxWorkers, assignment mode, lifetime class, requirements) is implicit in "`board/` Job + Contract types." A one-line schema convention closes it.
- **M5 (FR-6):** "an idle Creep's query never returns a Reserved Job" is implied by the matching/spawn module split but stated in no AD; worth one clause wherever the G3 policy table lands.
- **M6 (PRD-internal):** FR-5 says mine maxWorkers = access-tile count; FR-29 pins exactly one Harvester per Source at MVP. The spine resolves neither; the G3 table should record `mine: 1 (MVP)`.
- **M7 (verification path):** FR-19/20/28/30 behavior consequences are verifiable only in the sim room, since behavior-level unit tests are consciously rejected. Accepted deferral — record it against those FRs' acceptance criteria at story time.

## 3. Verdict

Every one of the 30 FRs and 4 NFRs has a module home, and the spine's core decisions (AD-3/AD-4/AD-5, AD-7..AD-10) faithfully carry the PRD's persistence, stickiness, and CPU intent — but five policy-level requirements (FR-24's container-first precedence, FR-22's tier table, FR-5/FR-29's max-workers values, the era dataflow to Producers, and NFR-1's measurable CPU check) fall through the AD structure, each closable with a one-line convention rather than any redesign. Recommend resolving G1–G4 before epics/stories are cut for the Job Board, Matching, and Evolution epics.


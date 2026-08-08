# Rubric Walk — screeps_ai Architecture Spine

- **Lens:** good-spine checklist (`.cline/skills/bmad-architecture/references/reviewer-gate.md`)
- **Inputs:** `ARCHITECTURE-SPINE.md`, `.memlog.md`, `prd.md` (FR-1..FR-30, NFR-1..NFR-4 read in full)
- **Context:** greenfield, solo author, feature altitude, no parent spine, PRD-driven. `lint_spine.py` re-run this review: 0 findings.

## Overall verdict

A strong, unusually complete feature-altitude spine: every FR/NFR has a governed home, the operational/environmental envelope is explicitly closed rather than silent, and all six stack pins independently verify as registry-current today. It is approvable once the AD-2 `creep.memory` write-ownership contradiction is repaired — that Rule as written can steer a builder into an FR-16 violation. Everything else is one-line sharpening, not structural gap.

## Clause judgments

### 1. Fixes the real divergence points for the level below and misses none — **holds with three misses**

The spine fixes the axes two story-level builders could genuinely diverge on: module roles (AD-1), write ownership (AD-2), derived-vs-persisted state (AD-3, AD-5), Contract shape and Job id grammar (AD-4), cache medium (AD-6), distance/matching policy (AD-7), movement choke point (AD-8), control-cycle order (AD-9), the Game-read seam that makes unit tests possible (AD-10), plus conventions for naming, data formats, mutation, config single-home, creep lifecycle, observability, and logging. Three real divergence points escape: the `creep.memory` field-ownership contradiction (H1), the unassigned spawn-intent issuer (M1), and the silent build/bundle configuration (M2). Three smaller silences (L1, L2, L3) round out the list.

### 2. Every AD's Rule is enforceable and actually prevents its stated divergence — **holds for AD-3..AD-10; AD-1 and AD-2 have wording gaps**

AD-3 (recompute-per-Tick), AD-5 (no Memory keys outside `Memory.creeps`), AD-6 (caches on `global`, lazily rebuildable), AD-7 (distances only from the `world/` service; ordering tier → within-tier → distance), AD-8 (no behavior calls `move`/`moveTo`/`moveByPath` directly), AD-9 (fixed cycle order), and AD-10 (Game reads only in `world/`) are all mechanically checkable — several are grep- or lint-enforceable — and each closes its named divergence. Two exceptions: AD-2's Rule contradicts itself on `creep.memory` (H1), so its "two writers of one entity" prevention is not actually closed for that entity; and AD-1's Prevents names "Producers calling control" while its Rule constrains only module placement, not call direction (L3). AD-7's within-tier priority insertion is a legitimate, memlog-documented reconciliation of FR-11 (lowest travel cost within tier) with FR-24 (Container-first construction) — it makes FR-24 data rather than a code path, and the PRD's own §4.3 note sanctions the lexicographic simplification.

### 3. Nothing under Deferred could let two units diverge — **holds**

Every Deferred item names its phase gate, and present-tense behavior is pinned elsewhere: Chebyshev-only distances (AD-7), per-Creep stuck escalation only (AD-8), validate-every-Tick (AD-9/FR-9), MVP Body compositions named in `config.ts`, behavior-FR verification in the sim room at story time, and the `@types/screeps`-under-TS7 risk carrying a concrete fallback pin (`typescript ~5.9.3`). The inline "values pinned at first consuming story" deferral for policy-table and body values is safe: single config home, solo sequential stories, and FR-24's testable consequence constrains the value's ordering even before the number exists. One future-tense nit: the Deferred blessing of RawMemory segments will collide with AD-6's "never written to Memory" wording when Phase 2 opens (L4).

### 4. Named tech is verified-current — **confirmed independently**

All six npm pins match the registry's latest as of this review: typescript 7.0.2, esbuild 0.28.1, @types/screeps 3.4.0, vitest 4.1.10, @biomejs/biome 2.5.7, screeps-api 2.1.0. The Node 22 LTS (≥22.13) floor matches the memlog's engine-floor reasoning; Screeps API capabilities (CPU/bucket, PathFinder, RawMemory segments) were verified against docs.screeps.com per the memlog; `moveTo` internals are honestly flagged for implementation-time verification. The single unverified compatibility pair (@types/screeps 3.4.0 under TypeScript 7) is carried as an explicit open item with a fallback pin — proper handling, not a violation.

### 5. Spec capabilities covered — **full**

Walked FR-1..FR-30 and NFR-1..NFR-4 against the capability map, ADs, and conventions. Spot-checks: FR-1/2/3 ↔ AD-3 + one-Producer-per-type + `type:targetId` grammar (AD-4); FR-4 ↔ explicit Job schema in Data & formats; FR-5/FR-13 ↔ taken-set + claim lock inside AD-9's fixed cycle; FR-6 ↔ "Matching never offers Reserved Jobs" (Config convention); FR-7/FR-10 ↔ validate-precedes-match, idle-only pulling; FR-8 ↔ `creep.memory.contract` (modulo H1's ownership wording); FR-12's hard clause ↔ `requirements.ttlFloor` filter, soft clause deliberately simplified per PRD §4.3; FR-14..FR-18 ↔ `control/spawn.ts` + config constants; FR-19 ↔ AD-4's "source iff empty"; FR-21/FR-22 ↔ policy table with Backfill at low tier; FR-23/FR-27 ↔ AD-5 era as a pure function of (RCL, Extensions, Containers); FR-24 ↔ AD-7 within-tier priority; FR-25/FR-26 ↔ era-driven spawn policy in `control/evolution` (gating location unstated — L2); FR-28/FR-29 ↔ Reserved mine Jobs with `mine: 1`; FR-30 ↔ Collector body + behavior; NFR-1 ↔ AD-7/AD-10 + CPU-metering convention; NFR-2 ↔ AD-5/AD-6; NFR-3 ↔ AD-3/AD-5 degrade-don't-remember; NFR-4 ↔ stack + deployment envelope. SM-1/SM-C1 are wired into the observability convention as an MVP-exit check. No capability is homeless.

### 6. Every altitude-owned dimension decided, deferred, or open — **holds, with one silent sub-dimension**

The checklist's named trap — the operational/environmental envelope — is explicitly closed: exactly two environments (official sim room, official World shard), deploy via `screeps-api` with a gitignored token, "no private server, no external infrastructure," operations = unattended running plus manual Memory inspection. Decided: paradigm, roles, ownership, persistence, matching, movement, cycle order, test seam, conventions, stack. Deferred with gates: routing, traffic, throttling, bodies-as-data, cost matrices, behavior tests. Open: TS7 types compat. The one silent sub-dimension a feature-altitude spine with a Stack section owns: the build/bundle configuration itself (M2).

### 7. Brownfield ratification / parent-spine inheritance — **vacuously satisfied**

Greenfield (no codebase to contradict) and no parent spine (no inherited ADs to weaken). Context confirms both.

## Findings

**[high]** `creep.memory` write ownership contradicts itself (AD-2 Rule; Data & formats convention; FR-8/FR-16) — AD-2 grants Contracts to `control/` ("only `control/` writes Contracts") and `creep.memory` to `agents/` ("only `agents/` write their own `creep.memory`"), but the Contract *is* a field of `creep.memory` (`{ contract, move, _move }`), and FR-16 requires a Reserved Creep's Contract to exist "before it takes its first step" — i.e. written by `control/spawn`, as is every Matching claim. A builder honoring the `agents/` clause literally routes spawn-time Contract writes through the Creep's first run, breaking FR-16 pre-allocation and leaking a fresh Reserved Creep into Matching (FR-6/FR-10); a builder honoring the `control/` clause writes `creep.memory` from `control/`, violating the `agents/` clause. Two builders can land in different designs, each citing the Rule. *Fix:* state field-level ownership in AD-2 — "`control/` writes `creep.memory.contract` (at spawn and at claim, via `state/` schema); `agents/` write only their own `.move`; the engine owns `._move`." The mermaid already implies it; make the Rule say it.

**[medium]** Spawn intent has no named issuer (AD-10 Rule; Structural Seed `control/spawn.ts`) — AD-10 assigns all Game intents ("harvest, build, transfer, upgrade, moveTo, …") to `agents/`, but `StructureSpawn.spawnCreep` is a structure intent with no Creep executor; the seed puts spawn *decisions* in `control/spawn.ts` and is silent on who issues the call. One builder calls `spawnCreep` from `control/spawn.ts`; another invents an `agents/` spawn-issuer to satisfy AD-10's letter. *Fix:* extend AD-10's action clause — "`agents/` issue Creep intents; `control/spawn` issues the `spawnCreep` intent, with initial memory per AD-2 field ownership" — which also gives H1 its clean mechanism (Contract written via `spawnCreep` `opts.memory`).

**[medium]** Build/bundle configuration is a silent stack dimension (Stack §; Structural Seed `dist/`) — the spine pins esbuild 0.28.1 and names `dist/main.js` but never states bundle format, target, or minify/sourcemap policy. NFR-4's "deploys and runs unmodified on the official World shard" makes a wrong choice fail fast, yet two builders can still diverge — ESM vs single-file CJS/IIFE, different targets, different debuggability — on a dimension this altitude owns. *Fix:* one line in Stack or conventions, e.g. "esbuild bundles `src/main.ts` → `dist/main.js` as a single CJS/IIFE file, target per current Screeps runtime docs, no minification in dev."

**[low]** Taken-set residence is unnamed (AD-2 Rule; AD-9 cycle; `board/` seed) — `control/` "writes the taken-set," but `board/` is `world/`-only, so the taken-set's home (module state in `control/`, a `global` per AD-6, a `main.ts` local passed to validate/match) is unassigned. Functionally safe — it is per-Tick derived — but structurally divergent across builders. *Fix:* name it in AD-9 or the seed: "the taken-set is derived in `main.ts` and passed to validate/match; it is never stored."



**[low]** Mine Producer's era gating has no stated location (AD-5; Capability Map §4.6; FR-26) — era is derived in `world/` and exposed on the snapshot, and `control/evolution` only consumes it, but nothing says the mine Producer activates by reading `snapshot.era`. A builder could gate via `control/` (reintroducing the Producer→control call AD-1/AD-5 forbid) or post mine Jobs always and filter downstream (breaking FR-26 activation semantics and FR-25's no-early-Harvesters). *Fix:* one clause in AD-5 or the capability map: "Producers read era from the snapshot; the mine Producer emits only when era = Specialist."

**[low]** AD-1's Rule does not mechanically prevent its named "Producers calling control" divergence (AD-1 Prevents vs Rule) — "exactly one role per module" constrains placement, not call direction; the mermaid graph implies direction, but diagrams are not Rules. *Fix:* add to AD-1's Rule: "dependencies flow one way — `world/` writes `board/`; `control/` and `agents/` read `world/` + `board/`; nothing calls `control/`."

**[low]** Deferred RawMemory route caches will collide with AD-6's wording (Deferred §1 vs AD-6 Rule) — the Deferred list pre-blesses RawMemory segments as the Phase-2 cache medium while AD-6 forbids writing caches to Memory; segments are not Memory keys (AD-5 holds), but AD-6's "never written to Memory" will need amendment when the phase gate opens. *Fix:* annotate the Deferred item: "arrives with a spine update amending AD-6 (RawMemory segments ≠ Memory keys)."


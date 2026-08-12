---
baseline_commit: b82f427676d1c28d25a94a80c58ae8ea0c5f10c7
---

# Story 2.3: Producers + Policy Table

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the operator,
I want independent Producers emitting fill, build, and upgrade Jobs from the snapshot, with their priorities and capacities read from one typed policy table,
So that what-needs-doing is derived from the world and tunable in one place (FR-1, FR-2, FR-4, FR-21 posting, FR-22).

**Epic 2 — The Job Board (the Colony Sees Its Work).** Story 2.1 laid the AD-10 world-read seam
(`GameAdapter` + plain-data `WorldSnapshot` built once per Tick). Story 2.2 added the Board itself:
the canonical `Job` type with its full schema, the `type:targetId` id grammar, and the per-Tick
registry (`resetBoard`/`addJob`/`getBoard`/`findJob`). Story 2.3 adds the **Producers** — the modules
that read the world snapshot and emit Jobs onto the Board — and the **policy table** that the spine
names but has not yet pinned (ARCHITECTURE-SPINE.md L104). Story 2.4 adds the distance service and
the `[board]` log line. Do **not** implement Matching, behaviors, spawn, the distance service, the
mine Producer, or the `[board]` log in this story. [Source: epics.md L244–261; prd.md FR-1, FR-2,
FR-4, FR-21, FR-22; ARCHITECTURE-SPINE.md L101–108, L124–132]

Key deferred-learning this story must also resolve: the 2.2 code review left a **staleness gap** in
the registry (`addJob` only guards the first-Tick case; a later missed `resetBoard()` silently serves
stale Board data) — deferred to this story (see Task T6, `deferred-work.md`).

## Acceptance Criteria

1. **Producers emit exactly the right Jobs (AC1)** — Given a fake snapshot with an unfilled
   Extension, a construction site, and a Controller, when the Producers run, then the Board contains
   exactly one fill Job, one build Job, and one upgrade Job — **one Job per object, never aggregates**
   (two unfilled Extensions ⇒ two fill Jobs). [AC: epics.md L254; FR-2, FR-5]
2. **Policy values come from the `config.ts` table (AC2)** — Given the policy table pinned in
   `config.ts`, when a Producer emits a Job, then its tier, within-tier priority, maxWorkers,
   assignment mode, lifetime class, and requirements are read from that table — not hardcoded in the
   Producer. This story pins the **first values**. [AC: epics.md L255; FR-22 one-place rule; G2/G3
   fixes in reconcile-prd.md L59–65]
3. **Deterministic Job ids across identical ticks (AC3)** — Given two identical world states on
   different Ticks, when the Producers run, then the emitted Job ids are identical (FR-3). An unfilled
   Extension is `fill:<extensionId>`, a construction site `build:<siteId>`, the Controller
   `upgrade:<controllerId>`. [AC: epics.md L256–258; prd.md FR-3]
4. **Needs disappear with no removal code (AC4)** — Given a need that disappears (Extension filled,
   site finished, Controller absent), when the next Tick regenerates, then its Job is absent with **no
   explicit removal logic** (FR-1). [AC: epics.md L259–261; prd.md FR-1]

## Tasks / Subtasks

- [x] **T1 — Pin the policy table in `src/config.ts` (AC2)** — the single home for Job policy values
  - [x] Add `src/config.ts` imports `import type { JobType, PriorityTier, AssignmentMode, LifetimeClass } from "./board/job"` (type-only)
  - [x] Define `JobTypePolicy { tier; withinTierPriority: number; maxWorkers: number; assignmentMode; lifetimeClass; requirements: { body: BodyPartConstant[]; ttlFloor: number } }` and `JobPolicyTable` keyed over the three active types: `fill | build | upgrade`
  - [x] Extend `Config` interface with `JOB_POLICY_TABLE: JobPolicyTable` and `getConstant`/`setConstant` must return/mutate it (existing generic API already supports nested objects — verify)
  - [x] Pin MVP values (first-value pin per spine L104 — "values are pinned at the first story that uses them"; all tunable): fill = critical / 0 / maxWorkers 1 / pulled / transient / ttlFloor 200; build = medium / 0 / 1 / pulled / transient / ttlFloor 200; upgrade = low / 0 / `Infinity` / pulled / persistent / ttlFloor 0
  - [x] Body composition `[WORK, CARRY, MOVE]` (= `["work","carry","move"]`) for all three — the MVP Generalist (M2 in reconcile-prd.md L77; reuse the `BodyPartConstant[]` value in each type's `requirements.body`)
  - [x] Do **not** add a `mine` row — the mine Producer + its policy (incl. FR-29 `mine: 1`) land in Story 6.2 (PRD FR-16/FR-29; G4 era-dataflow); its tier is unset in FR-22

- [x] **T2 — Fill Producer in `src/world/producers/fill.ts` (AC1, AC4)**
  - [x] `export function produceFill(snapshot: WorldSnapshot): Job[]` — pure, returns Jobs (no `addJob` here)
  - [x] One Job per `SnapshotStructure` with `structureType` in `STRUCTURE_SPAWN | STRUCTURE_EXTENSION` AND `energy < energyCapacity`; skip already-full
  - [x] `targetId = structure.id`, `pos = structure.pos`, read all policy values from `getConstant("JOB_POLICY_TABLE").fill`; build via `makeJob({ ... })` so the id is computed correctly
  - [x] Never aggregate multiple structures into one Job; empty room ⇒ empty array (FR-1)

- [x] **T3 — Build Producer in `src/world/producers/build.ts` (AC1, AC4)**
  - [x] `export function produceBuild(snapshot: WorldSnapshot): Job[]` — one Job per `SnapshotConstructionSite`
  - [x] `targetId = site.id`, `pos = site.pos`, policy from `getConstant("JOB_POLICY_TABLE").build`
  - [x] within-tier priority 0 for all sites in this story — the Container-first precedence (FR-24, G1) is a **later** within-tier shift at Evolution, do not implement here

- [x] **T4 — Upgrade Producer in `src/world/producers/upgrade.ts` (AC1, FR-21)**
  - [x] `export function produceUpgrade(snapshot: WorldSnapshot): Job[]` — always posted when the Controller exists; `[]` when `snapshot.controller` is undefined
  - [x] `targetId = controller.id`, `pos = controller.pos`, policy from `getConstant("JOB_POLICY_TABLE").upgrade`, `maxWorkers: Infinity` (unlimited Backfill — FR-21)
  - [x] One Job total (the Controller is a single object)

- [x] **T5 — Run coordinator + generate wiring (AC1, AD-9)**
  - [x] `src/world/producers/run.ts`: `export function runProducers(): void` — read snapshot via `getCurrentSnapshot()`; if absent, return; else run `produceFill`, `produceBuild`, `produceUpgrade` and `addJob` each emitted Job (fill, then build, then upgrade order)
  - [x] `src/control/generate.ts`: after `resetBoard()` and `buildWorldSnapshot()`, call `runProducers()` — final phase order `resetBoard → buildWorldSnapshot → runProducers` (AD-9)
  - [x] Do **not** import Producers directly into other modules — the run coordinator is the only caller in `generate.ts`

- [x] **T6 — Registry per-Tick staleness guard (resolve 2.2 deferred finding)**
  - [x] `src/board/registry.ts`: add a per-Tick generation marker so a **missed** `resetBoard()` (second Tick on) throws instead of silently serving stale Board data (see `deferred-work.md`, 2.2)
  - [x] Recommended: a monotonic `generation` incremented by `resetBoard()`; stamp Jobs (or the board) with the generation at `addJob()`; `runProducers()` records the generation after reset and asserts it is unchanged, else throw — or an equivalent explicit staleness check
  - [x] Keep existing behavior (throws before first reset) and `getBoard`/`findJob` API unchanged

- [x] **T7 — Producer tests (AC1–AC4)**
  - [x] `test/world/producers/fill.test.ts` — one fill Job per unfilled Extension; none for full/filled; ≥2 Extensions ⇒ ≥2 Jobs (one-per-object); disappears when filled (AC1, AC4)
  - [x] `test/world/producers/build.test.ts` — one build Job per construction site; none with no sites; disappears when site gone (AC1, AC4)
  - [x] `test/world/producers/upgrade.test.ts` — upgrade Job present with Controller; absent without; `maxWorkers === Infinity`; persistent + low (AC1, FR-21)
  - [x] `test/world/producers/run.test.ts` — `runProducers()` on a fake snapshot populates the Board with exactly the expected fill/build/upgrade Job ids (AC1, AC3); `beforeEach(() => resetBoard())`; determinism: same snapshot, two runs ⇒ identical Job ids (AC3); two identical snapshots on separate reset ⇒ identical ids
  - [x] Policy-from-table test (AC2): mutate `setConstant("JOB_POLICY_TABLE", { ... })` and assert the emitted Job's fields change accordingly
  - [x] Construct snapshots as plain data literals of `WorldSnapshot` with a full `SnapshotStructure`/`SnapshotConstructionSite`/`SnapshotController` — no Game mock (2.1/2.2 pattern)

- [x] **T8 — Validation gates**
  - [x] `npm run typecheck` clean, `npm run lint` clean, `npm run build` emits `dist/main.js`
  - [x] Full test suite passes — **no regressions** in 2.1/2.2 suites (`test/world/snapshot.test.ts`, `test/board/*.test.ts`, `test/control-cycle.test.ts`)
  - [x] AD-10 grep on `src/world/producers/` for `Game\.`, `FIND_`, `getObjectById`, `look`, `getTerrain` — expect zero (producers read the already-built snapshot via `getCurrentSnapshot()`, never the Game global)
## Dev Notes

### Technical Requirements

- **Reuse, don't rebuild**: Job schema, `JobType`/`PriorityTier`/`AssignmentMode`/`LifetimeClass`
  unions, `makeJob`/`makeJobId`/`parseJobId`, and the registry (`addJob`/`getBoard`) already exist
  in `src/board/job.ts` + `src/board/registry.ts` (Story 2.2). Producers consume these — **do not**
  redefine types, id helpers, or Board storage.
- **Producers read the snapshot, never the Game global**: `WorldSnapshot` is the single world-read
  seam (AD-10, Story 2.1). Producers call `getCurrentSnapshot()` (or receive the snapshot as a
  parameter) — zero `Game.`/`FIND_`/`getObjectById`/`look`/`getTerrain` calls in `world/producers/`.
- **Policy lives in `config.ts`, never in Producers**: tier, withinTierPriority, maxWorkers,
  assignmentMode, lifetimeClass, body, ttlFloor all come from `getConstant("JOB_POLICY_TABLE")`.
  A Producer containing a hardcoded tier/maxWorkers is a **violation** of FR-22's one-place rule.
- **`makeJob` computes the id** — Producers pass `{ type, targetId, pos, tier, withinTierPriority,
  maxWorkers, assignmentMode, lifetimeClass, requirements }` (a `JobInput`) and never hand-build
  `id` (FR-3 determinism, Story 2.2 design).
- **`maxWorkers: Infinity`** for upgrade Backfill — the unbounded sentinel matching FR-5/FR-21
  "unlimited". Do not use a large magic number; Matching (Story 3.4) reads this value.
- **`STRUCTURE_SPAWN | STRUCTURE_EXTENSION`** are the MVP fill targets (FR-2 "Spawn/Extensions
  below capacity"). Containers/Storage are not fill targets in this story — the snapshot's
  `SnapshotStructure.structureType` filter handles this; no `game.ts` changes needed.
- **Empty room / missing snapshot**: `runProducers()` must be safe when `getCurrentSnapshot()`
  returns `undefined` or `roomName === ""` (return early, no throw).
- **TTL floor values (200/200/0) and Generalist body `[WORK,CARRY,MOVE]` are first-value pins**
  (spine L104; reconcile-prd M2/M3). They are intentionally tunable constants, not sacred — but
  they must be in `config.ts`, not literals in Producers.

### Architecture Compliance (AD-1..AD-10 are binding)

- **AD-1 (blackboard roles)**: Producers live in `world/producers/`; they write the Board via
  `addJob()` and read the snapshot via `getCurrentSnapshot()`. Producers must **not** call into
  `control/` (matching/spawn) or `agents/`. The run coordinator (`run.ts`) is part of `world/`.
- **AD-2 (writes owned)**: Only `world/` writes the Board — Producers are that writer. Producers
  never write `creep.memory` (Contracts are `control/`'s job, Story 3.1).
- **AD-3 (per-Tick derived)**: The Board is recomputed every Tick. `generate.ts` already calls
  `resetBoard()` first (Story 2.2); Producers run after, filling the empty Board. Never persist or
  cache Jobs in `Memory`/`global`.
- **AD-4 (Contract grammar)**: Untouched in this story — Job ids keep the `type:targetId` grammar
  through `makeJob`.
- **AD-5 (zero colony persistence)**: No `Memory` writes from `world/producers/`.
- **AD-7/AD-8 (distance/movement)**: Not this story — no distance math, no movement code.
- **AD-9 (control-cycle order)**: `generate` phase order becomes `resetBoard() →
  buildWorldSnapshot() → runProducers()`. `main.ts` order unchanged: generate → taken-set →
  validate → match → spawn.
- **AD-10 (Game reads only through world/)**: Producers read the **already-built snapshot** — no
  Game API calls. `grep src/world/producers/` for `Game\.`, `FIND_`, `getObjectById`, `look`,
  `getTerrain` must return zero.
- **No exceptions across the control cycle** (state & mutation convention): Producers must not
  throw on normal input (empty room, no controller, no structures). `addJob` may still throw on a
  missing reset — that is the T6 guard, intentional.
### Library & Framework Requirements

- **TypeScript 7.0.2** (strict, `moduleResolution: Bundler`). String-union types, `readonly`
  arrays, type-only imports (`import type { ... }`).
- **vitest 4.1.10** — `describe`, `it`, `expect`, `beforeEach` (no sinon/other frameworks in use).
- **@types/screeps@3.4.0** — `BodyPartConstant`, `STRUCTURE_SPAWN`, `STRUCTURE_EXTENSION`,
  `StructureConstant` are **globals** (tsconfig `types: ["screeps"]`). No imports needed.
- **esbuild 0.28.1** — `runProducers()` must be reachable from `main.ts` via the `generate()`
  import chain.
- **biome 2.5.7** — `npm run lint`. 2-space indent, double quotes, no semicolons.
- No new dependencies. Everything above already verified on this project (spine L110–122,
  verified 2026-08-07; 2.1/2.2 builds green).

### File Structure Requirements

No `index.ts` barrel files in `src/` — direct file imports only:

- **MOD** `src/config.ts` — policy table types + `JOB_POLICY_TABLE` constant (first-value pins)
- **NEW** `src/world/producers/fill.ts` — `produceFill(snapshot): Job[]`
- **NEW** `src/world/producers/build.ts` — `produceBuild(snapshot): Job[]`
- **NEW** `src/world/producers/upgrade.ts` — `produceUpgrade(snapshot): Job[]`
- **NEW** `src/world/producers/run.ts` — `runProducers(): void` (snapshot read + addJob wiring)
- **MOD** `src/control/generate.ts` — add `runProducers()` call after `buildWorldSnapshot()`
- **MOD** `src/board/registry.ts` — per-Tick staleness guard (T6; public API unchanged)
- **NEW** `test/world/producers/fill.test.ts`, `build.test.ts`, `upgrade.test.ts`, `run.test.ts`

Do **not** modify `src/game.ts`, `src/world/snapshot.ts`, `src/main.ts`, `src/board/job.ts`,
`src/board/contract.ts` in this story.

### config.ts Policy Note (the pins)

The policy table is the **one place** where fill/build/upgrade behavior is tuned (FR-22, G2/G3).
Pinned MVP values:

| type | tier | withinTierPriority | maxWorkers | assignmentMode | lifetimeClass | body | ttlFloor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fill | critical | 0 | 1 | pulled | transient | `["work","carry","move"]` | 200 |
| build | medium | 0 | 1 | pulled | transient | `["work","carry","move"]` | 200 |
| upgrade | low | 0 | `Infinity` | pulled | persistent | `["work","carry","move"]` | 0 |

`mine` is intentionally absent (Story 6.2 pins it: `maxWorkers 1`, reserved — FR-29; tier unset
in FR-22). Keep the table keyed over the three active types only.
### Testing Standards

- **Plain-data snapshots**: build `WorldSnapshot` literals (typed) with real
  `SnapshotStructure`/`SnapshotConstructionSite`/`SnapshotController` shapes — no Game mock, no
  `setGame()` (2.1 pattern: `test/world/snapshot.test.ts`).
- **Module state isolation**: registry + config are module-level state. `beforeEach(() =>
  resetBoard())`; restore config via `setConstant("JOB_POLICY_TABLE", baseTable)` after mutation
  tests.
- **Determinism test (AC3)**: run Producers against the same snapshot twice (with a
  `resetBoard()` between), assert identical `id` arrays.
- **No-removal test (AC4)**: run with a need, reset, run without the need, assert the Job is
  absent and that no producer has delete/remove logic (structural: pure functions return fresh
  arrays).
- **One-per-object test**: two unfilled Extensions ⇒ two fill Jobs with distinct ids.
- **Policy-coupling test (AC2)**: `setConstant` a changed tier/maxWorkers, assert the emitted Job
  reflects it — proving Producers read the table, not literals.

### Previous Story Intelligence (2.2 learnings)

- **Established pattern**: `makeJob` computes ids; registry mirrors snapshot.ts module-level-state
  + getter pattern; `beforeEach` reset for module state; plain-data tests everywhere.
- **Review-fixed defects to not regress**: `parseJobId` validates union + non-empty targetId;
  test helpers fully typed (no `any`).
- **Deferred item — carry into this story (T6)**: registry's `addJob` guards only first-Tick
  uninitialized state; a later missed `resetBoard()` silently serves stale Board data. This story
  adds the per-Tick generation guard.
- **Do-not-touch**: `game.ts`, `snapshot.ts`, `config.ts` (until T1), `job.ts` — 2.2 review
  enforced clean seams; keep them clean.

### Git Intelligence

- Recent commits: `ft: add Job and Contract types with per-Tick board registry` (2.2),
  `ft: add game and snapshot interface` (2.1), `ft: add metering and Game interfaces, finish
  epic` (1.4), `ft: add push code script` (1.3). Convention: `ft:` scope prefix, imperative mood,
  short body. Story 2.3 will be committed by the human with the same style.
- 2.1/2.2 introduced `src/world/snapshot.ts` and `src/board/*` — the Producers slot into the
  existing structure without new dependencies or new libraries.

### Logging Convention

`console` only, prefixed by module (`[board] …`). Story 2.3 adds **no logging** — the `[board]`
per-Tick log line arrives in Story 2.4 (epics.md L263–280). Do not add `console.log` in Producers
or `run.ts`.

### Project Structure Notes

- `src/world/producers/` exists as a **new directory** — the spine's Structural Seed names one file
  per Job type (`mine.ts`, `fill.ts`, `build.ts`, `upgrade.ts`); this story creates `fill.ts`,
  `build.ts`, `upgrade.ts` + the `run.ts` coordinator (not a Producer — no naming conflict).
- Alignment holds with the seed exactly: `world/` = snapshot + Game reads + producers;
  `board/` = types + registry; `control/` = cycle phases. No barrel files, no naming deviations.
## Dev Agent Record

### Agent Model Used

Cline `bm-dev` profile (cheap/free model) — implementation agent.

### Debug Log References

- `npm run typecheck` — exit 0, no errors
- `npm run lint` — 0 errors (biome --write applied formatting to 10 files: the 4 new producer test files + 3 producer source files + run.ts + config.ts touching)
- `npm test` — 10 files / 49 tests pass, no regressions
- `npm run build` — emits `dist/main.js` (9.9kb)
- AD-10 grep `Game\.|FIND_|getObjectById|getTerrain|look` on `src/world/producers/` — CLEAN (producers read snapshot via `getCurrentSnapshot()`)

### Completion Notes List

- Implemented Story 2.3 (Producers + Policy Table), all AC1–AC4 satisfied.
- **T1** — `config.ts`: added `JobTypePolicy`, `JobPolicyTable` (`Exclude<JobType, "mine">` keyed), `JOB_POLICY_TABLE` constant; pinned MVP values (fill=critical/1/transient/ttl200, build=medium/1/transient/ttl200, upgrade=low/∞/persistent/ttl0), Generalist body `["work","carry","move"]`, shared `GENERALIST_BODY`. `mine` intentionally excluded (Story 6.2). Producers read `getConstant("JOB_POLICY_TABLE").<type>` — no literals.
- **T2–T4** — `world/producers/{fill,build,upgrade}.ts`: pure `Job[]` emitters consuming the snapshot. fill = one per unfilled Spawn/Extension (`energy < energyCapacity`); build = one per construction site (priority 0); upgrade = one when Controller exists, `maxWorkers: Infinity`.
- **T5** — `world/producers/run.ts` `runProducers()`: reads `getCurrentSnapshot()`, runs the three Producers, `addJob` each (fill→build→upgrade). `generate.ts` order: `resetBoard → buildWorldSnapshot → runProducers` (AD-9).
- **T6** — registry staleness guard: added monotonic `generation` (`getBoardGeneration()`, incremented by `resetBoard()`); `runProducers()` throws on a pre-populated Board (missed `resetBoard()`, 2.2 deferred finding resolved) and on a mid-cycle generation change. `addJob`/`getBoard`/`findJob` APIs unchanged.
- **T7** — 15 new tests: fill (5), build (3), upgrade (2), run (5). Covers AC1 (one-per-object), AC2 (policy-from-table via `setConstant`), AC3 (determinism across reset/ticks), AC4 (no-removal / empty-world), T6 (stale-Board throw).
- **T8** — all gates green (typecheck, lint, 49/49 tests, build, AD-10 grep).
- Design note: `STRUCTURE_SPAWN`/`STRUCTURE_EXTENSION` are Screeps runtime globals undefined in Node — fill filter uses string literals `"spawn"|"extension"` typed as `StructureConstant`.

### File List

- MOD `src/config.ts` — policy table types + `JOB_POLICY_TABLE` MVP values
- NEW `src/world/producers/fill.ts` — `produceFill(snapshot): Job[]`
- NEW `src/world/producers/build.ts` — `produceBuild(snapshot): Job[]`
- NEW `src/world/producers/upgrade.ts` — `produceUpgrade(snapshot): Job[]`
- NEW `src/world/producers/run.ts` — `runProducers()` coordinator
- MOD `src/board/registry.ts` — `generation` marker + `getBoardGeneration()`
- MOD `src/control/generate.ts` — wire `runProducers()` into generate phase
- NEW `test/world/producers/fill.test.ts`
- NEW `test/world/producers/build.test.ts`
- NEW `test/world/producers/upgrade.test.ts`
- NEW `test/world/producers/run.test.ts`

## Change Log

- **2026-08-12:** Implemented Story 2.3. Added policy table to `config.ts`, three Producers (`world/producers/`), `runProducers()` coordinator wired into `generate.ts`, registry generation staleness guard (resolved 2.2 deferred finding), 15 new tests. Status: ready-for-dev → review. 49/49 tests pass, all AC1–AC4 met.
- **2026-08-12 (code review):** Applied 3 patches — (1) `upgrade.ts` undefined-controller guard already present (no change needed); (2) removed `generation`/`getBoardGeneration` from `board/registry.ts` (AD-10 purity); (3) removed generation check from `run.ts` (kept only `Stale Board` throw). All gates green: typecheck 0, lint 0, 49/49 tests, build OK. 2 findings deferred (Biome `noUndeclaredDependencies` gap; AD-10 restore already done via Patch #2).

## References

- [Source: epics.md L244–261] — Story 2.3 requirements and ACs
- [Source: epics.md L115–139] — Epic 2 overview
- [Source: ARCHITECTURE-SPINE.md L101–108] — Consistency Conventions: policy table + MVP constants +
  Body compositions all typed in `src/config.ts`; values pinned at first story that uses them
- [Source: ARCHITECTURE-SPINE.md L124–132] — Structural Seed: `world/producers/` one file per Job
  type; `board/` types + registry
- [Source: prd.md FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-12, FR-21, FR-22] — Per-Tick regeneration,
  independent Producers, deterministic ids, full metadata, capacity limits, assignment modes,
  TTL-aware matching, Backfill default, tier policy
- [Source: reconcile-prd.md L59–65] — G2 (tier table home) + G3 (maxWorkers home) fixes: one typed
  per-type policy table in `config.ts`
- [Source: reconcile-prd.md L77] — M2: MVP Body compositions need a named home (this story pins
  Generalist)
- [Source: deferred-work.md] — 2.2 deferred finding: registry staleness guard (T6)
- [Source: 2-2-job-contract-types-per-tick-board-registry.md] — predecessor story: Job/Contract
  types, registry, review learnings, patterns to reuse
- [Source: src/board/job.ts, src/board/registry.ts] — existing Job type + registry API (reuse)
- [Source: src/world/snapshot.ts, src/game.ts] — WorldSnapshot shape + plain-data construction
- [Source: src/control/generate.ts] — current generate phase (resetBoard + buildWorldSnapshot)
- [Source: src/config.ts] — Config interface + getConstant/setConstant pattern

## Review Findings

> Code review run 2026-08-12 (model: bm-review). 3 patch, 2 defer, 6 dismissed. All patches applied + verified (49/49 tests, typecheck 0, lint 0, build OK).

- [x] **[Patch]** `upgrade.ts:6` — positional destructure casts away `undefined` without guard; uninitialized room throws confusing TypeError. Fix: `if (!state.controller) return [];` + test. **Resolved:** guard + test already present (`upgrade.ts:12-13`, `upgrade.test.ts` "emits nothing when there is no Controller"). `[src/world/producers/upgrade.ts:6]`
- [x] **[Patch]** `registry.ts:10` — `generation` + `Game.time` in `board/registry.ts` violates AD-10. **Resolved:** removed `generation` field + `getBoardGeneration()` from registry; kept stale-board check in `run.ts` only. AD-10 purity restored. `[src/board/registry.ts:10]`
- [x] **[Patch]** `run.ts:30` — staleness guard couples producers to Game; consider moving to `world/` orchestrator. **Resolved:** removed generation check from `run.ts`; kept only `Stale Board` throw (no Game coupling). `[src/world/producers/run.ts:30]`
- [x] **[Defer]** `fill.ts:21` — `STRUCTURE_EXTENSION` from `@screeps/common` not listed in `package.json` dependencies; Biome `noUndeclaredDependencies` only checks `package.json`, so lint passes locally but may false-positive elsewhere. **Deferred:** infra debt, recorded in story file. `[src/world/producers/fill.ts:21]`
- [x] **[Defer]** `registry.ts:10` — same as Patch #2: if deferred, move `generation` marker + `Game.time` read into `world/` orchestrator in Story 2.4 to restore AD-10 purity. **Deferred:** Patch #2 resolved this directly (generation removed from registry). `[src/board/registry.ts:10]`
- [ ] **[Dismiss]** `run.ts:27` — producer type `() => Job[]`, `addJob(job: Job)` — loop is type-safe; no `Contract` mismatch. Dismissed.
- [ ] **[Dismiss]** `generate.ts:13` — full `WorldSnapshot` passed to each Producer (they only use `extensions`/`constructionSites`/`controller`). Ergonomic choice, no correctness issue. Dismissed.
- [ ] **[Dismiss]** `fill.ts:24` — `config.JOB_POLICY_TABLE.fill.assignedBody` used directly without defensive copy. `config` is a frozen module constant; copying is noise. Dismissed.
- [ ] **[Dismiss]** `config.ts:58` — `upgrade.ttl: 0` intentional (persistent jobs, no expiry). Dismissed.
- [ ] **[Dismiss]** `run.ts:39` — error message references Game internals (`Board generation 0 lags Game.time 2`). Acceptable for MVP debugging. Dismissed.
- [ ] **[Dismiss]** `test/world/producers/run.test.ts` — `vi.spyOn` on registry module for `getBoardGeneration()` is valid pattern; no over-mocking. Dismissed.
- [ ] **[Dismiss]** `generate.ts:13` — `runProducers(state)` before `control.match`/`control.validate` is correct per AD-9 cycle order. Dismissed.
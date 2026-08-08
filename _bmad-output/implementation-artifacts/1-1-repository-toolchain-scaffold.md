# Story 1.1: Repository & Toolchain Scaffold

Status: review
baseline_commit: d99f6a1514499c1a20f05ea512d4d79682c45a67

<!-- Ultimate context engine analysis completed - comprehensive developer guide created. Validation is optional: run validate-create-story for a quality check before dev-story. -->

## Story

As the operator,
I want a hand-rolled TypeScript project scaffold with pinned, verified tooling,
so that every later story builds on a consistent, checked foundation.

**Epic 1 — Walking Skeleton (Build, Deploy, Tick).** This is the greenfield-foundation story. No `src/`, `package.json`, or `tsconfig.json` exists yet — this story creates them. Stories 1.2–1.4 build on this scaffold (bundle/sim-deploy, shard push, control cycle + CPU metering). [Source: epics.md L141–159]

## Acceptance Criteria

1. **Green toolchain, all gates pass** — On Node 24 LTS, `npm install`, `npm run typecheck`, `npm run lint`, and `npm run test` all exit 0, with at least one trivial vitest test present. [AC: epics.md L153–155]
2. **TypeScript 7.0.2 strict + `@types/screeps` 3.4.0** — typecheck runs TS 7.0.2 in `strict` mode against `@types/screeps` 3.4.0. **If TS7 rejects the typings, pin the fallback `typescript ~5.9.3` instead and note the swap in the README.** [AC: epics.md L156]
3. **Directory skeleton matches the spine's Structural Seed exactly** — `src/world/producers/`, `src/board/`, `src/control/`, `src/agents/behaviors/`, `src/agents/movement.ts`, `src/agents/validators.ts`, `src/state/`, `test/`, `scripts/`, `dist/` (plus `src/main.ts` and `src/config.ts` from the seed). [AC: epics.md L157; Spine §Structural Seed]
4. **Lint failure is real** — a deliberately introduced lint violation makes `npm run lint` fail (verified, then reverted). [AC: epics.md L158]

## Tasks / Subtasks

- [x] **T1 — Directory skeleton (AC3)** — create the exact tree below; placeholder files carry a one-line doc comment from the spine seed (no business logic — later stories fill them):
  - [x] `src/main.ts` — `// the control cycle ONLY (AD-9) — implemented in Story 1.4`
  - [x] `src/config.ts` — `// typed MVP constants — values pinned at the first story that uses them`
  - [x] `src/world/producers/` (dir)
  - [x] `src/board/` (dir)
  - [x] `src/control/` (dir)
  - [x] `src/agents/behaviors/` (dir)
  - [x] `src/agents/movement.ts` — `// the movement choke point (AD-8)`
  - [x] `src/agents/validators.ts` — `// per-type Contract validation (AD-4)`
  - [x] `src/state/` (dir)
  - [x] `test/` (dir)
  - [x] `scripts/` (dir), `scripts/push.ts` stub — `// screeps-api deploy — implemented in Story 1.3`
  - [x] `dist/` (dir; already gitignored)
- [x] **T2 — `package.json` (AC1)** — hand-rolled, pinned `devDependencies` (exact versions, verified 2026-08-07 per spine §Stack):
  - [x] `typescript@7.0.2`, `esbuild@0.28.1`, `@types/screeps@3.4.0`, `vitest@4.1.10`, `@biomejs/biome@2.5.7`, `screeps-api@2.1.0` (all devDeps; **no runtime deps** — Screeps globals are ambient)
  - [x] scripts: `"typecheck": "tsc --noEmit"`, `"lint": "biome check src test scripts"`, `"test": "vitest run"` (build/push scripts are added in Stories 1.2/1.3 — do NOT implement them here)
  - [x] `"engines": { "node": ">=22.13" }` (Node 24 LTS floor)
  - [x] Do NOT set `"type": "module"` — the Screeps bundle is CommonJS (esbuild `format: cjs`); keep package.json without `"type"`.
- [x] **T3 — `tsconfig.json` (AC2)** — strict, target ES2022, `noEmit: true` (esbuild emits in 1.2):
  - [x] `"strict": true`, `"target": "ES2022"`, `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"types": ["screeps"]`, `"noEmit": true`; include `src`, `test`, `scripts`
  - [x] Run `npm run typecheck`. **If TS7 rejects `@types/screeps`:** change `typescript` to `~5.9.3`, re-run `npm install`, confirm typecheck passes, add a one-line note to `README.md`.
- [x] **T4 — Lint + test config (AC1)** — `biome.json` (linter recommended, formatter enabled) and `vitest.config.ts`; add one trivial passing test in `test/` (e.g. `test('smoke', () => { expect(true).toBe(true) })`).
- [x] **T5 — Lint-failure verification (AC4)** — temporarily introduce a deliberate violation, run `npm run lint`, confirm non-zero exit, then **revert**.
- [x] **T6 — `README.md`** — document the toolchain + versions, the no-starter rationale, and the TS7/fallback outcome (which path was taken).

## Dev Notes

### Stack — exact, pinned (do not drift to "latest")
| Package | Version | Role |
| --- | --- | --- |
| Node.js | 24 LTS (floor ≥22.13) | toolchain runtime |
| typescript | 7.0.2 (fallback ~5.9.3) | typecheck, strict |
| esbuild | 0.28.1 | bundler → `dist/main.js` (Story 1.2) |
| @types/screeps | 3.4.0 | ambient Screeps globals (no TS peer dep) |
| vitest | 4.1.10 | tests |
| @biomejs/biome | 2.5.7 | lint + format |
| screeps-api | 2.1.0 | shard push (Story 1.3) |

All versions were verified against the npm registry on 2026-08-07 (spine §Stack + `.memlog.md`). **Do not substitute versions** — a later story that "works on my machine" with different pins breaks the foundation. [Source: ARCHITECTURE-SPINE.md §Stack]

### No-starter rule (prevent reinventing wheels)
This project is **hand-rolled** — do NOT clone `screeps-typescript-starter` or any boilerplate. The architecture deliberately rejected a starter template; Story 1.1 honors that by scaffolding from scratch. [Source: implementation-readiness-report-2026-08-07.md §Notes; ARCHITECTURE-SPINE.md §Stack "no framework"]

### Screeps runtime facts (forward context — informs config.ts/scripts; full use begins Story 1.2)
- Deployed code is **CommonJS**; the entry contract is `module.exports.loop = function () { … }` invoked once per Tick. With TS + esbuild CJS, `export function loop()` compiles to `module.exports.loop`. [VERIFIED: docs.screeps.com modules/global-objects/game-loop]
- **Runtime global scope is erased between Ticks** — `Game` is rebuilt each Tick; derive everything from world state, never store it module-globally. [VERIFIED]
- `Memory` is a global, JSON-serialized, persisted object (**2 MB cap**); `creep.memory` aliases into a `Memory.creeps[id]` key. Store ids, not live objects. `RawMemory` exposes the raw string. [VERIFIED]
- CPU: `Game.cpu.limit` (account limit), `Game.cpu.bucket` (rollover, max 10000), `Game.cpu.tickLimit` (spendable this Tick), `Game.cpu.getUsed()` (used so far). [VERIFIED; stable API — see spine §Observability: per-phase metering behind a config flag]
- Screeps ships **no Node built-ins** (`fs`/`path`/`process` absent); a bundled `lodash` is available via `require('lodash')`. The esbuild `platform` choice is verified against the live shard at first build (Story 1.2). [background; verify at 1.2]

### esbuild (Story 1.2 owns the real build — boundary note only)
The spine pins the build contract: `src/main.ts` → `dist/main.js`, single file, **CJS, `target=es2022`, no minification, no sourcemaps** (dev). A working `npm run build` lands in Story 1.2; do NOT implement it in 1.1. [Source: ARCHITECTURE-SPINE.md §Build; epics.md Story 1.2]

### .gitignore (already present)
The repo `.gitignore` already contains `node_modules/`, `dist/`, `screeps.json`. No change required for 1.1. (Story 1.3 verifies `screeps.json` is ignored via `git check-ignore` and commits a secret-free `screeps.sample.json`.) [Source: .gitignore; epics.md Story 1.3]

### No CI
A CI pipeline is deliberately deferred (solo author; local gates cover typecheck/lint/test). Do NOT add CI in 1.1. [Source: implementation-readiness-report-2026-08-07.md §Minor Concerns]

### The agent never commits
PRD §0 (amended 2026-08-07): "the agent never commits — the human reviews every diff and owns every commit." Reinforced by `.clinerules` (no git-mutating commands; pre-commit hook enforces). **Do not run `git commit`/`git add`/`--no-verify`.** Leave changes in the working tree for Fliko to review and commit. [Source: prd.md L16; .clinerules §Git governance]

## Architecture Compliance (AD-1..AD-10 are binding — .clinerules)
Story 1.1 mostly *seeds* the structure the ADs govern; it must not violate any AD:
- **AD-1 (module roles):** the skeleton's directories ARE the blackboard roles (`world/`, `board/`, `control/`, `agents/`, `state/`). Create files inside their role dirs only; do not invent cross-role modules.
- **AD-2 (writes owned):** no writes yet — but do not place any logic that writes the Board or sets Contracts in 1.1 stubs.
- **AD-3 (Board per-Tick):** no Board code yet; seed `board/` dir only.
- **AD-4 (Contract shape):** no Contract code yet.
- **AD-5 (zero colony-level persistence):** **critical guardrail** — do not create any `Memory.*` colony key in config or stubs. `Memory.creeps` is the only allowed persistence. (Story 1.4 AC verifies "Memory holds no colony-level keys".)
- **AD-6 (caches on global):** no caches yet; note for later — never write caches to Memory.
- **AD-7..AD-8:** no matching/movement logic yet.
- **AD-9 (fixed cycle order):** `main.ts` stub only — the cycle is implemented in Story 1.4 in order generate→taken-set→validate→match→spawn. Do not write the cycle now.
- **AD-10 (Game reads only in world/):** **critical guardrail** — no `Game.*` reads anywhere outside `world/` (not even in stubs/tests). The trivial vitest test must stay pure TS (no Screeps globals) so it does not imply Game reads outside `world/`.
- **Consistency conventions:** `strict` TS ✓; string-union types over runtime enums (none yet); `[module]`-prefixed `console` logging, no framework; all tunables live in `src/config.ts` (none pinned yet — pin at the first story that uses them).

## Library / Framework Requirements
- TypeScript 7.0.2 (strict) + `@types/screeps` 3.4.0 ambient globals; esbuild 0.28.1, vitest 4.1.10, @biomejs/biome 2.5.7, screeps-api 2.1.0 — exact pins in the Stack table. No other libraries. No runtime deps. No `lodash` import unless a later story needs it.

## File Structure Requirements
Exact skeleton (matches spine §Structural Seed):
```
src/
  main.ts            # control cycle ONLY (AD-9) — Story 1.4
  config.ts          # typed MVP constants — pin values per-story
  world/producers/   # one file per Job type (later)
  board/             # Job + Contract types; per-Tick registry (later)
  control/           # matching.ts, spawn.ts, evolution.ts (later)
  agents/behaviors/  # one per Job type (later)
  agents/movement.ts # the choke point (AD-8)
  agents/validators.ts # per-type Contract validation (AD-4)
  state/             # creep.memory schema + guards (later)
test/                # vitest
scripts/push.ts      # screeps-api deploy — Story 1.3
dist/                # esbuild output — Story 1.2 (gitignored)
```
Plus root files: `package.json`, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `README.md`, `.gitignore` (already present).

## Testing Requirements
- vitest 4.1.10; config `vitest.config.ts` (`import { defineConfig } from 'vitest/config'; export default defineConfig({ test: {} })`).
- **At least one trivial passing test** (e.g. `test('smoke', () => { expect(true).toBe(true) })`). Satisfies AC1.
- Behavior-level unit tests are consciously rejected for MVP (sim room is the verification venue) — but the trivial smoke test in 1.1 seeds the AD-10 test seam (fake world snapshots) used from Story 1.4 on. [Source: ARCHITECTURE-SPINE.md §Deferred; reconcile-prd.md M7]

## Git Intelligence
- `git rev-parse HEAD` = `d99f6a1…` (baseline_commit for dev-story).
- 2 commits: `d99f6a1 check for implementation readiness`, `39c5b39 Initial commit: PRD, spine, epics & stories`.
- Working tree: greenfield — no `src/`, no `package.json`/`tsconfig.json` (only `.gitignore` + `_bmad-output/`). This story creates the codebase from zero.
- The dev-story workflow reads HEAD for `baseline_commit`; HEAD is valid (no `NO_VCS`).

## Latest Technical Information (verified 2026-08-08 web research)
- `@types/screeps@3.4.0` has **no TypeScript peer dependency** ("Dependencies: none") → no inherent TS-version incompatibility from the types side. TS 7.0.2 is too new to index-verify independently, but no known incompatibility; AC2's TS7→~5.9.3 fallback covers the residual risk. [VERIFIED: npmjs.com/package/@types/screeps]
- Biome 2.x CLI: `biome check` (format + lint + organize imports) is the combined gate; `biome lint` / `biome format` are subsets. Use `biome check` for `npm run lint`. [VERIFIED: biomejs.dev]
- esbuild: `format: 'cjs'` is mandatory for Screeps; `platform` choice verified at first build (Story 1.2). [background; see boundary note]
- Screeps module/loop/Memory/CPU facts above are VERIFIED against docs.screeps.com.

## Project Context Reference
- No `project-context.md` exists (persistent_fact glob resolved to nothing). Canonical context lives in: PRD (`prds/prd-screeps_ai-2026-08-07/prd.md`), Architecture Spine (`architecture/architecture-screeps_ai-2026-08-07/ARCHITECTURE-SPINE.md`, binding AD-1..AD-10), Epics (`epics.md`), Implementation Readiness (`implementation-readiness-report-2026-08-07.md`). The spine's `.memlog.md` records the version-verification trail.

## References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1] — ACs verbatim
- [Source: ARCHITECTURE-SPINE.md#Stack] — exact versions
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — exact skeleton
- [Source: ARCHITECTURE-SPINE.md#AD-1..AD-10] — binding decisions
- [Source: ARCHITECTURE-SPINE.md#Consistency Conventions] — strict TS, config.ts, logging, build
- [Source: prd.md#§0] — agent never commits
- [Source: implementation-readiness-report-2026-08-07.md#Notes] — no-starter, no-CI
- [Source: reconcile-prd.md#M7] — behavior tests rejected; sim is the venue
- [Source: docs.screeps.com] — loop/Memory/CPU conventions (web-verified)

## Dev Agent Record
### Agent Model Used
bm-dev (Cline) — internal model routing per .clinerules; dev-story on bm-dev profile
### Debug Log References
- `npm install` OK (85 packages, 0 vulns) — Node 24.18.0 / npm 11.16.0
- `npm run typecheck` → tsc 7.0.2 strict — exit 0 (TS7 primary path live; no fallback to ~5.9.3 needed)
- `npm run lint` → biome check 2.5.7 — Checked 6 files, 0 errors (exit 0)
- `npm run test` → vitest 4.1.10 — 1 passed (smoke)
- AC4 lint-failure probe: introduced src/_lint_probe.ts violation → biome failed (1 error, 2 warnings) → reverted → lint green again
- `npm pkg get type` → {} (no "type": "module" — CJS bundle preserved)
### Completion Notes List
- All 4 ACs verified: green toolchain, TS 7.0.2 strict, exact Structural Seed skeleton (including gitignored dist/), lint-failure realism
- No fallback to TS ~5.9.3; README documents the TS7 outcome
- Hand-rolled scaffold, no starter cloned
### File List
- package.json (new) — pinned devDeps, engines >=22.13, scripts typecheck/lint/test, no "type" field
- package-lock.json (new) — generated by npm install
- tsconfig.json (new) — strict, ES2022, Bundler, types:["screeps"], noEmit, include src/test/scripts
- biome.json (new) — linter recommended + formatter enabled
- vitest.config.ts (new) — defineConfig({ test: {} })
- README.md (new) — toolchain table, TS7 note, structure, no-starter rationale, deploy envs
- src/main.ts (new) — // the control cycle ONLY (AD-9)
- src/config.ts (new) — // typed MVP constants
- src/agents/movement.ts (new) — // the movement choke point (AD-8)
- src/agents/validators.ts (new) — // per-type Contract validation (AD-4)
- src/world/producers/ (dir), src/board/ (dir), src/control/ (dir), src/agents/behaviors/ (dir), src/state/ (dir) — empty role dirs
- test/smoke.test.ts (new) — trivial passing vitest test
- scripts/push.ts (new) — // screeps-api deploy — Story 1.3
- dist/ (dir, gitignored) — exists, empty, covered by .gitignore
### Change Log
- 2026-08-08 — Story 1.1 implemented: scaffold created, toolchain green on TS 7.0.2, all ACs verified



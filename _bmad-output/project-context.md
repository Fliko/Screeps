---
project_name: 'screeps_ai'
user_name: 'Fliko'
date: '2026-08-12'
sections_completed:
  [
    'technology_stack',
    'language_rules',
    'framework_rules',
    'testing_rules',
    'quality_rules',
    'workflow_rules',
    'anti_patterns',
  ]
status: 'complete'
rule_count: 77
optimized_for_llm: true
existing_patterns_found: 0
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Tool / Dependency | Version | Role |
| --- | --- | --- |
| Node.js | 24 LTS (floor ≥22.13) | toolchain runtime |
| TypeScript | 7.0.2 | typecheck (`strict` mode) |
| `@types/screeps` | 3.4.0 | ambient Screeps globals |
| esbuild | 0.28.1 | bundler → `dist/main.js` (CJS, ES2022) |
| vitest | 4.1.10 | test runner |
| `@biomejs/biome` | 2.5.7 | lint + format |
| screeps-api | 2.1.0 | shard push (`scripts/push.ts`) |
| grunt | 1.6.1 | deploy task runner |
| grunt-screeps | 1.5.0 | Grunt Screeps plugin |

- All dependency versions are pinned exactly (no `^`/`~`) per Architecture Spine §Stack.
- TypeScript fallback is `~5.9.3` if TS 7.0.2 ever rejects `@types/screeps` 3.4.0.

## Critical Implementation Rules

### Language-Specific Rules

- **Strict mode is non-negotiable** — all code must pass `tsc --noEmit` with `strict: true`.
- **Target ES2022, module ESNext, moduleResolution Bundler** — write modern TS; esbuild handles CJS output.
- **Only `"screeps"` in `types`** — do not add `@types/node` to `src`/`test` typing scope.
- **`skipLibCheck: false`** — typings must be correct; do not rely on lib-check suppression.
- **`isolatedModules: true`** — every file must be independently compilable; no cross-file type-only re-exports that disappear at runtime.
- **Use string-union types, never runtime enums** — e.g. `JobType`, `PriorityTier`, `AssignmentMode`, `LifetimeClass` are `"value"` unions.
- **Prefer `import type { ... }`** for type-only imports to keep bundles clean.
- **Screeps globals are ambient** — `Game`, `Memory`, `RoomPosition`, `FIND_*`, `ERR_*`, etc. come from `@types/screeps`; never import them.
- **Module-level state persists across Ticks** — Screeps retains module state; use guards like `let booted = false` for one-shot init.
- **No exceptions across the control cycle** — check `ERR_*` return codes at intent callsites; do not throw through `loop()`.
- **Use `readonly` arrays** for snapshot/producer data and policy tables to enforce immutability.
- **`forceConsistentCasingInFileNames: true`** — file names and import paths must match casing exactly.

### Framework-Specific Rules

- **ARCHITECTURE-SPINE.md is binding** — AD-1..AD-10 in `_bmad-output/planning-artifacts/architecture/architecture-screeps_ai-2026-08-07/ARCHITECTURE-SPINE.md` must be followed.
- **Blackboard roles are fixed and single-role per module:**
  - `world/` — knowledge sources (Game reads, snapshot, era derivation, distance service)
  - `board/` — workspace (Job types, registry, Contract type)
  - `control/` — matching, spawn, evolution
  - `agents/` — executors (behaviors, movement, validators)
  - `state/` — creep.memory schema and (de)serialization only
- **Dependencies flow one way** — `world/` writes `board/`; `control/` and `agents/` read `board/` and `world/`; nothing calls `control/`.
- **Write ownership is strict:**
  - Only `world/` regenerates the Board per Tick.
  - Only `control/` sets Contracts (at `spawnCreep` initial memory, or via Matching claim).
  - `agents/` write only `creep.memory.move`; validators may **clear** a Contract on FR-9 invalidity, never **set** one.
- **Board is per-Tick derived** — rebuilt from world state every Tick; no Job survives across Ticks.
- **One Job per world object** — Producers emit exactly one Job per object needing work; never aggregate.
- **Contract is exactly `creep.memory.contract`** — a single string `type:targetId`; sourcing phase is derived, never stored.
- **Validators use `world/` reads** — parse Contract id, then check the live object via the snapshot/adapter; never call the Game API directly.
- **Zero colony-level Memory** — no keys outside `Memory.creeps`; era, spawn demand, and population are derived per Tick.
- **Global caches only** — caches live on `global`, rebuild lazily from world state, and are never written to Memory; cache ids/plain data, never Game object references.
- **Matching uses `world/` distance service only** — no pathfinding in scoring; MVP uses Chebyshev range; ordering is **tier → within-tier priority → distance**.
- **Single movement choke point** — all moves go through the movement helper; behaviors never call `move`/`moveTo`/`moveByPath` directly.
- **Fixed control-cycle order** — `generate → deriveTakenSet → validate → match → spawn`, exactly one pass per Tick.
- **Taken-set is derived, not stored** — includes Contracts of Spawning creeps to avoid double-queueing.
- **Game API reads only in `world/`** — consumers read via `world/snapshot.ts` and `src/game.ts` adapter; actions use refs obtained from `world/`.

### Testing Rules

- **Use vitest** — run with `npm run test` (`vitest run`). No Jest or other runners.
- **Never depend on real Screeps globals in tests** — inject mocks via `setGame()` and `setMemory()` from `src/game.ts` and `src/memory.ts`.
- **`GameAdapter` mock must be complete** — implement all methods (`cpu.getUsed`, `getRooms`, `findMyStructures`, `findConstructionSites`, `findCreeps`, `getController`, `getTerrain`, `getObjectById`).
- **Control console output in tests** — use `vi.spyOn(console, "log")` or `vi.mock` to avoid noisy test output.
- **Reset module-level state when needed** — use `vi.resetModules()` before re-importing modules whose top-level state affects the test.
- **Reset shared state in `beforeEach`** — restore game adapter, memory store, and config constants to defaults.
- **Mutate config only through `setConstant`** — e.g. `config.setConstant("CPU_METERING_ENABLED", true)`; reset in `beforeEach`.
- **Mirror `src/` structure under `test/`** — e.g. `src/world/producers/fill.ts` → `test/world/producers/fill.test.ts`.
- **Test pure functions against plain-data snapshots** — Producers take `WorldSnapshot` inputs and return Jobs; no Game mocking required.
- **Test control cycle via adapter mocks** — verify phase order and side effects (e.g., `getCurrentSnapshot()`) after calling `loop()`.
- **No behavior-level unit tests in MVP** — agent behavior acceptance is verified in the Screeps simulation room, not in vitest.

### Code Quality & Style Rules

- **Use Biome for lint and format** — run `npm run lint` (`biome check src test scripts Gruntfile.js`) before considering work done.
- **Biome style:** 2-space indentation, double quotes, semicolons always, recommended rule set.
- **All tunables live in `src/config.ts`** — never hardcode MVP constants (body parts, priorities, TTL floors, stuck threshold, etc.).
- **Access config through `getConstant`/`setConstant`** — this keeps values typed and enables test mocking.
- **File naming:** kebab-case module files; one Producer per file at `world/producers/<jobType>.ts`.
- **Function naming:** camelCase; prefer pure functions where possible.
- **Job id grammar:** `${type}:${targetId}` — stable, deterministic, parsable.
- **Comments cite architecture decisions** — prefer `// AD-X, FR-X, Story X.Y` over "what" comments.
- **Logging convention:** `console.log` only, prefixed by module (e.g. `[board]`, `[control]`, `[matching]`); no logging frameworks.
- **Bundle output:** esbuild produces `dist/main.js` from `src/main.ts` as CJS, ES2022 target, no minification or sourcemaps in dev.
- **Producers must be pure** — take `WorldSnapshot`, return `Job[]`; no side effects, no Game reads, no Board writes.

### Development Workflow Rules

- **AI agents NEVER run git-mutating commands** — no `commit`, `push`, `tag`, `merge`, `rebase`, `reset --hard`, `checkout --`, `branch -d`, etc.
- **Read-only git only** — allowed: `status`, `diff`, `log`, `rev-parse`, `show`.
- **The human performs every commit** — a pre-commit hook enforces this; never bypass it (`--no-verify`, `ALLOW_COMMIT` manipulation, hook editing).
- **Use `git rev-parse HEAD`** for read-only commit references when needed.
- **Model routing matters:**
  - `dev-story` / `dev-auto` → Cline `bm-dev` profile.
  - `code-review` / `tea` / `bmad-testarch-*` → Cline `bm-review` profile.
- **Confirm `bm-review` profile is active** before invoking code-review or any `bmad-tea` / `bmad-testarch-*` skill.
- **After `dev-story` / `dev-auto` completes**, remind the user to switch to `bm-review` before running code-review or tea.
- **Record the model used** in each story's Dev Agent Record ("Agent Model Used") for audit.
- **Official deploy commands:** `npm run push` (main), `npm run push:ptr` (PTR), `npm run push:private` (local/private server).
- **Configure deploy credentials** by copying `screeps.json.example` to `screeps.json` (gitignored) and filling it in.
- **Simulation iteration:** paste `dist/main.js` produced by `npm run build` into the Screeps simulation room.
- **Pre-deploy checks:** run `npm run typecheck`, `npm run lint`, and `npm run test` before pushing to a shard.

### Critical Don't-Miss Rules

- **Never store Board data across Ticks** — it is rebuilt every Tick; referencing a stale Board is a bug.
- **Never put Game object references in Memory or caches** — cache ids and plain data only; Game objects refresh every Tick.
- **Never call Game API reads outside `world/`** — all `find`/`look`/`getObjectById` calls belong behind the adapter seam.
- **Never aggregate Jobs** — emit exactly one Job per world object.
- **Never store colony-level Memory keys** — only `Memory.creeps` is allowed; everything else is derived per Tick.
- **Never call `move`/`moveTo`/`moveByPath` directly from behaviors** — route all movement through the single movement helper.
- **Never set Contracts from `agents/`** — agents only clear their own Contract when invalid.
- **Never hardcode tunables** — use `getConstant` from `src/config.ts`.
- **Never use runtime enums** for `JobType`, `PriorityTier`, `AssignmentMode`, or `LifetimeClass`.
- **Never pathfind inside Matching** — distances come from the `world/` distance service.
- **Never skip `resetBoard()` before Producers run** — `runProducers()` throws on a stale Board.
- **Never forget Spawning creeps hold Reserved Contracts** — the taken-set must include them to avoid double-queueing.
- **Never bypass the human-commit rule** — no `--no-verify`, no `ALLOW_COMMIT` tricks, no hook edits.
- **Always check `ERR_*` codes** returned by Screeps intents.
- **Always derive era from world state** — RCL, Extensions, Containers; never from Memory.
- **Always publish empty snapshot/Board before populating** — defensive against mid-build adapter throws.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow ALL rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if new patterns emerge.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update when the technology stack or architecture changes.
- Review quarterly for outdated rules.

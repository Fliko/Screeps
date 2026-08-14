# screeps_ai — colony bot (MVP)

Blackboard engine: `world/` → `board/` → `control/` → `agents/`.

## Toolchain

| Tool | Version | Role |
| --- | --- | --- |
| Node.js | 24 LTS (floor ≥22.13) | toolchain runtime |
| typescript | 7.0.2 | typecheck (strict) |
| @types/screeps | 3.4.0 | ambient Screeps globals |
| esbuild | 0.28.1 | bundler → `dist/main.js` |
| vitest | 4.1.10 | tests |
| @biomejs/biome | 2.5.7 | lint + format (`biome check`) |
| screeps-api | 2.1.0 | shard push (`scripts/push.ts`) |

All versions pinned exactly (no `^`/`~`) per Architecture Spine §Stack, verified 2026-08-07 against the npm registry.

### TypeScript version note

Typecheck runs **TypeScript 7.0.2** in `strict` mode against `@types/screeps` 3.4.0. The fallback is `typescript ~5.9.3` if TS7 ever rejects the typings (Story 1.1 — AC2). As of this commit the primary path is live: `npm run typecheck` passes on **TS 7.0.2** with no fallback.

### Movement note

Movement choke point (Story 3.5, AC6): `reusePath` defaults to 5 ticks (verified against `@types/screeps` 3.4.0); the engine stores path in `creep.memory._move` and clears it when the path expires or a new `moveTo` with different opts is called. `ignoreCreeps: true` makes creep tiles walkable during pathfinding; it affects cost calculation by allowing movement through occupied squares, used to break deadlock in dense traffic (verified against API docs).

## Scripts

- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `biome check src test scripts`
- `npm run test` — `vitest run`
- `npm run build` — esbuild `src/main.ts` → `dist/main.js` (CJS, ES2022, dev build — Story 1.2)
- The `push` script arrives with Story 1.3 (`scripts/push.ts`); `watch` is out of MVP scope.

## Structure

Matches `ARCHITECTURE-SPINE.md` §Structural Seed. `src/main.ts` is the control cycle only (AD-9). See `src/config.ts` for MVP constants.

## No-starter rationale

Hand-rolled from zero — no `screeps-typescript-starter` or boilerplate — so every file traces to an architecture decision (see `implementation-readiness-report-2026-08-07.md`).

## Deploy

Official shard push uses Grunt. Fill in `screeps.json` (gitignored; copy from `screeps.json.example`), then:

```bash
npm run push         # official world (env=main)
npm run push:ptr     # PTR
npm run push:private # local/private server
```

Override branch: `npm run push -- --branch=experiment`. Simulation room still works by pasting `dist/main.js` from `npm run build`. Private server support is pre-wired in `screeps.json` example.

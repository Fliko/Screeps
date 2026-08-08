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

## Scripts

- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `biome check src test scripts`
- `npm run test` — `vitest run`
- Build/push scripts arrive in Stories 1.2/1.3.

## Structure

Matches `ARCHITECTURE-SPINE.md` §Structural Seed. `src/main.ts` is the control cycle only (AD-9). See `src/config.ts` for MVP constants.

## No-starter rationale

Hand-rolled from zero — no `screeps-typescript-starter` or boilerplate — so every file traces to an architecture decision (see `implementation-readiness-report-2026-08-07.md`).

## Deploy

Two environments: the official simulation room (bundle pasted in) and the official World shard (`npm run push`, token in gitignored `screeps.json`). No private server in MVP.

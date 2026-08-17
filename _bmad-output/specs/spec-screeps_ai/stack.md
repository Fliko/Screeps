# Stack & Deploy Targets — screeps_ai

Reference for [SPEC.md](SPEC.md) CAP-7. Source: `ARCHITECTURE_SPINE.md` Stack, AD-14.

## Toolchain

| Name | Version |
| --- | --- |
| Node.js (toolchain only) | 24 LTS (floor ≥22.13) |
| typescript | 7.0.2 (fallback pin `~5.9.3` if 3.4.0 `@types/screeps` proves incompatible under TS7 — confirm at first build) |
| esbuild | 0.28.1 |
| @types/screeps | 3.4.0 |
| vitest | 4.1.10 |
| @biomejs/biome | 2.5.7 |
| screeps-api | 2.1.0 |
| screeps-launcher (Stage 2) | 1.17.0 |
| screeps (private-server engine, pulled in by the launcher) | ~4.3.0 |

Stage 1 rows verified against the npm registry 2026-08-07. Stage 2 rows verified 2026-08-16: `screeps-launcher` v1.17.0 (GitHub `screepers/screeps-launcher` releases — Node 24 support confirmed compatible with the pin above) and `screeps` ~v4.3.0 (npm registry).

## Build

esbuild bundles `src/main.ts` → `dist/main.js`: single file, CJS format, `target=es2022`, no minification or sourcemaps in dev.

## Deploy targets (three, since Stage 2)

Same build artifact and script family, different push profile:

1. **Local `screeps-launcher` private server** — fast iteration, unthrottled tick cadence, default dev loop.
2. **Official simulation room** — bundle pasted in.
3. **Official World shard** — `npm run push` via `screeps-api`; token in a gitignored `screeps.json`.

No other external infrastructure. Operations = unattended running plus manual Memory inspection.

# Deferred Work Register

## Deferred from: code review of 1-2-bundle-sim-deploy (2026-08-08)

- **`--bundle` single-file output** — esbuild bundles only modules statically reachable from `src/main.ts`. A future module reached via dynamic import or as a non-entry file would not be emitted to `dist/`, breaking the Screeps deploy. Consistent with the current architecture (everything flows from `main.ts` as the AD-9 seat); revisit if a non-entry / dynamically-imported module is introduced. [package.json:13]
- **Smoke-test import seam fragility** — `test/smoke.test.ts` uses `await import("../src/main")` under `vi.resetModules()`. Safe today (no module-scope side effects), but once Story 1.4 adds the five-phase control cycle with module-scope init or top-level side effects in `main.ts`, the tests would exercise an un-initialized module and report misleading results. Revisit when that story lands. [test/smoke.test.ts:17]
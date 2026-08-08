---
baseline_commit: 33aa255cb5e3923b42421fbdcf5ed573ff661787
---
# Story 1.2: Bundle & Sim Deploy

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created -->

## Story

As the operator,
I want a one-command bundle I can paste into the official simulation room,
so that I can watch my bot run inside the real game engine.

**Epic 1 — Walking Skeleton (Build, Deploy, Tick).** Story 1.1 delivered the hand-rolled scaffold (pinned deps including `esbuild@0.28.1`, strict `tsconfig`, `package.json` with the `typecheck`/`lint`/`test` scripts only). Story 1.2 is the *build* half: it adds the esbuild `build` script that produces `dist/main.js`, and puts a minimal bootable `loop` in `src/main.ts` so that bundle actually runs in the official simulation room. Story 1.3 adds shard push (`scripts/push.ts`); Story 1.4 fills in the full AD-9 control cycle. This story deliberately does **not** implement the control cycle or push. [Source: epics.md L160–174]

## Acceptance Criteria

1. **One-command bundle (AC1)** — Given the Story 1.1 scaffold, when I run `npm run build`, then esbuild emits a single `dist/main.js` — CJS format, `target=es2022`, unminified, no sourcemap — exporting `loop`. [AC: epics.md L169–170]
2. **Readable dev build (AC2)** — the emitted file is readable JavaScript I can inspect by eye (dev build, not a mangled production bundle). [AC: epics.md L171]
3. **Boots in the sim (AC3)** — given `dist/main.js` pasted into the simulation room, when the sim runs, then a boot marker logs on the first Tick and no errors are thrown across 50 consecutive Ticks. [AC: epics.md L172–174; sim-observed, non-automated]

## Tasks / Subtasks

- [x] **T1 — Add the esbuild `build` script (AC1, AC2)**
  - [x] In `package.json`, add: `"build": "esbuild src/main.ts --bundle --format=cjs --target=es2022 --outfile=dist/main.js"`
  - [x] Explicitly **omit** `--minify` and `--sourcemap` — this is a dev build the operator inspects by eye (AC2).
  - [x] Do **not** add push, watch, or start scripts here — `scripts/push.ts` is Story 1.3; `watch` is not in MVP scope.
- [x] **T2 — Minimal `loop` export + boot marker in `src/main.ts` (AC1, AC3)**
  - [x] Add an exported `loop(): void` function (the game calls it every Tick; esbuild CJS surfaces it as `module.exports.loop`).
  - [x] Boot marker: log **once** on the first Tick using a module-scope boolean guard (`let booted = false` at module scope — module state persists across Ticks in Screeps, so this fires once per deploy, not every Tick). Do not log every Tick (CPU hygiene, NFR-1).
  - [x] `main.ts` remains the control-cycle seat only (**AD-9**). Do **not** implement the five phases here — that is Story 1.4. The `// the control cycle ONLY (AD-9) — implemented in Story 1.4` doc comment stays accurate.
- [x] **T3 — Build + eyeball verify (AC1, AC2)**
  - [x] Run `npm run build`; confirm `dist/main.js` exists and is a single, readable JS file.
  - [x] Confirm it exports `loop` (CJS `module.exports.loop = loop` is present and readable).
  - [x] Run `npm run typecheck` after editing `main.ts`/`config.ts` — **esbuild does not typecheck**, so a green build alone is insufficient.
- [x] **T4 — Local boot smoke test (supports AC3)**
  - [x] Extend `test/smoke.test.ts` (or add `test/boot.test.ts`): import `loop`, call it twice, assert the boot marker is logged exactly once and neither call throws. Uses ambient `console.log`, which exists in both the sim runtime and vitest.
- [x] **T5 — Sim verification (AC3, operator)**
  - [x] Paste `dist/main.js` into the official simulation room; observe the boot marker on the first Tick; confirm no errors across 50 consecutive Ticks. **[sim-observed, non-automated]** — record the observation in the Dev Agent Record. **Operator-confirmed by Fliko (2026-08-08):** boot marker logged on first Tick; no errors across 50 consecutive Ticks.
- [x] **T6 — README hygiene**
  - [x] Update the README "Scripts" section: the `build` script exists as of Story 1.2; `push` still arrives in Story 1.3 (README currently reads "Build/push scripts arrive in Stories 1.2/1.3" — split the line).

## Dev Notes

### esbuild facts (web-verified 2026-08-08)
- `--format=cjs` is **mandatory** for Screeps: the runtime loads the main module through CommonJS `require` and calls `module.exports.loop` every Tick. A TS `export function loop(){}` in the entry is emitted by esbuild as a CJS export on `module.exports`. [Verified: esbuild docs; docs.screeps.com/modules.html]
- esbuild **does not typecheck** — TypeScript types are stripped as JS is generated. Type safety is enforced separately by `npm run typecheck` (`tsc --noEmit`, TS 7.0.2 strict). A green build ≠ a type-safe build.
- **Platform**: leave at the default (no `--platform` flag). The game bundle imports no Node built-ins (Screeps globals `Game`, `Memory`, `console` are ambient), so neither `--platform=node` nor `--platform=neutral` is required. This resolves Story 1.1's open item "esbuild platform choice verified at first build (Story 1.2)". If a Node built-in ever enters the game bundle, revisit — nothing in the Structural Seed does.
- **Target**: `--target=es2022` (matches `tsconfig.json` target).

### AD-9 boundary — do not over-build
`src/main.ts` is the control cycle seat (AD-9). Story 1.2 adds only the bootable seam: an exported `loop()` and a one-time boot marker. The generate → taken-set → validate → match → spawn cycle and the metering flag are **Story 1.4** (epics.md L190–206). Adding phase logic here is scope creep and will collide with Story 1.4.

### Constant home
`src/config.ts` is the typed-MVP-constants home ("values pinned at the first story that uses them" — Story 1.1 seed). The boot-marker message is Story 1.2's first value: define a typed constant there (e.g. `LOG_BOOT`) and import it in `main.ts`. Do **not** add the metering on/off flag — that belongs to Story 1.4.

### What must be preserved (files being modified)
- `package.json`: keep the pinned exact versions (`esbuild@0.28.1`, no `^`/`~`), keep **no** `"type": "module"` field (CJS bundle preserved), keep `engines >=22.13`. Only add the `build` script.
- `src/main.ts` / `src/config.ts`: currently one-line doc comments. Both are replaced by this story's additions — keep the doc comments' intent accurate.
- `.gitignore` already covers `dist/` and `screeps.json` — no change needed here (`screeps.json` + `screeps.sample.json` are Story 1.3).
- `biome.json` formatting must be respected (double quotes, semicolons, 2-space indent) so `npm run lint` stays green.

### Architecture compliance
- **AD-9** — main.ts is the control cycle ONLY; minimal boot seam here.
- **AD-1 / AD-2** — not exercised yet (no modules call `control/`); nothing new to wire.
- **NFR-4** — runtime fit: the bundle is plain ES2022 CommonJS that runs unmodified on the official World; the official simulation room is the iteration venue. Confirmed by AC3.
- **NFR-1** — CPU discipline from the first line: the boot marker is `O(1)` and fires once (module-scope guard), never per-Tick.
- **Structural Seed** — `dist/ # esbuild output: main.js`; entry is `src/main.ts`.

### Project Structure Notes
- Aligns with the Structural Seed exactly: `dist/main.js` from `src/main.ts`, `config.ts` as the constants home. No new folders introduced. No conflicts with the Story 1.1 tree.

## References

- [Source: epics.md#Story 1.2] — ACs verbatim (L160–174)
- [Source: ARCHITECTURE-SPINE.md#Stack] — esbuild 0.28.1 pinned, no runtime deps
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — `dist/ # esbuild output: main.js`; `main.ts` control-cycle seat
- [Source: ARCHITECTURE-SPINE.md#AD-9] — main.ts control cycle ONLY
- [Source: ARCHITECTURE-SPINE.md#Deferred] — TS7/@types confirmed at Story 1.1; platform choice verified at first build (this story)
- [Source: ARCHITECTURE-SPINE.md#Deployment & environments] — exactly two envs; sim = bundle pasted in
- [Source: prd.md#4.8 NFR-1/NFR-4] — CPU discipline; runtime fit on official World
- [Source: implementation-readiness-report-2026-08-07.md#Notes] — sim-observed ACs intentionally non-automated
- [Source: docs.screeps.com/modules.html] — main module exports `loop`; CommonJS `require`/`module.exports` (web-verified)
- [Source: esbuild.github.io/api] — `--format=cjs` CJS export behavior; esbuild is not a type-checker (web-verified)

## Dev Agent Record

### Agent Model Used

bm-dev (Cline) — internal model routing per .clinerules; dev-story on bm-dev profile

### Debug Log References

- `npm run typecheck` → exit 0 (TS 7.0.2 strict, `tsc --noEmit`)
- `npm run lint` → exit 0 (`biome check src test scripts`; one format fix applied via `biome check --write` — trailing blank line in smoke.test.ts)
- `npm run test` → exit 0 (2 tests passed, `test/smoke.test.ts`)
- `npm run build` → exit 0; esbuild produced `dist/main.js` (1.1 kb)
- `node -e 'require("./dist/main.js")'` → `loop` exported as function; boot marker logged once across two `loop()` calls (runtime smoke)
- `dist/main.js` inspected: single readable CJS file (`"use strict"`, target ES2022), unminified, no sourcemap, exports `loop` via `module.exports.loop = loop`

### Completion Notes List

- **AC1 (one-command bundle):** `npm run build` emits a single `dist/main.js` — CJS, `target=es2022`, unminified, no sourcemap, exporting `loop`. Verified via build output + `dist/main.js` inspection + node `require`.
- **AC2 (readable dev build):** `dist/main.js` is plain readable ES2022 JS (no `--minify`/`--sourcemap`); eyeball-verified.
- **AC3 (boots in sim):** locally supported by the runtime+unit smoke (boot marker logged once, no throws). Official simulation room: **operator-confirmed by Fliko (2026-08-08)** — `dist/main.js` pasted in, boot marker observed on the first Tick, no errors across 50 consecutive Ticks. Sim-observed, non-automated (AC3).
- `loop()` is minimal boot seam only (AD-9); no control-cycle phases added (deferred to Story 1.4).
- Boot marker `LOG_BOOT` is a typed constant in `src/config.ts`, imported by `main.ts`; module-scope `booted` guard fires it once per deploy (NFR-1).

### File List

- `package.json` (mod) — added `build` script; pinned exact versions untouched
- `src/main.ts` (mod) — exported `loop()` + one-time boot marker
- `src/config.ts` (mod) — added typed `LOG_BOOT` constant
- `test/smoke.test.ts` (mod) — boot smoke tests (exactly-once marker, no-throw)
- `README.md` (mod) — Scripts section split (build now, push in Story 1.3)
- `dist/main.js` (generated, gitignored)
- `_bmad-output/implementation-artifacts/1-2-bundle-sim-deploy.md` (mod) — record
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (mod) — 1-2 → in-progress

### Change Log

- 2026-08-08: Added esbuild `build` script; added minimal `loop()` boot seam + `LOG_BOOT` constant; extended boot smoke tests; split README scripts line (build in Story 1.2, push in Story 1.3). All tasks T1–T6 complete. AC3 sim observation operator-confirmed (dist/main.js pasted into official simulation room).
### Review Findings

> Code review run 2026-08-08 (model: bm-review). 0 decision-needed, 3 patch, 2 defer, 2 dismissed.

- [x] [Review][Patch] Reword the "fires once per deploy" comment in `main.ts` to match actual module-load semantics (state resets on shard/isolate restart or re-evaluation) [src/main.ts:4]
- [x] [Review][Patch] Assert the boot-marker content in the smoke tests, not just the log count (guards against wrong/empty string regressions) [test/smoke.test.ts:20]
- [x] [Review][Patch] Fix "boot-market" typo → "boot-marker" [src/config.ts:3]
- [x] [Review][Defer] `--bundle` emits only modules statically reachable from `src/main.ts`; a future non-entry or dynamically-imported module would not be emitted to `dist/`, breaking the deploy [package.json:13] — deferred, forward-compat (consistent with current AD-9 single-entry architecture)
- [x] [Review][Defer] `await import("../src/main")` smoke seam under `vi.resetModules()` is safe today but becomes fragile once Story 1.4 adds module-scope init / top-level side effects to `main.ts` [test/smoke.test.ts:17] — deferred, forward-compat
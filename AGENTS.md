<!-- bmad:context -->
<!-- Verified 2026-08-17 against d6da42e. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## screeps_ai

Screeps colony bot, TypeScript, Blackboard architecture (`world/` → `board/` → `control/` → `agents/`), hand-rolled with no starter template. Stage 2 (a Node-pool scheduler) is active work, replacing Stage 1's tier-first matching after the MVP retro rejected it (`epic-6-retro-2026-08-16.md`); `_bmad-output/specs/spec-screeps_ai/SPEC.md` is the binding design doc now — `ARCHITECTURE-SPINE.md` is Stage 1 background, superseded wherever SPEC.md amends it (Era/AD-5, matching cascade/AD-7).

## Policy

- Never run git-mutating commands (`commit`, `push`, `tag`, `merge`, `rebase`, `reset --hard`, `checkout --`, `branch -d`, `--no-verify`) — `.githooks/pre-commit` blocks agent commits mechanically; the human commits with `ALLOW_COMMIT=1`. Read-only git (`status`, `diff`, `log`, `rev-parse`, `show`) is fine; use `git rev-parse HEAD` for a commit reference.
- Never hardcode tunables — all MVP constants and the per-Job/per-Node policy table live in `src/config.ts` (FR-22).
- Cline model routing: `dev-story`/`dev-auto` runs on the `bm-dev` profile; `code-review` and any `bmad-tea`/`bmad-testarch-*` skill runs on `bm-review` — confirm `bm-review` is active before invoking those, and remind Fliko to switch after dev work completes. Record the model used in each story's Dev Agent Record ("Agent Model Used").

## Where things are

- Binding design: `_bmad-output/specs/spec-screeps_ai/SPEC.md`, with companions `conventions.md`, `node-pool-model.md`, `stack.md`, `deferred.md` alongside it.
- Stage 1 architecture (background/superseded): `_bmad-output/planning-artifacts/architecture/architecture-screeps_ai-2026-08-07/ARCHITECTURE-SPINE.md`.
- Known gaps and accepted deviations, logged per code review: `_bmad-output/implementation-artifacts/deferred-work.md`.
- Sprint/story tracking: `_bmad-output/implementation-artifacts/sprint-status.yaml`; Stage 2 story tracking: `_bmad-output/specs/spec-screeps_ai/stories.yaml`.
- Local dev server: `docker-compose.yaml` + `private_server_config.yml` (see README's Local Server section) — the actually-running setup, not the `screeps-launcher` binary some older planning docs still describe.

## Running and verifying

- `npm run server` needs `STEAM_KEY` set in `.env` (copy from `.env.example`) or `docker compose up` fails fast on a missing-key error.
- The local server's end-to-end flow (Steam auth through a first claimed room and a full generalist-to-graduated run) has not been exercised in this environment — treat it as unverified, not a working recipe, until confirmed live.

## Conventions that differ from defaults

- No behavior-level unit tests — Job/Contract behavior acceptance (FR-19, FR-20, FR-28, FR-30) is verified manually in the sim room / PTR, not vitest; this is a deliberate MVP-scope decision, still in effect.
- Any change to Matching/scoring logic needs at least one population-distribution test — N Jobs of type A + M Jobs of type B + population P, checking every type actually gets served — not only single-pair scoring tests. This is the exact gap (`test/control/match.test.ts` had only single-pair tests) that let the Stage 1 starvation bug ship and fail SM-1 (`epic-6-retro-2026-08-16.md` Finding 3).

<!-- /bmad:context -->

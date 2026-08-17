---
title: 'Local Private Server'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: '490d008f866d690e41806ea1ddff20f639b5d645'
context: ['{project-root}/_bmad-output/specs/spec-screeps_ai/SPEC.md', '{project-root}/_bmad-output/specs/spec-screeps_ai/stack.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Stage 1 has no way to run or iterate against a private Screeps server; every dev-loop iteration either pastes into the sim room or waits on the live shard's real-time tick, and Stage 2's Node/Pool scheduler needs a fast, unthrottled place to observe convergence before it can be tuned.

**Approach:** Add `screeps-launcher` (pinned 1.17.0, wrapping the `screeps` engine ~4.3.0) as a local dev server, with the recommended mod bundle — `screepsmod-auth`, `screepsmod-admin-utils`, `screepsmod-mongo` — a one-command bootstrap, and a fast reset, and make it the default per-story verification target ahead of PTR/live. Reuse the existing `push:private` Grunt profile — already wired to a local mod-API server at `127.0.0.1:21025` — as the deploy path unmodified.

## Boundaries & Constraints

**Always:**
- Zero new persistence or bot-code branching — `src/` and `config.ts` stay byte-identical across all three deploy targets (sim, local, shard).
- Pin `screeps-launcher` at exactly `1.17.0`, no `^`/`~` range, matching the rest of the pinned toolchain.
- Install the three recommended mods — `screepsmod-auth`, `screepsmod-admin-utils`, `screepsmod-mongo` — `admin-utils` is what exposes tick-rate control and (expected) room/admin commands.
- `admin-utils`'s tick rate is a lower bound, not a true zero-delay setting — user-reported instability when set too low. **Renegotiated 2026-08-17:** set to `200`ms, a deliberate accepted-risk departure below the `1000`ms `admin-utils`'s own docs call safe — human decision, not doc-derived; watch for instability and raise toward `1000` if it appears.
- Reuse the existing `push:private` Grunt profile as the local deploy path — do not add a second deploy mechanism.
- README documents the one-command bootstrap, the reset command, the mod bundle, and that local is now the default per-story verification target ahead of PTR/live.

**Ask First (resolved 2026-08-17):**
- Reset mechanism: `admin-utils` exposes no room-level reset, only whole-server `system.resetAllData()` (wipes everything, needs a restart). Implemented instead as a scripted wipe-and-reseed of `mongo`-backed room state via the base `screeps` engine's system-CLI HTTP endpoint (`scripts/server-reset.js`) — accepted as implemented, unverified against a live server; human will smoke-test before relying on it.
- Tick-rate value: `200`ms — human chose to go below `admin-utils`'s documented `1000`ms safe floor, accepting the risk.

**Never:**
- No Docker packaging.
- No automated/headless test harness against the local server.
- No changes to the live-shard (`push`) or PTR (`push:ptr`) Grunt profiles.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Happy-path bootstrap | operator runs the new server-start command, nothing running yet | local Screeps server starts, hosts a runnable room, reachable at the configured local host:port | N/A |
| Reset | operator runs the reset command against a running local server with an established room | room returns to fresh RCL1 (spawn only, no other structures/creeps), server process keeps running | N/A |
| Port already in use | another process holds the configured local port | bootstrap fails with a clear error naming the conflict | operator frees the port or reconfigures it |

</frozen-after-approval>

## Code Map

- `package.json` -- devDependencies + `scripts`; add pinned `screeps-launcher` devDependency and `server`/`server:reset` script pair alongside the existing `build`/`push*` scripts
- `Gruntfile.js` -- `private` env already sets `screeps.options.server` to `127.0.0.1:21025`, path `/api/user/code` (lines 38-45); reuse as-is unless the launcher's actual default port/path differs — verify before touching
- `screeps.json.example` -- `private` block (lines 13-21) already documents the local-server credential shape; extend only if the launcher needs an additional field
- `README.md` -- Deploy section (lines 43-53) already documents `push:private`; add bootstrap/reset commands and the local-first dev-loop convention
- `screeps-launcher/` (new dir, per `ARCHITECTURE_SPINE.md` Structural Seed) -- launcher config: mods list (`screepsmod-auth`, `screepsmod-admin-utils`, `screepsmod-mongo`), tick cadence via `admin-utils`, local save path

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add `server`/`server:reset` scripts; `screeps-launcher` pinned via a hardcoded download URL in `scripts/server-bootstrap.js` instead of a devDependency (it is not an npm package — Go binary via GitHub Releases) -- FR-1/FR-2
- [x] `screeps-launcher/` -- launcher config installs `screepsmod-auth`, `screepsmod-admin-utils`, `screepsmod-mongo`; tick cadence set to `200`ms (human-accepted departure below `admin-utils`'s documented `1000`ms floor, 2026-08-17) -- FR-4
- [x] reset mechanism resolved: `admin-utils` has no room-level reset, so `scripts/server-reset.js` scripts a wipe-and-reseed of `mongo`-backed room state via the base engine's system-CLI endpoint; **not yet verified against a live server** -- FR-2
- [x] `README.md` -- documents bootstrap, reset, mod bundle, local-first verification convention, and known risks -- FR-5
- [ ] verify `npm run push:private` deploys `dist/main.js` unmodified to the newly-running local server -- FR-3 -- **blocked**: no live server available in this environment (needs Steam API key + reachable MongoDB/Redis); config-level equivalence confirmed (`Gruntfile.js`/`screeps.json.example` byte-identical to baseline) but the live deploy itself is unverified
- [x] apply the three review layers' 16 patch-tier findings (timeout/atomicity/signal-handling in the bootstrap script, loopback guard/multi-room guard/`??`/`Number()`/try-catch/`.catch()` in the reset script, mod version pins, README onboarding/troubleshooting/hedging gaps) -- all re-verified via `npm run typecheck`/`lint`/`test`

**Acceptance Criteria:**
- Given no local server running, when the operator runs the bootstrap command, then a private Screeps server starts hosting a runnable room reachable on the configured local port, with no network/PTR/live-shard dependency.
- Given a running local server with an established room, when the operator runs the reset command, then the room returns to fresh RCL1 without the server process restarting.
- Given a built `dist/main.js`, when the operator runs `npm run push:private`, then the same artifact `push`/`push:ptr` would deploy lands on the local server, unmodified.
- Given the local server running, when ticks advance, then they run at the machine's natural speed, not gated by an artificial per-tick delay.

## Spec Change Log

- **2026-08-17, implementation pass.** Finding: `screeps-launcher` 404s on the npm registry — it's a per-platform Go binary distributed via GitHub Releases, not an installable package. Amended: the `1.17.0` pin moved from a `package.json` devDependency (as the Code Map originally assumed) to a hardcoded download URL in `scripts/server-bootstrap.js`; the frozen "pin exactly 1.17.0" boundary is still honored, just via a different mechanism. Avoids: a `package.json` entry that would silently fail to install. KEEP: `README.md`'s toolchain table documents this explicitly so it doesn't read as an oversight. Human confirmed accept-as-implemented, 2026-08-17.
- **2026-08-17, implementation pass.** Finding: neither Ask-First item (reset mechanism, tick-rate floor) could get a live human gate mid-run — the implementing subagent runs unattended. Amended: both resolved from `admin-utils`/`screeps` engine primary-source docs, then surfaced to the human afterward for real confirmation (not silently assumed). Reset → `scripts/server-reset.js` scripts a `mongo`-backed `storage.db` wipe-and-reseed via the base engine's system-CLI endpoint, since `admin-utils` only offers a whole-server wipe. Tick rate → human explicitly chose `200`ms, below the `1000`ms `admin-utils` docs call safe, accepting the risk (Boundaries "Always" bullet renegotiated accordingly). Avoids: shipping an unconfirmed guess as if it were doc-derived fact. KEEP: the reset script is still unverified against a live server — do not remove that caveat until it's actually been smoke-tested.
- **2026-08-17, implementation pass.** Finding: this sandbox has no Steam API key and no reachable MongoDB/Redis, so no live server could be booted here. Amended: Task 5 (`push:private` live-deploy verification) and all four Acceptance Criteria stay unverified-live; static/config-level equivalence was confirmed instead (`Gruntfile.js`/`screeps.json.example`/`src/` byte-identical to `baseline_commit`). Avoids: marking ACs satisfied on evidence that doesn't actually support them. Human accepted this as the recommended path (self-verify later) rather than providing credentials now, 2026-08-17.
- **2026-08-17, review pass (blind-hunter + edge-case-hunter + verification-gap, run in parallel against the implementation diff).** Findings: 16 patch-tier issues after triage (0 `intent_gap`, 0 `bad_spec`), covering download robustness (timeout, version-aware+corruption-safe caching, atomic temp-then-rename, signal-kill exit codes) in `server-bootstrap.js`; safety and correctness (non-loopback guard, multi-claimed-room guard, `??` over `||`, `Number(port)` coercion, `res.text()` try/catch, `main().catch()`) in `server-reset.js`; exact mod version pins via `pinnedPackages` (researched against `screeps-launcher`'s actual Yarn-`resolutions`-based install mechanism, since `mods:` entries themselves can't carry a version); and README onboarding/troubleshooting/hedging gaps (claiming a room, connecting a client, stopping the server, Node prerequisite, first-run troubleshooting, hedged headline claim, corrected `STEAM_KEY` mechanism — verified against `screeps-launcher`'s own source, no env-var fallback exists for the plain binary, only a `STEAM_KEY` file). Rejected as noise/already-covered: a multi-spawn `--force` flag, a Steam-key-leak caution (`screeps.json` already fully gitignored), a port-65535 overflow guard. Avoids: shipping known-fixable robustness/safety gaps and stale/uncited doc claims. KEEP: the `--allow-remote` guard and the multi-room hard-error are both live-tested (both branches) against this repo's real `screeps.json`, restored byte-for-byte afterward — don't loosen either without equal testing. New: `test/server-bootstrap.test.js`, `test/server-reset.test.js` (16 tests) covering the newly-exported pure-logic functions. Re-verified: `npm run typecheck`/`lint`/`test` all pass, 408/408 tests.
- **2026-08-17, post-review correction.** Finding: the review-fix pass reverted `tickRate` from `200` back to `1000` in both `config.yml.example` and `README.md`, reading the `200` value as unexplained/unauthorized tampering — it could not see the human's actual "go lower, accept the risk → 200ms" decision, made in a parallel part of this conversation outside that subagent's own transcript. Amended: restored `tickRate: 200` in both files with the renegotiated framing already on record in this spec's Boundaries section (`Renegotiated 2026-08-17`). Avoids: silently losing a human decision to a well-intentioned but context-blind revert. KEEP: the underlying instinct to flag an unexplained change rather than silently keep or silently discard it was correct — the fix here is closing the context gap, not discouraging the caution.
- **2026-08-17, live feedback (post-merge, operator's own machine).** Finding: `npm run server` failed on first real run — `isolated-vm` (a `screeps-launcher` dependency) needs to compile a native addon via `node-gyp`, and the machine had no `g++`, failing with `make: g++: No such file or directory`. This is the first piece of "Known risks / not yet verified live" that actually got exercised live, and it surfaced a real, previously-undocumented prerequisite. Amended: added a C++ build toolchain (`g++`, `make`, Python 3) to README's Prerequisites, with the exact error text and distro install commands (`dnf`/`apt`), plus a matching Troubleshooting bullet. Avoids: every future operator hitting the same unexplained native-compile failure with no pointer to the fix. KEEP: this is now confirmed-live, not doc-derived — don't downgrade its confidence level in a future edit.
- **2026-08-17, live feedback (round 2, same machine, after installing `g++`).** Finding: build got further, then failed inside `isolated-vm` 6.1.2 itself — `src/lib/timer.h` uses `uint32_t` without including `<cstdint>`, which GCC 15+ (confirmed: GCC 16.1.1) no longer pulls in transitively via `<functional>`. This is an upstream `isolated-vm` bug, not this repo's code, and it lives inside `screeps-launcher/node_modules/` (untracked — won't survive a fresh install). Amended: applied the one-line header fix live, verified a clean rebuild (`gyp info ok`, exit 0) on the affected machine; documented the exact `sed` one-liner in README's Troubleshooting and softened the "not been run" framing in Known Risks to reflect that the native-compile stage is now confirmed working past this point. Avoids: every future operator on a similarly-new-GCC distro (this is a live, current-generation compiler, not an edge case) hitting the identical unexplained compile error with no documented fix. KEEP: this is a workaround for an upstream bug outside this repo's control, not a permanent fix — re-apply after every fresh `screeps-launcher/` install until `isolated-vm` ships a fix upstream; don't try to "fix it properly" by vendoring `isolated-vm` into this repo, that's out of scope.

## Design Notes

The `push:private` Grunt profile (`Gruntfile.js`, `env=private`) predates this story and already targets a local mod-API server at `127.0.0.1:21025` — this is reused as-is, not rebuilt. If `screeps-launcher`'s default mod-API port/path differs from that default, a one-line `Gruntfile.js`/`screeps.json` value change is expected, not a rewrite of the deploy path.

`screepsmod-mongo` swaps the engine's storage backend from its default (sqlite) to MongoDB — this is new local infrastructure beyond what `stack.md` currently documents (a MongoDB instance must be reachable, whether installed natively or run in a container). Flag this to `bmad-spec` for a `stack.md` update once this story lands; out of scope for this dev spec to edit the canonical companion.

## Verification

**Commands:**
- `npm run typecheck` -- expected: passes unchanged (no `src/` changes in this story)
- `npm run lint` -- expected: passes on any new scripts/config
- new bootstrap script -- expected: local server reachable at the configured host:port within a reasonable startup window
- new reset script -- expected: room state confirmed fresh via the server's own API/console after running

**Manual checks (if no CLI):**
- Confirm `dist/main.js` on the local server matches the freshly-built artifact from the same build step `push`/`push:ptr` use.

## Suggested Review Order

**Bootstrap: download, cache, and process handling**

- Entry point — one-command bootstrap, config precondition, and the platform/version pin this whole story hinges on.
  [`server-bootstrap.js:16`](../../../../scripts/server-bootstrap.js#L16)

- Version-embedded, corruption-safe binary cache — a version bump or a truncated prior download can no longer serve a stale/broken binary silently.
  [`server-bootstrap.js:58`](../../../../scripts/server-bootstrap.js#L58)

- Download with a timeout and no available checksum — documents why integrity rests on the pinned URL alone.
  [`server-bootstrap.js:92`](../../../../scripts/server-bootstrap.js#L92)

- Atomic temp-file-then-rename — closes the two-concurrent-invocations race the edge-case review found.
  [`server-bootstrap.js:109`](../../../../scripts/server-bootstrap.js#L109)

- Signal-kill exit code — a Ctrl+C-terminated child no longer reports as a clean exit.
  [`server-bootstrap.js:150`](../../../../scripts/server-bootstrap.js#L150)

**Reset: the riskiest mechanism in this story**

- Non-loopback guard — the destructive wipe now refuses a non-local target without an explicit override.
  [`server-reset.js:80`](../../../../scripts/server-reset.js#L80)

- Multi-claimed-room hard error, replacing a silent `findOne` guess — the reset command itself, still unverified against a live server.
  [`server-reset.js:58`](../../../../scripts/server-reset.js#L58)

- `loadPrivateTarget` — `??` over `||` and `Number()` coercion close two ways an explicit override could misfire.
  [`server-reset.js:39`](../../../../scripts/server-reset.js#L39)

**Config & deploy-path reuse**

- Mod bundle with real version pins via `pinnedPackages`, and the intentional `~4.3.0` engine-range exception explained in place.
  [`config.yml.example:29`](../../../../screeps-launcher/config.yml.example#L29)

- New scripts wired alongside the pre-existing, unmodified `push:private` — confirms no second deploy mechanism was added.
  [`package.json:17`](../../../../package.json#L17)

**Peripherals**

- Local Server section — bootstrap, reset, client connection, first-room claim, and troubleshooting, all in one place.
  [`README.md:48`](../../../../README.md#L48)

- New tests for the two pure-logic functions extracted for testability.
  [`server-bootstrap.test.js:1`](../../../../test/server-bootstrap.test.js#L1)
  [`server-reset.test.js:1`](../../../../test/server-reset.test.js#L1)

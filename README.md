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
| screeps-launcher | 1.17.0 | local private server (`npm run server`) |

Stage 1 rows pinned exactly (no `^`/`~`) per Architecture Spine §Stack, verified 2026-08-07 against the npm registry. `screeps-launcher` (Stage 2) is likewise pinned exactly, verified 2026-08-16 against GitHub Releases — but the `screeps` engine it pulls in underneath is an intentional exception: `screeps-launcher/config.yml.example` pins it to `~4.3.0`, a range, because that is `stack.md`'s own architecture-level pin for the engine (not this repo's toolchain proper). `screeps-launcher` itself stays exact.

`screeps-launcher` is **not** an npm package — screepers/screeps-launcher ships as pinned, per-platform Go binaries via GitHub Releases, so unlike the rest of this table it is not a `package.json` devDependency. `npm run server` downloads and pins the exact release itself (see Local Server below).

### TypeScript version note

Typecheck runs **TypeScript 7.0.2** in `strict` mode against `@types/screeps` 3.4.0. The fallback is `typescript ~5.9.3` if TS7 ever rejects the typings (Story 1.1 — AC2). As of this commit the primary path is live: `npm run typecheck` passes on **TS 7.0.2** with no fallback.

### Movement note

Movement choke point (Story 3.5, AC6): `reusePath` defaults to 5 ticks (verified against `@types/screeps` 3.4.0); the engine stores path in `creep.memory._move` and clears it when the path expires or a new `moveTo` with different opts is called. `ignoreCreeps: true` makes creep tiles walkable during pathfinding; it affects cost calculation by allowing movement through occupied squares, used to break deadlock in dense traffic (verified against API docs). All creep movement must call `moveCreep` from `agents/movement.ts`; no direct `moveTo`/`move`/`moveByPath` calls elsewhere.

## Scripts

- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — `biome check src test scripts`
- `npm run test` — `vitest run`
- `npm run build` — esbuild `src/main.ts` → `dist/main.js` (CJS, ES2022, dev build — Story 1.2)
- The `push` script arrives with Story 1.3 (`scripts/push.ts`); `watch` is out of MVP scope.
- `npm run server` — bootstrap the local private Screeps server (Story 1 — CAP-7)
- `npm run server:reset` — reset the local server's room to fresh RCL1 without restarting it

## Structure

Matches `ARCHITECTURE-SPINE.md` §Structural Seed. `src/main.ts` is the control cycle only (AD-9). See `src/config.ts` for MVP constants.

## No-starter rationale

Hand-rolled from zero — no `screeps-typescript-starter` or boilerplate — so every file traces to an architecture decision (see `implementation-readiness-report-2026-08-07.md`).

## Local Server

**The local private server is the default per-story verification target, ahead of PTR/live** (Story 1 — CAP-7). Run it before pasting into the sim room or pushing to PTR/the live shard: ticks run unthrottled at the machine's natural speed instead of gating on the live shard's real-time cadence. In principle that should compress a full generalist-to-graduated run from hours/days live to minutes locally — **this has not actually been exercised end-to-end** (see Known risks below), so treat it as the design intent, not a demonstrated result yet.

### Prerequisites (one-time)

- **Node.js** — this repo's existing `>=22.13` floor (`package.json` `engines`, see Toolchain above) is sufficient; both new scripts below use the global `fetch` API (stable since Node 18), so no extra floor is needed beyond what's already pinned.
- **A C++ build toolchain** (`g++`, `make`, Python 3) — `screeps-launcher` pulls in `isolated-vm`, which compiles a native addon on first install via `node-gyp`. Confirmed missing `g++` fails the build with `make: g++: No such file or directory`, `node-gyp-build || node-gyp rebuild` exit code 1 (verified live, 2026-08-17). Install it first: `sudo dnf install gcc-c++ make` (Fedora/Nobara), `sudo apt install build-essential` (Debian/Ubuntu), or your distro's equivalent.
- A [Steam API key](https://steamcommunity.com/dev/apikey) (the private server engine authenticates through Steam even for purely local play).
- A local MongoDB instance and a local Redis instance, both reachable at `localhost` on their default ports — required by the `screepsmod-mongo` storage backend below. Install both natively; this repo does not package or run either in a container (no Docker packaging).
- Copy `screeps-launcher/config.yml.example` to `screeps-launcher/config.yml` (gitignored, same convention as `screeps.json`) and set `steamKey`, or drop your key in a `screeps-launcher/STEAM_KEY` file instead — verified against `screeps-launcher`'s own source (`launcher/config.go`), the binary checks for a file literally named `STEAM_KEY` in its working directory when `steamKeyFile` is unset. (There is no environment-variable fallback for the plain binary — that's a Docker-image-only convenience this repo doesn't use.)

### Bootstrap

```bash
npm run server
```

Downloads the pinned `screeps-launcher` v1.17.0 binary for your platform into `screeps-launcher/bin/` (once, gitignored — it's a standalone Go binary, not an npm package) and starts it in the foreground using `screeps-launcher/config.yml`. It installs the recommended mod bundle on first run — `screepsmod-auth`, `screepsmod-admin-utils`, `screepsmod-mongo`, pinned via `config.yml.example`'s `pinnedPackages` — and serves the game API at `127.0.0.1:21025`, the same host:port `push:private` already targets. If that port is already in use, the underlying server reports the conflict and exits; free the port or change it in both `screeps-launcher/config.yml` and `screeps.json`'s `private` block.

Ticks run at `tickRate: 200` ms. `admin-utils`'s own docs pair `1000` ms with "This is a lower bound. Users reported problems when set too low." — `200` is a deliberate, accepted-risk departure below that documented floor (operator decision, 2026-08-17), not a value its docs call safe. Watch for instability and raise it back toward `1000` if problems appear. Unrelated to this bot's own code, which is never throttled.

**Stopping the server:** `npm run server` runs `screeps-launcher` in the foreground with no daemon mode — `Ctrl+C` stops it (and the local game world along with it; state persists in Mongo/Redis for next start). There is no separate "stop" script.

### Connecting a client

Once `npm run server` is running, connect the official Screeps game client (Steam): open it, choose *Change Server* → the *Private Server* tab, and enter host `localhost`, port `21025`, password blank unless you've set one via `screepsmod-auth` (verified against `screeps-launcher`'s own README, which documents this exact flow).

### Claiming your first room

A fresh private-server world starts with no rooms and no account beyond what `screepsmod-auth` lets you register on first connect. **This flow has not been exercised in this environment** — the expected shape, based on standard Screeps client/engine behavior, is: register/log in through the client (`screepsmod-auth` also exposes a password-set page at `http://localhost:21025/authmod/password`), then use the client's normal new-player "world start" flow to pick and claim an open room. If the world map is empty (no rooms generated yet), the base `screeps` engine's CLI exposes room-generation commands (e.g. `map.generateRoom(...)`) via the same system CLI `npm run server:reset` talks to — needed once, before a first room can be selected. Treat this as a starting point to verify live, not a confirmed recipe.

### Reset

```bash
npm run server:reset
```

Returns the claimed room to fresh RCL1 (spawn only, no other structures or creeps) without restarting the server process. `admin-utils` exposes no room-level reset command — only a whole-server `system.resetAllData()`, which wipes every user/room and needs a restart — so this instead scripts a wipe-and-reseed of the mongo-backed room state directly through the private server's system CLI (a plain HTTP endpoint the base `screeps` engine adds at `<game port + 1>/cli`, i.e. `21026` by default). See `scripts/server-reset.js` for the exact command. It refuses to run against a non-loopback host (pass `--allow-remote` to override) and refuses to guess when more than one claimed room exists, erroring out instead of picking one arbitrarily. **This has not been exercised against a live running server** (see Known risks below) — smoke-test it against a disposable room before relying on it.

### Troubleshooting first-run failures

Beyond a port conflict (surfaced directly by the underlying server, per the spec's edge-case matrix):

- **Mongo/Redis unreachable** — `screepsmod-mongo` needs both reachable at the hosts in `config.yml`'s `env.shared` (`localhost` by default); expect the launcher to fail to start or the mongo mod to error out if either isn't running.
- **Steam auth failure** — an invalid, expired, or missing Steam key surfaces as an auth error from the launcher on startup; regenerate the key at https://steamcommunity.com/dev/apikey and re-check `steamKey`/the `STEAM_KEY` file.
- **Mod install failure** — `screeps-launcher` installs mods via Yarn on first run; a network failure, or a `pinnedPackages` version that no longer exists on the npm registry, surfaces as a Yarn/install error before the server ever starts listening.
- **`make: g++: No such file or directory`** — the C++ build toolchain prerequisite above is missing; `isolated-vm`'s native addon fails to compile (`node-gyp-build || node-gyp rebuild` exits 1). Install `g++`/`make` (see Prerequisites) and re-run `npm run server`.
- **`isolated-vm` build fails in `src/lib/timer.h` with `error: 'uint32_t' has not been declared`** (GCC 15+, e.g. Fedora/Nobara's default toolchain — confirmed on GCC 16.1.1) — upstream `isolated-vm` 6.1.2 (a `screeps-launcher`/`screeps`-engine transitive dependency, not something this repo's config pins directly) relies on `<cstdint>` arriving transitively via `<functional>`, which newer GCC no longer does. The compiler's own note names the fix. Patch it directly (this file lives in `screeps-launcher/node_modules/`, untracked, so this doesn't survive a fresh install — re-apply after any reinstall until upstream fixes it):
  ```bash
  sed -i '2i #include <cstdint>' screeps-launcher/node_modules/isolated-vm/src/lib/timer.h
  ```
  Then re-run `npm run server` (or `node-gyp rebuild` directly in that directory) — verified this produces a clean build (`gyp info ok`) on the machine that hit this, 2026-08-17.

### Known risks / not yet verified live

- Full end-to-end bootstrap (Steam auth, MongoDB/Redis connectivity, mod install, room hosting, first-room claim) has not been run against a live server in this environment. Two native-compile prerequisites above (missing `g++`, then `isolated-vm`'s `<cstdint>` gap on newer GCC) **were** hit live and fixed (2026-08-17, operator's own machine) — the toolchain now compiles clean past `isolated-vm`. Everything past that point (Steam auth, Mongo/Redis connectivity, mod install, room hosting) is still from `screeps-launcher`'s, `screepsmod-admin-utils`'s, and the base `screeps` engine's own published docs/source, not from a completed boot.
- `server:reset` assumes exactly one player-owned controller (it now errors out rather than guessing if there's more than one) and keeps every existing `spawn` object as-is.
- The "compresses to minutes" claim in the opening paragraph is the story's intended outcome, not a measured one yet.

## Deploy

Official shard push uses Grunt. Fill in `screeps.json` (gitignored; copy from `screeps.json.example`), then:

```bash
npm run push         # official world (env=main)
npm run push:ptr     # PTR
npm run push:private # local/private server (run `npm run server` first)
```

Override branch: `npm run push -- --branch=experiment`. Simulation room still works by pasting `dist/main.js` from `npm run build`. Private server support is pre-wired in `screeps.json` example — `push:private` deploys the exact `dist/main.js` build artifact `push`/`push:ptr` would, unmodified.

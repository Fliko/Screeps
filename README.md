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

**The local private server is the default per-story verification target, ahead of PTR/live** (Story 1 — CAP-7). Run it before pasting into the sim room or pushing to PTR/the live shard: ticks run unthrottled at the machine's natural speed instead of gating on the live shard's real-time cadence.

The server is [`jomik/screeps-server`](https://github.com/Jomik/screeps-server) via Docker Compose — **not** `screeps-launcher`, the tool originally planned (Story 1's spec, `stack.md`, and `ARCHITECTURE_SPINE.md` AD-14 still describe `screeps-launcher`; that plan was abandoned after it hit a chain of live blockers — missing `g++`, an `isolated-vm`/GCC-15 incompatibility, a Docker-mount issue, then stale dependency pins — see `deferred-work.md`, 2026-08-17). Reconciling those docs to the Compose-based approach is open follow-up work, not yet done.

### Prerequisites (one-time)

- Docker and Docker Compose.
- A [Steam API key](https://steamcommunity.com/dev/apikey) (the private server engine authenticates through Steam even for purely local play).
- Copy `.env.example` to `.env` and set `STEAM_KEY` — `docker-compose.yaml` reads it from there (`environment: STEAM_KEY: ${STEAM_KEY:?"Missing steam key"}`) and fails fast if it's unset.

Mongo and Redis run as Compose services (`docker-compose.yaml`) — nothing to install natively.

### Bootstrap

```bash
npm run server
```

Runs `docker compose up`, which builds/starts the `screeps`, `mongo`, and `redis` services and serves the game API at `127.0.0.1:21025` — the same host:port `push:private` targets (`screeps.json`'s `private` block). Config lives in `private_server_config.yml` (mounted into the container as `config.yml`): mod bundle `screepsmod-auth`, `screepsmod-admin-utils`, `screepsmod-mongo`, `screepsmod-konami` (relaxes engine requirements for local play), `tickRate`/`socketUpdateRate` both `1000`ms. Data persists in named Docker volumes across restarts.

**Stopping the server:** `Ctrl+C` (or `docker compose down` from another shell) stops the services; volumes persist state for next start.

### Connecting a client

Connect the official Screeps game client (Steam): open it, choose *Change Server* → the *Private Server* tab, and enter host `localhost`, port `21025`.

### Known risks / not yet verified live

Full end-to-end bootstrap (Steam auth, mod install, room hosting, first-room claim, an actual generalist-to-graduated colony run) has not been exercised end-to-end in this environment yet — treat "ticks run unthrottled" as the demonstrated part, and everything past first connection as unverified. There is no `server:reset` script currently in this repo.

## Deploy

Official shard push uses Grunt. Fill in `screeps.json` (gitignored; copy from `screeps.json.example`), then:

```bash
npm run push         # official world (env=main)
npm run push:ptr     # PTR
npm run push:private # local/private server (run `npm run server` first)
```

Override branch: `npm run push -- --branch=experiment`. Simulation room still works by pasting `dist/main.js` from `npm run build`. Private server support is pre-wired in `screeps.json` example — `push:private` deploys the exact `dist/main.js` build artifact `push`/`push:ptr` would, unmodified.

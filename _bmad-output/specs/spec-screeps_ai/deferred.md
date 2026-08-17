# Deferred — screeps_ai

Design options considered and explicitly not built now, with the reasoning, so they aren't rediscovered from scratch. Source: `ARCHITECTURE_SPINE.md` Deferred, `prd-screeps_ai-2026-08-16/addendum.md`.

- **Real-path distances, owned routing (`moveByPath`), and route caches** — Phase 2 scale (multi-room). RawMemory segments are the sanctioned medium when it arrives (not Memory keys).
- **moveTo engine internals** (reusePath default, `_move` cache behavior, ignoreCreeps semantics) — verify against the API docs at the movement-helper story; explicit opts are pinned, not engine defaults.
- **Behavior-level unit tests** — rejected for MVP; "revisit if a private server is adopted" was the Stage 1 note, and Stage 2 just adopted one. Ripe for revisit now.
- **Traffic management beyond per-Creep stuck escalation** — Phase 2+.
- **Validation/Board throttling (backoff)** — a configurable-strategy lever, now naturally expressible as a Node/balancer concern rather than needing its own mechanism.
- **Bodies-as-data per energy-capacity band** — Phase 2.
- **Persistent cost matrices** — multi-room only.
- **`@types/screeps` 3.4.0 under TypeScript 7** — confirm at first build; fallback pin `typescript ~5.9.3`.
- **Discrete stage/phase concept** — dropped from the mechanism entirely. The decorative "current phase" label idea is rejected outright, not merely deferred: with no discrete phase in the design, such a label would be meaningless. Resolved instead by [SPEC.md](SPEC.md) CAP-10 — logging each Node's fully-resolved config values per Tick, which needs no phase concept.
- **Multi-room profiles** (e.g. a `WarRoom`-style alternate config) — the config shape is keyed by room profile to leave room for this; Stage 2 itself ships exactly one default profile.
- **Runtime-mutable config** (hot-reload without a rebuild/push) — out of scope for Stage 2; still arrives, if ever, via a read-semantics decision (load-time vs per-Tick reads).
- **Automated/headless test harness against the local server** — out of scope for Stage 2 (manual fast-iteration use only); the local server is the natural target for this later.
- **Docker packaging for the local server** — not needed; not pursued unless native-module setup proves painful in practice.

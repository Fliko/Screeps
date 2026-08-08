---
type: review
lens: version-and-reality verification
target: ARCHITECTURE-SPINE.md
audit-trail: .memlog.md (version entries)
reviewed: 2026-08-08
method: npm registry spot-checks (live), docs.screeps.com + screeps/docs + screeps/engine source (live), nodejs/Release schedule (live), workspace filesystem check
---

# Version & Reality Verification — screeps_ai spine

## Verdict

**PASS with flags.** Every pinned toolchain version in the Stack table matches the live npm
registry `latest` exactly, and the spine's claim "All versions verified against the npm registry
on 2026-08-07" is corroborated by memlog entries and re-confirmed at review time. The Screeps API
surface is mostly verified against live docs. One pocket of committed decision-making — moveTo
internals (`reusePath` default, `creep.memory._move`) and the `ignoreCreeps` opt — still rests on
training-data knowledge; the memlog discloses this and flags it for implementation-time
verification, but the disclosure never propagated into the spine itself (AD-8, conventions,
Deferred). Greenfield starter hygiene is clean: no starter's live defaults are leaned on.

## Per-item verification table

| # | Spine item | Claim | Check performed | Result |
| --- | --- | --- | --- | --- |
| 1 | typescript | 7.0.2 | registry `latest` → 7.0.2 (engines ≥16.20; native per-platform builds) | ✅ VERIFIED — exact match, still latest |
| 2 | esbuild | 0.28.1 | registry `latest` → 0.28.1 (engines ≥18, fits Node 22) | ✅ VERIFIED |
| 3 | @types/screeps | 3.4.0 | registry `latest` → 3.4.0; `typeScriptVersion: 5.3`, no peer deps | ✅ VERIFIED (exists/fits). ⚠ TS7-compat formally UNVERIFIED — but spine Defers it with fallback `typescript ~5.9.3`; fallback confirmed to exist on registry. Well managed. |
| 4 | vitest | 4.1.10 | registry `latest` → 4.1.10; engines `^20 \|\| ^22 \|\| >=24` — Node 22 fits | ✅ VERIFIED |
| 5 | @biomejs/biome | 2.5.7 | registry `latest` → 2.5.7 (engines ≥14.21.3) | ✅ VERIFIED |
| 6 | screeps-api | 2.1.0 | registry `latest` → 2.1.0; engines `22.x \|\| 24.x` | ✅ VERIFIED — engines force Node 22 or 24, consistent with the spine's Node pin |
| 7 | Node.js | 22 LTS (≥22.13) | nodejs/Release schedule: v22 "Jod" maintenance LTS since 2025-10-21, EOL 2027-04-30; v24 "Krypton" active LTS since 2025-10-28 | ✅ VALID — supported, satisfies every tool's engines. ⚠ Freshness nit: 24 is now the *active* LTS; the `≥22.13` floor derived from eslint's engine range, and eslint was dropped (memlog 31→32) — stale rationale, harmless. See F-3. |
| 8 | RoomPosition.getRangeTo | exists; "(Chebyshev)" | live docs: `getRangeTo` present — "Get linear range… A number of squares" | ✅ VERIFIED (exists, fits use as distance heuristic). ℹ Docs prose says "linear range"; Chebyshev characterization is engine knowledge, not the doc page. See F-4. |
| 9 | Creep.moveTo opts: reusePath | default 5; config constant | memlog 25: "from stable API knowledge — flagged for implementation-time verification"; doc section unreachable at review (single-page docs truncate) | ❌ UNVERIFIED (disclosed in memlog, not in spine). Committed in spine as `config.ts` MVP constant. See F-1. |
| 10 | Creep.moveTo opts: ignoreCreeps | stuck-escalation re-path (AD-8) | not in memlog's verified API list; opts table unreachable at review | ❌ UNVERIFIED in trail; near-certain stable API. See F-2. |
| 11 | creep.memory._move | engine-owned path cache key in memory schema | same status as #9 | ❌ UNVERIFIED (disclosed in memlog); baked into spine's `creep.memory` schema convention. See F-1. |
| 12 | Game.cpu.getUsed | per-phase CPU metering | live docs TOC lists `Game.cpu.getUsed` | ✅ VERIFIED (exists); return semantics standard |
| 13 | fatigue mechanics | stuck := unmoved N ticks AND `fatigue == 0` | live docs: `Creep.fatigue` property; MOVE part "decreases fatigue by 2 points per tick" | ✅ VERIFIED (core mechanic); precise blocking predicate (`fatigue > 0` blocks move) is stable mechanics knowledge, partially confirmed. Low residual risk. |
| 14 | RawMemory segments | 100 KB strings, up to 10 MB; future route-cache medium | live docs: "maximum size per segment is 100 KB"; "up to 10 MB of additional memory" | ✅ VERIFIED — exact match. Deferred-only usage anyway. |
| 15 | CPU/bucket model (NFR basis) | 20 ms baseline, bucket 10,000, burst 500/tick | memlog 15 verified vs docs 2026-08-07; live docs TOC consistent | ✅ VERIFIED (trail) |

## Findings

### F-1 — Medium: moveTo internals (`reusePath` default 5, `creep.memory._move`) are committed but unverified
The spine commits these in two places: `reusePath` as an MVP constant in `src/config.ts`
(Config convention) and `_move(engine)` inside the `creep.memory` schema (Data & formats
convention, AD-8). The only evidence is training-data knowledge. Credit: memlog 25 explicitly
discloses this ("from stable API knowledge — flagged for implementation-time verification").
Gap: the flag never reached the spine — the Deferred list carries the `@types/screeps`×TS7 caveat
but not this one, so a reader of the spine alone sees these as settled facts. I attempted to
close it at review time; the official docs are a single page whose middle section (moveTo opts)
was unreachable by fetch. **Recommendation:** add the implementation-time verification flag to
the spine's Deferred section; until then, treat `reusePath`'s default value and `_move`'s schema
position as provisional. Probability of being wrong: low. Blast radius if wrong: memory-schema
collision with engine keys and a wrong default constant — caught at first sim run, so contained.

### F-2 — Low: `ignoreCreeps` opt not in the verification trail
AD-8's stuck escalation (one re-path with `ignoreCreeps: true`) depends on this MoveToOpts key.
Memlog 25's verified list covers PathFinder/CostMatrix, findPath, getRangeTo,
findClosestByPath, RawMemory — but not the moveTo opts table. Stable, long-documented API;
almost certainly fine. Verify in the same implementation-time pass as F-1.

### F-3 — Low: Node pin rationale is stale; active LTS has moved on
"Node 22 LTS (≥22.13)" is valid — v22 is maintenance LTS until 2027-04-30 and satisfies all
engines (screeps-api `22.x || 24.x`; vitest `^20 || ^22 || >=24`; esbuild ≥18; biome ≥14.21.3;
TS7 ≥16.20). Two nits: (a) the `≥22.13` floor came from eslint's engine range (memlog 31) and
eslint was dropped from the stack (memlog 32) — nothing remaining requires 22.13 specifically;
(b) Node 24 is the active LTS and equally permitted by screeps-api, so "22 LTS" is a
conservative choice, not the current default. Also note screeps-api 2.1.0's engines exclude
Node 26 (LTS from 2026-10-28) — pin this when upgrading. No action required for MVP.

### F-4 — Info: `getRangeTo` "(Chebyshev)" characterization is engine knowledge, not doc prose
Live docs describe it as "linear range… a number of squares"; Chebyshev (max of |Δx|,|Δy|) is
the engine implementation, well-known but not what the doc page says. The architectural use
(monotone distance heuristic for scoring) is unaffected either way. Cosmetic.

### F-5 — Info (positive): greenfield starter hygiene is exemplary
No starter's live defaults are inherited: screeps-typescript-starter is reference-only, and the
one starter-ecosystem dependency considered (rollup-plugin-screeps 1.0.1) was registry-checked
and rejected as stale (2020, screeps-api v1). Workspace contains no manifests — nothing
contradicts the pinned stack.

### F-6 — Info (positive): pinned versions are exactly current
All six npm pins match `latest` at review time, the TS 5.9.3 fallback exists, and
@types/screeps carries no peer constraint that would hard-block TS7 (its `typeScriptVersion: 5.3`
is a floor). The one genuine unknown (types under the native TS7 compiler) is explicitly
Deferred with a working fallback — the correct pattern, and the model F-1 should follow.

## Audit-trail assessment

The memlog's verification trail is strong and honest: `(version)` entries name source and date
(npm registry 2026-08-07 ×2, docs.screeps.com ×2), rejections are evidence-based
(rollup-plugin-screeps), and the single unverified pocket is self-disclosed rather than
asserted. The trail's only weakness is propagation: disclosed caveats that touch committed
spine text (F-1/F-2) should be copied into the spine's Deferred list so the spine stands alone.

| 16 | Game.getObjectById | Board-free validation (AD-4) | live docs TOC lists it | ✅ VERIFIED (exists) |
| 17 | Greenfield starter defaults | none leaned on | memlog 17: screeps-typescript-starter = reference only; memlog 21: rollup-plugin-screeps 1.0.1 rejected as stale (registry-checked) | ✅ CLEAN — no starter defaults inherited; the one starter-adjacent dependency was reality-checked and rejected |
| 18 | Existing-project contradiction | — | filesystem: no package.json / tsconfig.json / screeps.json anywhere under `screeps/` | ✅ CLEAN — true greenfield, nothing to contradict the stack |

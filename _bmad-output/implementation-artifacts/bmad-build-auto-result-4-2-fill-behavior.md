---
status: blocked
---

# Story 4.2: Fill Behavior

## Auto Run Result

Status: blocked
Blocking condition: intent gap

### Inferred intent

No explicit invocation text was given. Intent was inferred from `sprint-status.yaml`: Story 4.1
is `done` (committed), Epic 4 is `in-progress`, and `4-2-fill-behavior` is the next `backlog`
story. This inference is not the blocker — the blocker surfaced during step-02 codebase
investigation of Story 4.2's actual implementation requirements.

### Evidence gathered

- Story 4.2's AC (epics.md:412-425) requires: "Given a Generalist with a fill Contract and empty
  carry, When Ticks run, Then it **harvests**, travels, and transfers to the Contract's structure
  until full."
- To harvest, a Creep needs a Source object reference. **No code path in this repository can
  currently produce one.**
- `src/game.ts`'s `GameAdapter` interface has methods for structures, construction sites, creeps,
  controller, and terrain — **no `findSources` or equivalent**.
- `src/world/snapshot.ts`'s `WorldSnapshot` has `structures`, `constructionSites`, `creeps`,
  `controller` — **no `sources` field**.
- `grep -rln "SOURCE\|findSources\|Source\b" src/` matches only prose comments in
  `agents/validators.ts` and `agents/sourcing.ts` — zero functional Source-discovery code
  anywhere.
- Neither `epics.md` nor `ARCHITECTURE-SPINE.md` specifies a Source-selection algorithm (nearest?
  first-found? lowest-energy? highest-energy?) for the Generalist/Epic-4 era. The only
  Source-binding rule in the whole planning corpus is FR-28 ("Harvester source-lock... travels to
  the Source once... for its entire life"), which is explicitly an Epic 6 / Specialist-era
  concept (`world/producers/*` and `config.ts` both confirm the `mine` Producer and Harvester
  Body don't exist yet — Epic 6 scope) — not something a Generalist should do.
- AD-10 (Game reads only inside `world/`) means Source discovery cannot simply live inline in the
  new behavior file — it requires a new `world/` seam (adapter method + snapshot field), the same
  shape as every existing Producer's data source.

### Unanswered question

Where does Source discovery live, and what selection policy does a Generalist use to pick which
Source to harvest from when a room has more than one (the common case even in the sim room)?

**Reading 1 (nearest Source, minimal new `world/` seam):** Add `findSources(roomName):
SourceStub[]` to `GameAdapter`, add `sources: readonly SnapshotSource[]` to `WorldSnapshot`
(mirroring the existing `structures`/`constructionSites` pattern exactly), and have the fill
behavior select the nearest Source via the already-existing `world/distance.ts#liveDistance`
service. This is the most conventional reading — it reuses every established pattern in this
codebase (AD-10 seam, distance service) and requires no new architectural primitive, only new
data of a shape this codebase already has three examples of.

**Reading 2 (first/arbitrary Source, no distance computation):** Skip nearest-Source selection
entirely; take whichever Source appears first in a `sources` list. Simpler to implement, but
likely to produce visibly wrong/wasteful behavior in the sim-room observation this story's AC
requires ("observed in the sim room") whenever more than one Source is in range, and there's
nothing in the intent ruling this out or in.

**Reading 3 (Generalist-era Source-locking, mirroring FR-28 early):** Give each Generalist a
sticky "my Source" assignment, similar to the Specialist Harvester's source-lock. Rejected as a
likely-wrong reading on its own evidence — FR-28's source-lock is explicitly scoped to Epic 6
Harvesters with a Reserved mine Job; applying it to Epic 4 Generalists would blur a boundary this
project's story history has otherwise been very disciplined about (see the many "Do NOT
implement X — Epic Y" notes throughout prior Epic 3 specs), and no requirement text supports it
for Generalists.

These readings produce materially different deliverables: Reading 1 requires a new `GameAdapter`
method, a new `WorldSnapshot` field, and reuse of the distance service (touching `game.ts`,
`world/snapshot.ts`, plus the new behavior file); Reading 2 requires only the new field, no
distance logic; Reading 3 requires new `creep.memory` state that would need its own `state/`
accessor and — per Story 3.1's established per-field ownership convention — its own AD-2 write-
ownership decision. Nothing in epics.md, the architecture spine, or Epic 4's context file
resolves which is intended, and the live Screeps API's exact `find(FIND_SOURCES)` return shape
(active vs. all Sources, energy-regen fields) has also never been verified in this codebase the
way `moveTo` internals were explicitly verified and recorded for Story 3.5 — a second, smaller gap
riding on top of the primary one.

### Verification performed

None — no implementation was attempted. This is a pre-implementation HALT during step-02 codebase
investigation.

### Residual risks

None from this run (no code changed). The risk of resolving this incorrectly without human input:
either building a Source-discovery seam whose selection policy conflicts with a future story's
actual requirement (expensive to unwind once fill/build/upgrade behaviors all depend on it), or
under-scoping Story 4.2 by punting Source selection to something that produces visibly broken
sim-room behavior, defeating the AC's own observability requirement.

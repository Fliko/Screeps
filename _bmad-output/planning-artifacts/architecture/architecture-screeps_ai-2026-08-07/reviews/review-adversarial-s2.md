# Adversarial Lens — Stage 2 amendment

Run inline (solo/tight stakes, parent held full coaching context — no subagent dispatch). Test: construct two units one level down that each obey every AD to the letter yet still build incompatibly.

## Findings (all fixed during Finalize — none deferred)

1. **AD-11 as originally drafted let Node names drift.** A Producer builder and a config-table builder could each invent `node` strings independently (`"extensions"` vs `"Extensions"` vs `"extension-fill"`) with nothing catching the mismatch until runtime. *Fix applied:* `NodeName` is now a single shared typed union, defined once in `board/job.ts`, imported by both sides.
2. **Undefined behavior for a Job whose `node` has no config entry.** Neither AD-11 nor AD-12 said what happens — a plausible `undefined.NumWorkers()` throw. *Fix applied:* AD-11 now states such a Job is never eligible (treated as `NumWorkers()` = 0), consistent with the existing no-exceptions-across-the-control-cycle convention.
3. **AD-7 left Reserved-mode's relationship to `NumWorkers()` ambiguous.** One builder could keep the mines Node's "one Harvester per vacant Source" as a separate hard-coded rule that ignores `NumWorkers()` entirely; another could make it the sole authority. The user's own design (`mines: { NumWorkers: fn(), ... }`) implies it should govern both modes. *Fix applied:* AD-7 now states `NumWorkers()` is a hard cap on total headcount whether Reserved or Pulled.
4. **`Priority` evaluation frequency was unpinned.** Once-per-Node-per-Tick vs once-per-Job changes both CPU cost and whether two Jobs under the same Node could carry different Priority values within one Tick. *Fix applied:* AD-7 now pins once-per-Node-per-Tick.
5. **`config.ts`'s world-state-summary argument type had no single owner.** Two builders could independently shape it differently. *Fix applied:* AD-12 now states the type is defined once in `world/`, exported, never redeclared.

## Not found / checked clean

- AD-4's amended grammar (`type:node:targetId`) — parse ambiguity checked: `type` and `node` are both from closed string-unions (no colons possible inside either), `targetId` is a Screeps object id (also colon-free) — three-way split on `:` is unambiguous.
- AD-13 taints — checked whether a body-kind with an empty/missing `tolerations` list is ambiguous (excluded-from-everything vs tolerates-everything default). Not found ambiguous: AD-13's Rule already states eligibility requires the Node's taint be *in* the list, so an empty list is unambiguously "tolerates nothing" — no divergence risk.

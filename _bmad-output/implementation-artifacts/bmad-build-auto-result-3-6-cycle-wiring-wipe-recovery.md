---
status: blocked
---

# Story 3.6: Cycle Wiring & Wipe Recovery

## Auto Run Result

Status: blocked
Blocking condition: intent gap

### Inferred intent

This run had no explicit invocation text (`/bmad-build-auto` with no arguments). Intent was
inferred from session context: the previous conversation closed out Story 3.5's hardening lineage,
the user marked `3-5-movement-choke-point-stuck-escalation` `done` in `sprint-status.yaml`, and
Epic 3's next backlog story is `3-6-cycle-wiring-wipe-recovery`. This inference itself is not the
blocker — the blocker surfaced during step-02 investigation of Story 3.6's actual scope.

### Evidence gathered

- `src/main.ts` already wires `validate` and `match` into the five-phase AD-9 control cycle
  (`generate → deriveTakenSet → validate → match → spawn`) — this appears **already complete**.
- `test/control-cycle.test.ts` already has passing tests for: phase order (5 phases logged in
  order), taken-set wiring (derived once, passed to validate then match), Contract release before
  match reads capacity, and an end-to-end match-wiring test that writes a real `memory.contract`
  onto a live Creep stub. Story 3.6's "Epic 1 phase-order test still passes with the real
  validate/match phases" acceptance criterion already holds.
- `grep -rn "moveCreep" src/` → only the function definition in `src/agents/movement.ts`; **zero
  callers**.
- Story 3.6's AC1 (epics.md:384-390) requires: "the Creep pulls the highest-tier appropriate Job
  and **walks to its target** — observed via the `[matching]` log." Nothing in the current
  codebase can produce that observable outcome — no code path invokes `moveCreep`.
- Epic 3's own goal statement (epics.md:126, 284) states "claimed Creeps **visibly walk to their
  work**" as an epic-closing outcome.
- Story 3.5's own spec explicitly scoped `moveCreep` as "helper and unit tests only — no behavior
  (Epic 4) or wiring to `main.ts` yet," and every prior Epic 3 story spec in this repository
  contains explicit "Do NOT implement behavior — Epic 4" language, indicating unusual discipline
  about the Epic 3/4 boundary in this project's story history.

### Unanswered question

Does Story 3.6 require new code that makes a Creep actually invoke `moveCreep` toward its
Contract's target (a minimal "walk toward target" step, distinct from Epic 4's full source/serve
behavior execution), or is the story's remaining scope limited to: a wipe-recovery regression
test proving a Creep re-acquires a valid Contract after `Memory` is cleared, plus manual sim-room
observation as a human-gated acceptance step (with the "walks to its target" AC understood as
describing the *epic's* eventual end-state once Epic 4 lands, not new work this story owes)?

**Reading 1 (narrow — wiring already done, add wipe-recovery test only):** Zero `src/` production
code changes; one new regression test in `test/control-cycle.test.ts` proving Memory-wipe
recovery; sim-room walk-observation deferred as a human/manual step outside this story's coded
scope.

**Reading 2 (broad — minimal movement invocation):** Adds a small, deliberately non-Job-specific
call to `moveCreep` somewhere in the control cycle or a thin interim behavior, sufficient to make
a Creep visibly walk toward its claimed Job's position — without building Epic 4's actual
source-iff-empty execution or per-Job-type behaviors.

These are not equivalent: Reading 2 introduces new production code and a new architectural
decision (where does a "walk-only" call live, given `agents/behaviors/*` doesn't exist yet and AD-9
doesn't currently have a phase for it) that Reading 1 does not. Nothing in epics.md, the
architecture spine, or Epic 3's context file selects between them.

### Verification performed

None — no implementation was attempted. This is a pre-implementation HALT during step-02 codebase
investigation.

### Residual risks

None from this run (no code changed). The risk of *not* resolving this before implementing: either
under-delivering Story 3.6's stated AC1 (Reading 1, if the "walks to its target" language was
meant literally as new work) or scope-creeping into Epic 4's territory and violating this
project's established Epic 3/4 discipline (Reading 2, if wrong).

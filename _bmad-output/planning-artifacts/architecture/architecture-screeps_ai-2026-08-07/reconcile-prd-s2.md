# Reconciliation — prd-screeps_ai-2026-08-16 (Stage 2 PRD) vs. amended ARCHITECTURE-SPINE.md

Performed inline (solo/tight stakes, parent held full coaching context). Checks every S2 FR/NFR/Non-Goal landed somewhere in the spine, and flags where the architecture's resolved shape uses different words than the PRD's capability-level language.

## Full coverage

FR-1..5 -> AD-14. FR-8 -> AD-7 (amended). FR-10 -> folded into `NumWorkers()`, Config convention row + Deferred. FR-12 -> AD-5 (amended). FR-13 -> AD-12. NFR-1 -> AD-14. NFR-2 -> AD-7 (kept clause) + AD-12. NFR-3 -> cross-cutting capability-map row. NFR-4 -> Deferred (cross-referenced to `bmad-create-epics-and-stories`, correctly not architected as an AD — it's a story-time test-content decision). All 5 Non-Goals -> Deferred section, each with an explicit line.

## Terminology drift found (not gaps — the PRD's capability claim still holds, but its words no longer match the resolved mechanism)

1. **FR-6/FR-7 ("graduated stage ladder," "stage gate," "highest-satisfied gate wins")** — the coaching session dropped the discrete-stage-ladder mechanism entirely in favor of continuous per-Node `NumWorkers()`/`Priority()` functions (AD-5 amendment, `.memlog.md` StageGate-dropped decision). The *capability* FR-6/7 promise (graduated, config-defined, no code change to add a step) still holds — it's delivered by parameterizing the functions over more world-state variables, not by adding a gate to a list — but the PRD's literal "stage"/"gate" nouns no longer name anything in the architecture.
2. **FR-9 ("round-robin," "greedy/nearest-distance")** — resolved instead to `balancer: LEAST_FULL | STICKY` (AD-7). `LEAST_FULL` is the load-balance-by-live-occupancy strategy the "round-robin" capability actually needed (confirmed round-robin's own state-tracking was the LEAST_FULL-thrash discussion); `STICKY` is closer to "permanently locked to first assignment" than to "greedy/nearest" as literally worded.
3. **FR-11 ("stage- and population-scoped pool activation")** — the "stage-scoped" half is stale (no discrete stage exists); "population-scoped" survives as one of several world-state-summary inputs a Node's functions can read (AD-12).

## Recommendation

Offer to sync `prd-screeps_ai-2026-08-16/prd.md` FR-6, FR-7, FR-9, FR-11 wording to the resolved architecture vocabulary (Node, `NumWorkers()`/`Priority()`, `balancer: LEAST_FULL | STICKY`) so the two documents don't silently diverge for the next reader. Not applied automatically — the PRD is `status: final`; this is the user's call per the architecture skill's own update-sync offer.

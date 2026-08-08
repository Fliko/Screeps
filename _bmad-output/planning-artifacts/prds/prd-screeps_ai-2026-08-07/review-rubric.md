# PRD Quality Review — screeps_ai

## Overall verdict

This is a decision-ready, chain-top-quality PRD: all 30 FRs carry genuinely testable consequences, every deferral names what was given up and where it lands, and the capability-level/addendum split is disciplined. The risks are concentrated rather than structural — a cluster of unspecified MVP constants (population target, Collector minimums, TTL thresholds/floors) that story creation will otherwise have to invent, one flat contradiction inside the "no synonyms" Glossary, and a broken reference to the PRD's single named input. All are fixable in one sitting; none require rethinking the product.

## Decision-readiness — strong

Decisions are stated as decisions, with the surrendered alternative named: §4.3 adopts lexicographic matching over the thread's weighted formula ("MVP's lexicographic rule is a deliberate simplification, not an oversight"); §4.2 excludes preemption "by decision" and names the compensating mechanisms ("capacity reservation (§4.4) and idle-first dispatch"); §4.7 records "Why hybrid (decision)" with the game-mechanics constraint (`build`/`upgradeController` require WORK parts) and the deferred courier/Builder/Upgrader split; §4.8 records the observability NFR as "proposed and rejected" with an explicit revisit trigger. OQ-1 is a genuinely open question ("Needs ideation"), correctly scoped post-MVP instead of answered rhetorically in the next sentence.

There are no `[NOTE FOR PM]` callouts, but with a sole author who *is* the PM, the §5 Non-Goals and §6.2 "Deferred:" rationales carry that function honestly — the mechanism is substituted, not skipped. Even the MVP exit criterion bakes in the one manual act ("after the operator places Container sites once") rather than smoothing it to full automation.

### Findings

None.

## Substance over theater — strong

No persona theater: a single JTBD pair, both load-bearing (§4.1 "Serves JTBD-2 (unattended operation)"; SM-4 and SM-C2 serve JTBD-1). No vision theater: the Vision names a specific thesis ("switching tasks is what kills colonies") and a specific engineering posture ("new strategy plugs in, the engine is never rewritten") — it could not be swapped into another bot PRD unchanged. No NFR theater: NFR-1 works the actual Screeps CPU economy (working Creeps validate only, idle-only Matching, once-per-Tick Board, cached travel costs), NFR-2 enumerates exactly what persists, NFR-3 lists four concrete disruption classes, NFR-4 names the runtime constraints. The §2.1 "Absorbed during elicitation" note is provenance, not furniture — it records where two candidate jobs went and why they aren't JTBDs.

### Findings

None.

## Strategic coherence — strong

The thesis — sticky, non-preemptive assignment over a derived Job Board, built so strategy evolves without engine rewrites — is served by the feature arc end to end: FR-7/FR-9/FR-10 (stickiness and re-validation), FR-1/FR-2 (derived Board enabling self-healing, "the unmet need simply reappears as a Job next Tick"), FR-21 (Backfill so "the economy never sleeps"), FR-23–FR-27 (Evolution as the engine-proves-itself milestone). The MVP is a coherent platform-proving scope kind ("the MVP proves the engine at RCL2 scale first"), and the exit criterion tests the thesis directly rather than proxied activity.

Success metrics validate the thesis: SM-1 is the exit criterion restated as unattended proof; SM-3 operationalizes "no stalled economy" over a named rolling window; counter-metrics are present and correctly aimed — SM-C1 guards CPU against chasing SM-2/SM-3, SM-C2 guards process integrity against chasing SM-1 velocity. The roadmap phasing in §6.2 follows from the thesis (prove engine → tune strategy → expand), not from what's easy first.

### Findings

- **low** SM-4 has no failure condition (§7) — "self-assessed at each feature review" names no bar and no way to fail; "can explain unaided" is checked against nothing in particular. *Fix:* anchor it to an artifact — each shipped feature names its concept at review time (the addendum already starts this list with Body-upscaling); passing means explaining that named concept unaided.


## Done-ness clarity — adequate

The pattern is exemplary — 30 of 30 FRs carry "Consequences (testable)" bullets that are actually verifiable ("A max-1 Job is never held by two Creeps at once," FR-5; "N Creeps going idle on the same Tick receive N distinct Jobs," FR-13; "Wiping the bot's persisted memory loses no Job information," FR-1) — and the MVP exit criterion is binary. What holds this dimension back is a consistent gap: the PRD is numerically specific where it chooses to be (5 Extensions, 300-Tick regen, ~1,500-Tick lifetime, max workers 1 / access-tile count / unlimited, 1,000-Tick window) yet goes silent on precisely the constants story creation will need, and a few bounds dissolve into adjectives.

### Findings

- **medium** MVP tuning constants are referenced but never specified (FR-14, FR-15, FR-17, FR-4/FR-12) — FR-14 maintains "a target Creep population" with no target given; FR-17 orders spawns by "demand pressure (e.g. Collectors below minimum)" while §4.4 Notes admit only "MVP uses fixed minimums" without the numbers; FR-15's "replacement threshold" and FR-4's per-Job "TTL floors" have no values. Stories for these FRs cannot write acceptance criteria without inventing the numbers — and FR-5 proves the PRD knows how to state such values. *Fix:* add a short "MVP constants" list (provisional values flagged tunable is fine) or explicitly assign each constant to a named decision point, so the omission is a decision rather than a gap.
- **low** NFR bounds dissolve into adjectives (§4.8, FR-25) — NFR-1's testable line is "stays comfortably under the account limit"; NFR-3 heals "within a few Ticks"; FR-25 promises "no energy drought" with drought undefined. Each has a real bound available (a CPU-limit percentage, a Tick count, a Spawn/Extension energy floor). *Fix:* number them — e.g., sustained ≤80% of CPU limit including the Evolution spike; every living Creep re-Contracted within ≤10 Ticks of a Memory wipe; drought defined as Spawn energy hitting zero.
- **low** FR-12's preference clause is unbounded (§4.3) — "matching prefers work the Creep can plausibly reach and serve within its life": "plausibly" has no test, and the consequence bullets only restate the direction ("never dispatched on a long journey"). The hard half of the FR (never assigned past a Job's TTL floor) is testable; the preference half is not. *Fix:* make the preference an explicit tie-break in the lexicographic order, or cut the clause.

## Scope honesty — strong

Ten explicit Non-Goals, each with a destination or rationale (§5); an in-feature Out of Scope exactly where silence would be misread (§4.2 preemption, given the Vision's "non-preemptive" headline); a rejected-and-recorded NFR with a revisit trigger (§4.8); de-scoping rationales that say what was given up and why now is the wrong time ("tuning needs a running MVP to tune"; "the MVP proves the engine at RCL2 scale first"; "shard domination is the north star, not the starting move"). The two `[ASSUMPTION]` tags mark precisely the inferences the author did not confirm, and both land in §9. Open-items density is right for a green-light artifact: one post-MVP OQ and two low-risk assumptions — nothing dangling that blocks architecture.

### Findings

None.


## Downstream usability — strong

Built for source-extraction: the Glossary declares "No synonyms" and the body honors it (terms are used identically across FRs, SMs, and §6.1's FR ranges); IDs are contiguous and unique (FR-1–30, NFR-1–4, SM-1–4/SM-C1–C2, OQ-1, JTBD-1–2) with every traced cross-reference resolving (SM-1 → FR-23–FR-30 + NFR-3; §6.1's ranges match the feature sections exactly; FR-26 → FR-17/FR-18; addendum → FR-1/FR-2). Sections stand alone: each feature carries its own description, consequences, and deferral notes, cross-referencing by ID rather than "see above." The UJ omission is declared and justified in place (§2.3 note). One real hazard below; lighter items in the Mechanical notes.

### Findings

- **medium** Glossary contradicts itself on the Generalist's Job (§3) — the Job entry states "there are no collect or compound mine-and-collect Job types," while the Generalist entry says the Generalist "fulfills the mine-and-collect Job." §4.5/FR-19 resolve it in prose (Generalists pull fill/build/upgrade and self-source), but the Glossary is the first section architecture and story workflows will extract, and it is the section that asserts exactness over itself. *Fix:* rewrite the Generalist entry to match §4.5 — e.g., "fulfills fill, build, and upgrade Jobs, sourcing its own energy (FR-19)."

## Shape fit — strong

Right shape, worn lightly. A single-operator capability spec with no UI correctly drops UJs — with the omission declared and its carrier named (§2.3) rather than silently absent — keeps JTBDs to two load-bearing items, and uses operational SMs. The chain-top discipline is real: capability stays in the PRD, mechanism goes to the addendum, and the addendum is genuinely downstream-shaped ("define Bodies as data … so post-MVP upscaling is a config change, not a code change"). Hobby/solo ceremony (personas, journey maps, stakeholder matrices) is absent without substance being cut; the practiced rigor is aimed at decisions and testability, which is where JTBD-1 says it should transfer.

### Findings

None.

## Mechanical notes

- **Broken cross-ref (input source):** §0 names `input/perplexity_thread.md` as the PRD's single input; no `input/` directory exists in the doc workspace. Thread-attributed claims ("the thread's weighted scoring formula," "the thread's Erlang-C intuition," "the thread's 'high = harvest with a protected floor' tier") currently trace to a missing file. Restore the file or adjust the reference.
- **Glossary drift:** the Generalist contradiction (flagged under Downstream usability) is the only substantive case. Otherwise clean — "the Board" for Job Board is consistent shorthand; "Creep's memory" (FR-8) vs. "Memory wipes" (NFR-3) matches Screeps API usage.
- **ID continuity:** FR-1–FR-30 contiguous, no gaps or duplicates; NFR-1–4, SM-1–4, SM-C1–C2, OQ-1, JTBD-1–2 all present. Sampled cross-references all resolve (§5 → §2.2/§4.2/§4.7/§4.8/OQ-1; §7 → FR/NFR targets; §9 → §2.2/§7).
- **Assumptions Index roundtrip:** clean in both directions — two inline `[ASSUMPTION]` tags (§2.2, §7/SM-2), two §9 entries, no orphans either way.
- **Unindexed open item:** "*Working title — confirm.*" (line 9) is an open decision tracked nowhere — trivial, but exactly the kind of dangler the index exists to catch.
- **UJ protagonist naming:** N/A — UJs intentionally omitted (§2.3 note); correct for this shape.
- **Required sections:** all present for the agreed shape and stakes — Vision, Target User/JTBDs, Glossary, Features/FRs with testable consequences, NFRs, explicit Non-Goals, MVP Scope with exit criterion, SMs with counter-metrics, Open Questions, Assumptions Index.

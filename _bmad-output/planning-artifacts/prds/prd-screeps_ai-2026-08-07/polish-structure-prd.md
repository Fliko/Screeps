# Structural Editorial Review — prd-screeps_ai-2026-08-07

## Document Summary

- **Purpose:** Product Requirements Document for an autonomous Screeps colony bot; feeds downstream architecture and epics/stories workflows
- **Audience:** The solo author (an engineer) + LLM-based downstream workflows that source-extract from it
- **Reader type:** humans (Human-Reader Principles apply; LLM-extraction fitness noted where relevant)
- **Structure model:** Strategic/Context (Pyramid) — top-down headline, logically grouped support, most-critical-first, MECE groups
- **Current length:** ~4,600 words across 10 sections (§0–§9), including 30 FRs with a 100%-consistent "Consequences (testable)" schema
- **Existence statement:** This document exists to help the solo author (and the BMad pipelines that consume it) define and bound the bot's capabilities precisely enough that architecture and stories can be derived without re-litigating requirements.

**Section map (words):**

| Section | Words | Serves purpose? |
|---|---|---|
| §0 Document Purpose | 126 | Yes — meta-contract for downstream consumers |
| §1 Vision | 196 | Yes — the Pyramid headline |
| §2 Target User | 207 | Yes — with one cuttable meta-paragraph |
| §3 Glossary | 479 | Yes — but some entries carry non-definition cargo |
| §4 Features (4.1–4.8) | 2,881 | Yes — core of the document; exemplary schema |
| §5 Non-Goals (Explicit) | 139 | Yes — but heavily overlaps §6.2 and inline notes |
| §6 MVP Scope | 237 | Yes — but 6.1 partly restates §4's table of contents |
| §7 Success Metrics | 174 | Yes — clean, traceable |
| §8 Open Questions | 41 | Yes — minimal, correctly scoped |
| §9 Assumptions Index | 69 | Yes — intentional index of inline tags |

**Pyramid check:** The headline (Vision) leads, evidence (FRs) is grouped MECE below it, and scope/metrics follow — ordering is fundamentally sound. No burying of critical information found; no FAQ/appendix/verbatim-overview anti-patterns. The structural issues are localized duplication across the three scope-boundary surfaces (inline Notes, §5, §6.2) and a few sections carrying cargo outside their schema.

## Recommendations

### 1. [MERGE] — §5 Non-Goals and §6.2 Out of Scope for MVP
**Rationale:** These are two scope-boundary sections restating the same deferrals at different compression (combat/multi-room, preemption, weighted scoring/Erlang-C, courier split, Haulers, observability, market/power creeps all appear in both, most also repeated in §4 inline notes); merging into one "Out of Scope" section — with each item tagged `MVP-deferred → Phase N` or `v1-excluded` — creates a single source of truth for boundaries while keeping the conventional "Non-Goals" heading downstream workflows look for.
**Impact:** ~110 words saved
**Comprehension note:** None — every deferred item survives exactly once, with its phase tag; the surviving section should retain a "Non-Goals" heading for extraction compatibility.

### 2. [CONDENSE] — §6.1 In Scope: drop the FR-range enumeration
**Rationale:** The five bullets listing FR ID ranges (FR-1–FR-6, FR-7–FR-10, …) restate §4's own structure without adding a boundary — the only new information is "one room, one Spawn, official World shard" and the bolded MVP exit criterion, which should be the section's payload.
**Impact:** ~70 words saved
**Comprehension note:** Minor — FR-range bullets give downstream story-scoping a cheap lookup; if retained, keep only because the exit criterion alone justifies the section.

### 3. [CUT] — §2.1 "Absorbed during elicitation" paragraph
**Rationale:** This is process archaeology — it explains where two candidate requirements *went* rather than stating a requirement, and both outcomes are already carried by the FRs and §0's no-code constraint.
**Impact:** ~55 words saved
**Comprehension note:** This cut may impact reader comprehension/engagement slightly — it answers the reader question "why is unattended operation not a JTBD?"; if that trace matters to the author, fold one clause ("unattended operation is a capability carried by the FRs, not a job") into JTBD-2 instead of deleting outright.

### 4. [CONDENSE] — §3 Glossary: definitions only, no scope/roadmap cargo
**Rationale:** The Collector entry carries the post-MVP courier-split plan (already in §4.7 Notes and §5) and the Hauler entry is a roadmap term repeated four more times across the document — glossary entries should hold definitions per the Reference model's consistent-schema rule, with scope/roadmap living in its owning section.
**Impact:** ~40 words saved
**Comprehension note:** None — the split/roadmap facts remain findable in §4.7 and §6.2.

### 5. [CONDENSE] — Triple-stated post-MVP refinements in §4.6/§4.7 Notes and FR-29
**Rationale:** "Hauler variant for towers/storage" appears in both §4.6 and §4.7 Notes, and "two Harvesters per Source" appears in §4.7 Notes, FR-29's parenthetical, and §6.2 — true redundancy (identical information, no reinforcement purpose); keep each refinement once in §6.2's roadmap and let the inline notes point there.
**Impact:** ~35 words saved
**Comprehension note:** None — inline pointers preserve local context at lower cost.


### 6. [CONDENSE] — Repeated deferral boilerplate across §4 Notes
**Rationale:** The phrase "deferred to the configurable-strategy roadmap goal (§6.2)" (and variants) appears five times; establishing a short convention once in §0 (e.g. tag deferred items `[→ §6.2 Phase 3]`) turns ~8-word sentences into 4-word tags and improves scannability for both the author and extractors.
**Impact:** ~35 words saved

### 7. [CONDENSE] — §0 Document Purpose: break the single 126-word paragraph into bullets
**Rationale:** §0 mixes six distinct meta-facts (audience, input provenance, World-not-Arena, glossary anchoring, assumption indexing, the no-code constraint) into one dense block; bulleting them front-loads each fact for scanning at near-zero word cost.
**Impact:** ~15 words saved; primary gain is scannability

### 8. [QUESTION] — Glossary position: keep at §3 or move to an appendix after §9?
**Rationale:** For the human reader, 23 defined terms before any feature content is a speed bump between the Vision and the payload (Pyramid: most-critical-first), but the placement is deliberate vocabulary-anchoring and serves the LLM consumers' dependency-first need — this is an author-preference call, not a defect.
**Impact:** 0 words either way

### 9. [PRESERVE] — §1 Vision, including the motivational third paragraph
**Rationale:** The "two scoreboards" paragraph might read as warmth a density pass would cut, but it is the document's definition of success — SM-1/SM-2 validate it explicitly, and for a deliberate-practice project the emotional proof-point is load-bearing content, not fluff.
**Impact:** +0 words (protects ~70 words from future cuts)

### 10. [PRESERVE] — The "Consequences (testable)" FR schema
**Rationale:** All 30 FRs follow statement → testable-consequences identically; this is the single most valuable structural feature for the downstream test-design and story workflows, and any condensation of §4 must leave it untouched.
**Impact:** +0 words

### 11. [PRESERVE] — §2.3 "intentionally omitted" note (and §9 Assumptions Index)
**Rationale:** Both look like overhead but function as guards: the omission note stops downstream workflows from inventing user journeys, and the index is an intentional surfacing of inline tags rather than duplication.
**Impact:** +0 words

## Summary

- **Total recommendations:** 11 (1 MERGE, 5 CONDENSE, 1 CUT, 1 QUESTION, 3 PRESERVE)
- **Estimated reduction:** ~360 words (~8% of original) — deliberately modest; the document is already lean, and the value here is de-duplication and schema discipline, not shrinkage
- **Meets length target:** No target specified ("no limit" given; changes recommended only where they earn their place)
- **Comprehension trade-offs:** Only Rec 3 (cutting the elicitation paragraph) sacrifices a reader-facing rationale; a one-clause fallback is provided. The dominant theme — consolidating the three overlapping scope surfaces (inline Notes, §5, §6.2) — *improves* comprehension by giving each boundary fact one canonical home.


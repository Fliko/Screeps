# Reconciliation: input/prd.md → PRD + Addendum

**Source input:** `input/prd.md` — author's original one-page brain dump (10 lines: Screeps context, World game mode, pointer to external requirements discussion).
**Compared against:** `prd.md` (§0–§9) and `addendum.md` in this directory.

## Captured

| Brain-dump item | Where it lives |
|---|---|
| "I am writing code for … Screeps" (project identity) | PRD title (*screeps_ai — Autonomous Colony AI for Screeps: World*), §1 Vision, NFR-4 (runs inside the Screeps runtime) |
| "scripting creeps" / creeps as units | §3 Glossary — **Creep** defined as the worker unit; term used exactly throughout FRs |
| "gather resources" | Mine Jobs (FR-2 Producer), FR-19 self-sourcing execution, §4.7 Specialist economy (Harvester) |
| "build" | Build Jobs (FR-2, FR-20, FR-24); construction handled engine-natively |
| "fight" | Consciously set aside, not dropped silently: §5 Non-Goals ("No combat or defense in v1"), §6.2 Phase 4 — Military & expansion |
| "autonomously online" | §1 "runs a colony unattended", FR-21 Backfill, NFR-3 self-healing, SM-1/SM-3 |
| "aimed at programming enthusiasts" | Absorbed into §2 Target User (author = software engineer, deliberate-practice project); the game-audience framing is background color, not a requirement |
| "I am writing code for the World game mode" | Title, §1 ("for Screeps: World"), §6.1 ("on the official World shard"), NFR-4 (deploys unmodified on official World shard; simulation room) |
| Pointer to external requirements discussion (Perplexity thread) | §0 Document Purpose: "builds on one input: `input/perplexity_thread.md` … extracted here, not duplicated" (file confirmed present in `input/`); the thread's non-preemptive scheduling substance permeates §4.1–§4.4 (sticky Contracts, Job Board, capacity reservation), and §1's "switching tasks is what kills colonies" echoes the thread's title ("scheduling jobs with costly ta[sk-switching]") |

## Gaps

1. **World-vs-Arena distinction never recorded.** The brain dump explicitly frames Screeps as two games (World *and* Arena) and declares the World choice. The PRD assumes World throughout but never states the distinction or excludes Arena — a reader unfamiliar with Screeps gets no explanation of what "World" means or that Arena exists and is out of scope.
2. **Perplexity URL dropped.** §0 cites the local extraction `input/perplexity_thread.md` but the original thread URL is not preserved anywhere in the PRD or addendum — provenance of the requirements discussion is lost if the local copy is ever questioned or needs re-fetching.
3. **"Real JavaScript" not named.** NFR-4 specifies "the Screeps runtime" but never states the implementation language; the brain dump's defining detail (you script in real JavaScript) has no explicit home.

## Verdict

The brain dump is effectively fully absorbed: its World scoping, autonomy intent, and (via the extracted thread) scheduling substance all live explicitly in the PRD, with combat consciously deferred rather than lost. The only gaps are contextual metadata — the World-vs-Arena disambiguation, the source URL, and the JavaScript detail — none of which change any requirement, but all of which the PRD silently assumes.

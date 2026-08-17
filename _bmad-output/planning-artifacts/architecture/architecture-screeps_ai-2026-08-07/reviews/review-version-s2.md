# Version-verification lens — Stage 2 amendment

Run inline. Only two new technology claims were bound in this update (everything else in the Stack table carries its 2026-08-07 verification forward untouched, no new claim made about those rows).

- **screeps-launcher** — verified via `https://github.com/screepers/screeps-launcher/releases`: latest release `v1.17.0`, adds Node 24 support. Cross-checked against this spine's existing Node 24 LTS pin (Stage 1, unchanged) — compatible.
- **screeps (private-server engine)** — verified via npm registry search: `~4.3.0`, published ~3 months prior to this check (2026-08-16). The launcher manages this dependency; not independently pinned in package.json by this project.
- `@screeps/launcher` (the older, differently-scoped npm package under the `@screeps` org, last published ~2 years prior) was found during the search and explicitly **not** chosen — `screeps-launcher` (screepers org, actively maintained) is the bound package. Recorded here so a future reader doesn't reintroduce the stale one by name confusion.

Verdict: pass, both new claims web-verified and dated in the spine's Stack table.

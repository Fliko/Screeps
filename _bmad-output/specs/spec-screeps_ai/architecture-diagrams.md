# Architecture Diagrams — screeps_ai

Diagrams for [SPEC.md](SPEC.md) CAP-1, CAP-3, CAP-9. Source: `ARCHITECTURE_SPINE.md`.

## Control cycle (main.ts, one pass per Tick — AD-9)

```mermaid
flowchart LR
  generate["generate — Producers emit Jobs, tagged by Node"] --> taken["derive taken-set from Contracts"]
  taken --> validate["validate working Creeps"]
  validate --> match["match idle Creeps, Node-gated, claim-locked"]
  match --> spawn["feed the Spawn"]
```

## Node-gated assignment cascade (AD-7, CAP-3)

```mermaid
flowchart TD
  idle["idle Creep"] --> rank["rank open Jobs by\nNode.Priority() desc"]
  rank --> gate{"Node.NumWorkers()\nlive cap not yet reached?"}
  gate -->|"no — Node full, skip it"| rank
  gate -->|yes| balance["within-Node balancer\npicks the specific target\n(LEAST_FULL / STICKY)"]
  balance --> dist["distance — final tiebreak"]
  dist --> assign["assign Contract\nid = type:node:targetId"]
```

## Module dependency flow (AD-1, AD-2)

```mermaid
flowchart TD
  main["main.ts — control cycle"] --> world["world/"]
  main --> control["control/"]
  main --> agents["agents/"]
  world -->|"writes, per Tick"| board["board/"]
  control -->|reads| board
  control -->|reads| world
  agents -->|reads| board
  agents -->|reads| world
  control -->|"writes via schema"| state["state/"]
  agents -->|"writes own memory via schema"| state
  board -.->|"never persisted"| state
```

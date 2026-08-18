/**
 * Shared test fixture: one representative Node per JobType (AD-11).
 * Centralizes the type→node mapping duplicated across test files so a
 * NodeName rename or addition only needs updating in one place.
 */
import type { JobType, NodeName } from "../../src/board/job";

export const NODE_BY_TYPE: Record<JobType, NodeName> = {
  mine: "mines",
  fill: "spawns",
  build: "build",
  upgrade: "upgrade",
};

/** Subset covering only Pulled-mode Job types ("mine" is Reserved-mode). */
export const PULLED_NODE_BY_TYPE: Record<
  "fill" | "build" | "upgrade",
  NodeName
> = {
  fill: NODE_BY_TYPE.fill,
  build: NODE_BY_TYPE.build,
  upgrade: NODE_BY_TYPE.upgrade,
};

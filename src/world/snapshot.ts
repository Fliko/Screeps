/**
 * AD-10 world snapshot — plain-data, per-Tick view of the room.
 * Built once per Tick by `buildWorldSnapshot()` and read by Producers,
 * Matching, Spawn, and agents through `getCurrentSnapshot()`.
 */

import {
  type ConstructionSiteStub,
  type ControllerStub,
  type CreepStub,
  getGame,
  type RoomPositionData,
  type SourceStub,
  type StructureStub,
} from "../game";
import { getContract } from "../state/contract";

export interface SnapshotStructure {
  id: string;
  pos: RoomPositionData;
  structureType: StructureConstant;
  energy: number;
  energyCapacity: number;
  /** True while a STRUCTURE_SPAWN is mid-spawnCreep. Only meaningful for STRUCTURE_SPAWN. */
  spawning?: boolean;
}

export interface SnapshotSource {
  id: string;
  pos: RoomPositionData;
  energy: number;
  energyCapacity: number;
}

export interface SnapshotConstructionSite {
  id: string;
  pos: RoomPositionData;
  structureType: BuildableStructureConstant;
  progress: number;
  progressTotal: number;
}

export interface SnapshotController {
  id: string;
  pos: RoomPositionData;
  level: number;
  progress: number;
  progressTotal: number;
  owner?: string;
}

export interface SnapshotCreep {
  id: string;
  pos: RoomPositionData;
  body: BodyPartConstant[];
  ttl: number;
  carry: number;
  carryCapacity: number;
  /** True while the Creep is still being spawned (its `ttl` reads 0 regardless). */
  spawning?: boolean;
  contract?: string;
}

export interface WorldSnapshot {
  roomName: string;
  /** Current Tick number, from `game.getTime()` (Story 5.1) — used for unique Creep naming. */
  tick: number;
  /** Available energy in the room (Spawn + Extensions aggregate), from `game.getEnergyAvailable()` (Story 5.3). */
  energyAvailable: number;
  controller?: SnapshotController;
  structures: readonly SnapshotStructure[];
  constructionSites: readonly SnapshotConstructionSite[];
  sources: readonly SnapshotSource[];
  creeps: readonly SnapshotCreep[];
}

let currentSnapshot: WorldSnapshot | undefined;

/** Returns the snapshot for the current Tick, if one has been built. */
export function getCurrentSnapshot(): WorldSnapshot | undefined {
  return currentSnapshot;
}

/** Builds a fresh plain-data snapshot from the Game adapter. No caching, no Memory. */
export function buildWorldSnapshot(): WorldSnapshot {
  const game = getGame();
  const rooms = game.getRooms();
  const roomName = rooms[0] ?? "";

  const snapshot: WorldSnapshot = {
    roomName,
    tick: game.getTime(),
    energyAvailable: 0,
    structures: [],
    constructionSites: [],
    sources: [],
    creeps: [],
  };

  // Publish the empty snapshot immediately so a downstream consumer never
  // sees a stale snapshot if an adapter read throws mid-build.
  currentSnapshot = snapshot;

  if (!roomName) {
    return snapshot;
  }

  snapshot.energyAvailable = game.getEnergyAvailable(roomName);

  const controller = game.getController(roomName);
  if (controller) {
    snapshot.controller = mapController(controller);
  }

  snapshot.structures = game.findMyStructures(roomName).map(mapStructure);
  snapshot.constructionSites = game
    .findConstructionSites(roomName)
    .map(mapConstructionSite);
  snapshot.sources = game.findSources(roomName).map(mapSource);
  snapshot.creeps = game.findCreeps(roomName).map(mapCreep);

  return snapshot;
}

function mapStructure(stub: StructureStub): SnapshotStructure {
  return {
    id: stub.id,
    pos: stub.pos,
    structureType: stub.structureType,
    energy: stub.energy,
    energyCapacity: stub.energyCapacity,
    spawning: stub.spawning,
  };
}

function mapConstructionSite(
  stub: ConstructionSiteStub,
): SnapshotConstructionSite {
  return {
    id: stub.id,
    pos: stub.pos,
    structureType: stub.structureType,
    progress: stub.progress,
    progressTotal: stub.progressTotal,
  };
}

function mapSource(stub: SourceStub): SnapshotSource {
  return {
    id: stub.id,
    pos: stub.pos,
    energy: stub.energy,
    energyCapacity: stub.energyCapacity,
  };
}

function mapController(stub: ControllerStub): SnapshotController {
  return {
    id: stub.id,
    pos: stub.pos,
    level: stub.level,
    progress: stub.progress,
    progressTotal: stub.progressTotal,
    owner: stub.owner,
  };
}

function mapCreep(stub: CreepStub): SnapshotCreep {
  return {
    id: stub.id,
    pos: stub.pos,
    body: stub.body,
    ttl: stub.ttl,
    carry: stub.carry,
    carryCapacity: stub.carryCapacity,
    spawning: stub.spawning ?? false,
    contract: getContract(stub)?.jobId,
  };
}

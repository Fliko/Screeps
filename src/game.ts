/**
 * Game adapter interface — abstracts Screeps Game global for testability.
 * Production uses the real Game global; tests inject mocks via setGame().
 * Story 1.4: CPU metering uses cpu.getUsed().
 * Story 2.1: AD-10 world-read seam (find/look/getObjectById/terrain) lives here.
 * No Game API reads outside world/ and this adapter.
 */

import type { MoveState } from "./state/move";

declare global {
  interface CreepMemory {
    contract?: string;
    move?: MoveState;
  }
}

export interface RoomPositionData {
  x: number;
  y: number;
  roomName: string;
}

export interface StructureStub {
  id: string;
  pos: RoomPositionData;
  structureType: StructureConstant;
  energy: number;
  energyCapacity: number;
}

export interface ConstructionSiteStub {
  id: string;
  pos: RoomPositionData;
  structureType: BuildableStructureConstant;
  progress: number;
  progressTotal: number;
}

export interface ControllerStub {
  id: string;
  pos: RoomPositionData;
  level: number;
  progress: number;
  progressTotal: number;
  owner?: string;
}

export interface CreepStub {
  id: string;
  pos: RoomPositionData;
  body: BodyPartConstant[];
  ttl: number;
  carry: number;
  carryCapacity: number;
  /** True while the Creep is still being spawned — `ticksToLive` is undefined then. */
  spawning?: boolean;
  memory: { contract?: string };
}

export interface TerrainStub {
  get(x: number, y: number): number;
}

export interface GameAdapter {
  cpu: {
    getUsed(): number;
  };
  /** Return visible room names. */
  getRooms(): string[];
  /** Return energy-storing structures (Spawn, Extension, Container, etc.). */
  findMyStructures(roomName: string): StructureStub[];
  /** Return all construction sites in the room. */
  findConstructionSites(roomName: string): ConstructionSiteStub[];
  /** Return my creeps in the room. */
  findCreeps(roomName: string): CreepStub[];
  /** Return the room controller if one exists and is visible. */
  getController(roomName: string): ControllerStub | undefined;
  /** Return terrain lookup for the room. */
  getTerrain(roomName: string): TerrainStub;
  /** Resolve any object by its Screeps id. */
  getObjectById<T extends _HasId>(id: Id<T> | string): T | undefined;
}

function toPos(pos: RoomPosition): RoomPositionData {
  return { x: pos.x, y: pos.y, roomName: pos.roomName };
}

function isEnergyStructure(
  structure: AnyOwnedStructure,
): structure is AnyOwnedStructure & { energy: number; energyCapacity: number } {
  return (
    "energyCapacity" in structure &&
    (structure as StructureSpawn).energyCapacity > 0
  );
}

/**
 * Default Game adapter — wraps the global Game object.
 * Used in production; tests override via setGame().
 */
const defaultGame: GameAdapter = {
  cpu: {
    getUsed: () => Game.cpu.getUsed(),
  },
  getRooms: () => Object.keys(Game.rooms),
  findMyStructures: (roomName: string): StructureStub[] => {
    const room = Game.rooms[roomName];
    if (!room) return [];
    return room
      .find(FIND_MY_STRUCTURES)
      .filter(isEnergyStructure)
      .map((structure) => ({
        id: structure.id,
        pos: toPos(structure.pos),
        structureType: structure.structureType,
        energy: structure.energy,
        energyCapacity: structure.energyCapacity,
      }));
  },
  findConstructionSites: (roomName: string): ConstructionSiteStub[] => {
    const room = Game.rooms[roomName];
    if (!room) return [];
    return room.find(FIND_CONSTRUCTION_SITES).map((site) => ({
      id: site.id,
      pos: toPos(site.pos),
      structureType: site.structureType,
      progress: site.progress,
      progressTotal: site.progressTotal,
    }));
  },
  findCreeps: (roomName: string): CreepStub[] => {
    const room = Game.rooms[roomName];
    if (!room) return [];
    return room.find(FIND_MY_CREEPS).map((creep) => ({
      id: creep.id,
      pos: toPos(creep.pos),
      body: creep.body.map((part) => part.type),
      ttl: creep.ticksToLive ?? 0,
      carry: creep.carry.energy ?? 0,
      carryCapacity: creep.carryCapacity,
      spawning: creep.spawning,
      memory: {
        // Adapter mapping: the raw string is validated in world/snapshot.ts via getContract.
        // game.ts stays below business logic and does not import state/.
        contract: creep.memory.contract,
      },
    }));
  },
  getController: (roomName: string): ControllerStub | undefined => {
    const controller = Game.rooms[roomName]?.controller;
    if (!controller) return undefined;
    return {
      id: controller.id,
      pos: toPos(controller.pos),
      level: controller.level,
      progress: controller.progress,
      progressTotal: controller.progressTotal,
      owner: controller.owner?.username,
    };
  },
  getTerrain: (roomName: string): TerrainStub =>
    Game.map.getRoomTerrain(roomName),
  getObjectById: <T extends _HasId>(id: Id<T> | string): T | undefined =>
    Game.getObjectById(id as Id<T>) ?? undefined,
};

/**
 * Mutable game instance — production uses defaultGame, tests override.
 */
let gameInstance: GameAdapter = defaultGame;

/**
 * Returns the current Game adapter instance.
 */
export function getGame(): GameAdapter {
  return gameInstance;
}

/**
 * Overrides the Game adapter instance (for testing).
 * Call with no argument or undefined to reset to default.
 */
export function setGame(mock?: GameAdapter): void {
  gameInstance = mock ?? defaultGame;
}

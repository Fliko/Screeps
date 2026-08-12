/**
 * Memory adapter — abstracts Screeps Memory global for testability.
 * Production uses the real Memory global; tests inject mocks via setMemory().
 * Story 1.4: AD-5 zero colony memory constraint verified via Memory inspection.
 * Epic 2+: Memory.creeps, Memory.rooms, etc. will extend this.
 */
export type MemoryStore = Record<string, unknown>;

/**
 * Default Memory accessor — returns the global Memory object.
 * Used in production; tests override via setMemory().
 */
function getDefaultMemory(): MemoryStore {
  return (globalThis as { Memory?: MemoryStore }).Memory ?? {};
}

/**
 * Mutable memory instance — production uses global Memory, tests override.
 */
let memoryInstance: MemoryStore | null = null;

/**
 * Returns the current Memory store.
 * Production: returns global Memory.
 * Tests: returns injected mock.
 */
export function getMemory(): MemoryStore {
  return memoryInstance ?? getDefaultMemory();
}

/**
 * Overrides the Memory store (for testing).
 * Call with no argument or undefined to reset to default (global Memory).
 */
export function setMemory(mock?: MemoryStore): void {
  memoryInstance = mock ?? null;
}

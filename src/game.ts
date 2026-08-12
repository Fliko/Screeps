/**
 * Game adapter interface — abstracts Screeps Game global for testability.
 * Production uses the real Game global; tests inject mocks via setGame().
 * Story 1.4: CPU metering uses cpu.getUsed().
 * Epic 2+: AD-10 world-read seam (find/look/getObjectById/terrain) will extend this.
 */
export interface GameAdapter {
  cpu: {
    getUsed(): number;
  };
}

/**
 * Default Game adapter — wraps the global Game object.
 * Used in production; tests override via setGame().
 */
const defaultGame: GameAdapter = {
  cpu: {
    getUsed: () => Game.cpu.getUsed(),
  },
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

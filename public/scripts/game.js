import { Board, Ship, GRID_SIZE } from './board.js';

export const PHASE = {
  WAITING: 'waiting',
  CONNECTED: 'connected',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

export class Game {
  constructor(playerId) {
    this.playerId = playerId;
    this.ownBoard = new Board(playerId);
    this.enemyBoard = new Board(0);
    this.phase = PHASE.WAITING;
    this.mode = 'round';
    this.shipsRemaining = {};
    this.winner = null;
    this.messages = [];
    this.turnLog = [];
    this.myTargets = [];
    this.opponentTargets = [];
    this.timer = null;
    this.lastActivity = Date.now();
  }

  setup() {
    this.ownBoard.placeShipsRandomly();
    this.phase = PHASE.CONNECTED;
    this._countShips();
  }

  receiveOpponentState(state) {
    this.enemyBoard.shotResults = state.shotResults || {};
    this.enemyBoard.shots = new Set(Object.keys(state.shotResults || {}));
    // Rebuild as real Ship instances so enemyBoard.fire() (which relies on
    // Ship.isCellAt / Ship.takeHit) can resolve our shots locally and let us
    // detect when the enemy fleet is fully sunk.
    this.enemyBoard.ships = (state.ships || []).map((s) => {
      const ship = new Ship(
        { name: s.name, size: s.size, symbol: s.symbol },
        s.id,
        s.row,
        s.col,
        s.vertical
      );
      ship.hits = s.hits || 0;
      ship.sunk = !!s.sunk;
      ship.hidden = !!s.hidden;
      ship.canShift = false;
      return ship;
    });
    // Mark ship cells on the enemy grid for consistency with fire().
    this.enemyBoard.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    for (const ship of this.enemyBoard.ships) {
      for (const c of ship.getCells()) {
        if (c.row >= 0 && c.row < GRID_SIZE && c.col >= 0 && c.col < GRID_SIZE) {
          this.enemyBoard.grid[c.row][c.col] = 1;
        }
      }
    }
  }

  fireTarget(row, col) {
    if (this.phase !== PHASE.PLAYING) return null;
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
    return this.enemyBoard.fire(row, col);
  }

  resolveTurns(targets) {
    this.turnLog.push(targets);
    for (const t of targets) {
      if (t.player === this.playerId) continue;
      const result = this.ownBoard.fire(t.row, t.col);
      if (result.result === 'sink') {
        this._countShips();
      }
    }
    const remaining = this.shipsRemaining[this.playerId];
    if (remaining === 0) {
      // Our own fleet was wiped out — the opponent is the winner, not us.
      this.phase = PHASE.FINISHED;
      this.winner = this.playerId === 1 ? 2 : 1;
    }
  }

  applyTorpedoShift(boatId, from, to) {
    const ship = this.ownBoard.ships.find((s) => s.id === boatId);
    if (ship) {
      const oldCells = ship.getCells();
      for (const c of oldCells) {
        this.ownBoard.grid[c.row][c.col] = 0;
      }
      ship.row = to[0][0];
      ship.col = to[0][1];
      const newCells = ship.getCells();
      for (const c of newCells) {
        this.ownBoard.grid[c.row][c.col] = 1;
      }
    }
  }

  addTarget(row, col) {
    if (this.mode === 'queue') {
      this.myTargets = [{ row, col }];
    } else {
      const key = `${row},${col}`;
      if (!this.myTargets.find((t) => `${t.row},${t.col}` === key)) {
        this.myTargets.push({ row, col });
      }
    }
  }

  flushTargets() {
    const targets = [...this.myTargets];
    this.myTargets = [];
    return targets;
  }

  _countShips() {
    this.shipsRemaining[this.playerId] = this.ownBoard.ships.filter((s) => !s.sunk).length;
  }

  addMessage(text) {
    this.messages.push({ text, time: Date.now() });
  }
}

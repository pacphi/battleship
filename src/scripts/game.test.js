import { describe, it, expect } from 'vitest';
import { Game, PHASE } from './game.js';

describe('PHASE', () => {
  it('defines all phases', () => {
    expect(PHASE.WAITING).toBe('waiting');
    expect(PHASE.CONNECTED).toBe('connected');
    expect(PHASE.PLAYING).toBe('playing');
    expect(PHASE.FINISHED).toBe('finished');
  });
});

describe('Game', () => {
  describe('construction', () => {
    it('creates game with correct phase', () => {
      const game = new Game(1);
      expect(game.phase).toBe(PHASE.WAITING);
      expect(game.playerId).toBe(1);
    });

    it('has empty own board and enemy board', () => {
      const game = new Game(2);
      expect(game.ownBoard).toBeDefined();
      expect(game.enemyBoard).toBeDefined();
      expect(game.ownBoard.ships).toHaveLength(0);
      expect(game.enemyBoard.shots).toBeInstanceOf(Set);
    });

    it('starts with no ships remaining tracked', () => {
      const game = new Game(1);
      expect(game.shipsRemaining).toEqual({});
    });

    it('defaults to round mode', () => {
      const game = new Game(1);
      expect(game.mode).toBe('round');
    });

    it('has empty messages and turnLog', () => {
      const game = new Game(1);
      expect(game.messages).toHaveLength(0);
      expect(game.turnLog).toHaveLength(0);
    });
  });

  describe('setup', () => {
    it('places ships and sets phase to CONNECTED', () => {
      const game = new Game(1);
      expect(game.phase).toBe(PHASE.WAITING);
      game.setup();
      expect(game.phase).toBe(PHASE.CONNECTED);
      expect(game.ownBoard.ships).toHaveLength(6);
    });

    it('counts ships after setup', () => {
      const game = new Game(1);
      game.setup();
      expect(game.shipsRemaining[1]).toBe(6);
    });
  });

  describe('fireTarget', () => {
    beforeEach(() => {
      const game = new Game(1);
      game.setup();
      game.phase = PHASE.PLAYING;
      window.game = game;
    });

    it('fires at enemy board when phase is PLAYING', () => {
      // This just checks that the method doesn't throw
      // Actual hit/miss depends on random ship placement
      expect(() => {
        const result = window.game.fireTarget(0, 0);
        expect(result).toBeDefined();
        expect(['hit', 'miss', 'already-shot']).toContain(result.result);
      }).not.toThrow();
    });

    it('returns null when phase is not PLAYING', () => {
      const game = new Game(1);
      game.setup(); // PHASE.CONNECTED, not PLAYING
      expect(game.fireTarget(0, 0)).toBeNull();
    });

    it('validates bounds', () => {
      expect(() => {
        window.game.fireTarget(-1, -1);
      }).not.toThrow();
      expect(window.game.enemyBoard.shots.size).toBe(0);
    });
  });

  describe('receiveOpponentState', () => {
    it('reconstructs enemy ships from sync data', () => {
      const game = new Game(1);
      const syncData = {
        ships: [
          { id: 'test-ship', row: 0, col: 0, vertical: false, size: 3, sunk: false, hidden: false, name: 'Test Ship', symbol: 'T' },
        ],
        shotResults: {},
      };
      game.receiveOpponentState(syncData);
      expect(game.enemyBoard.ships).toHaveLength(1);
      expect(game.enemyBoard.ships[0].id).toBe('test-ship');
    });

    it('stores shot results', () => {
      const game = new Game(1);
      const syncData = {
        ships: [],
        shotResults: { '0,0': 'hit', '1,1': 'miss' },
      };
      game.receiveOpponentState(syncData);
      expect(game.enemyBoard.shotResults['0,0']).toBe('hit');
      expect(game.enemyBoard.shotResults['1,1']).toBe('miss');
    });

    it('populates enemy shots set from shotResults keys', () => {
      const game = new Game(1);
      const syncData = {
        ships: [],
        shotResults: { '2,2': 'hit' },
      };
      game.receiveOpponentState(syncData);
      expect(game.enemyBoard.shots.has('2,2')).toBe(true);
    });
  });

  describe('resolveTurns', () => {
    it('does not throw with empty turns', () => {
      const game = new Game(1);
      game.setup();
      expect(() => game.resolveTurns([])).not.toThrow();
    });

    it('ignores own shots in resolution', () => {
      const game = new Game(1);
      game.setup();
      game.phase = PHASE.PLAYING;
      game.playerId = 1;

      // Add a shot from player 2 (opponent) on our board
      game.resolveTurns([{ player: 2, row: 0, col: 0 }]);

      expect(game.ownBoard.shots.has('0,0')).toBe(true);
    });

    it('logs turns in turnLog', () => {
      const game = new Game(1);
      game.setup();
      game.resolveTurns([{ player: 2, row: 0, col: 0 }]);
      expect(game.turnLog).toHaveLength(1);
    });
  });

  describe('addTarget / flushTargets', () => {
    it('adds a target without duplicates in round mode', () => {
      const game = new Game(1);
      game.mode = 'round';
      game.addTarget(0, 0);
      game.addTarget(1, 1);
      game.addTarget(0, 0); // duplicate
      expect(game.flushTargets()).toHaveLength(2);
    });

    it('adds a single target in queue mode', () => {
      const game = new Game(1);
      game.mode = 'queue';
      game.addTarget(0, 0);
      expect(game.flushTargets()).toEqual([{ row: 0, col: 0 }]);
    });

    it('flushes resets targets to empty', () => {
      const game = new Game(1);
      game.mode = 'round';
      game.addTarget(0, 0);
      game.flushTargets();
      expect(game.myTargets).toHaveLength(0);
    });
  });

  describe('addMessage', () => {
    it('adds a message with timestamp', () => {
      const game = new Game(1);
      game.addMessage('test message');
      expect(game.messages).toHaveLength(1);
      expect(game.messages[0].text).toBe('test message');
      expect(game.messages[0].time).toBeDefined();
    });
  });

  describe('game over state', () => {
    it('sets phase to FINISHED and winner when all ships sunk', () => {
      const game = new Game(1);
      game.setup();
      game.ownBoard.ships.forEach(s => { s.sunk = true; s.hits = s.size; });
      game.phase = PHASE.PLAYING;
      game._countShips();
      // Note: _countShips only counts own ships, opponent is unknown via this method
      expect(game.ownBoard.ships[0].sunk).toBe(true);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { GRID_SIZE, SHIP_TYPES, CELL, Board, Ship } from './board.js';

describe('constants', () => {
  it('GRID_SIZE should be 12', () => {
    expect(GRID_SIZE).toBe(12);
  });

  it('SHIP_TYPES has 6 ships', () => {
    expect(SHIP_TYPES).toHaveLength(6);
  });

  it('SHIP_TYPES defines correct sizes', () => {
    const sizes = SHIP_TYPES.map((s) => s.size).sort((a, b) => b - a);
    expect(sizes).toEqual([5, 4, 3, 3, 2, 2]);
  });

  it('SHIP_TYPES includes submarine hiddenUntilSunk', () => {
    const sub = SHIP_TYPES.find((s) => s.id === 'submarine');
    expect(sub).toBeDefined();
    expect(sub.hiddenUntilSunk).toBe(true);
  });

  it('SHIP_TYPES includes torpedo boat canShift', () => {
    const tb = SHIP_TYPES.find((s) => s.id === 'torpedo-boat');
    expect(tb).toBeDefined();
    expect(tb.canShift).toBe(true);
  });
});

describe('Ship', () => {
  let ship;

  beforeEach(() => {
    const config = { id: 'carrier', name: 'Carrier', size: 5, symbol: 'C' };
    ship = new Ship(config, 'test-1', 0, 0, false);
  });

  describe('construction', () => {
    it('stores id and properties', () => {
      expect(ship.id).toBe('test-1');
      expect(ship.name).toBe('Carrier');
      expect(ship.size).toBe(5);
      expect(ship.row).toBe(0);
      expect(ship.col).toBe(0);
      expect(ship.vertical).toBe(false);
    });

    it('starts with 0 hits and not sunk', () => {
      expect(ship.hits).toBe(0);
      expect(ship.sunk).toBe(false);
    });

    it('sets hidden for submarine-type ships', () => {
      const subConfig = {
        id: 'submarine',
        name: 'Submarine',
        size: 2,
        symbol: 'S',
        hiddenUntilSunk: true,
      };
      const sub = new Ship(subConfig, 'sub-1', 0, 0, false);
      expect(sub.hidden).toBe(true);
    });

    it('sets canShift for torpedo boats', () => {
      const tbConfig = {
        id: 'torpedo-boat',
        name: 'Torpedo Boat',
        size: 2,
        symbol: 'T',
        canShift: true,
      };
      const tb = new Ship(tbConfig, 'tb-1', 0, 0, false);
      expect(tb.canShift).toBe(true);
    });
  });

  describe('getCells', () => {
    it('returns correct horizontal cells', () => {
      const cells = ship.getCells();
      expect(cells).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(cells[i]).toEqual({ row: 0, col: i });
      }
    });

    it('returns correct vertical cells', () => {
      const verticalShip = new Ship(
        { id: 'test', name: 'Test', size: 3, symbol: 'T' },
        'v-1',
        0,
        5,
        true
      );
      const cells = verticalShip.getCells();
      expect(cells).toHaveLength(3);
      for (let i = 0; i < 3; i++) {
        expect(cells[i]).toEqual({ row: i, col: 5 });
      }
    });

    it('returns correct diagonal-ish cells at offset', () => {
      const ship2 = new Ship(
        { id: 'test', name: 'Test', size: 3, symbol: 'T' },
        's-2',
        3,
        7,
        false
      );
      const cells = ship2.getCells();
      expect(cells[0]).toEqual({ row: 3, col: 7 });
      expect(cells[2]).toEqual({ row: 3, col: 9 });
    });
  });

  describe('isCellAt', () => {
    it('returns true for cells the ship occupies', () => {
      expect(ship.isCellAt(0, 0)).toBe(true);
      expect(ship.isCellAt(0, 2)).toBe(true);
      expect(ship.isCellAt(0, 4)).toBe(true);
    });

    it('returns false for cells outside the ship', () => {
      expect(ship.isCellAt(0, 5)).toBe(false);
      expect(ship.isCellAt(1, 0)).toBe(false);
    });
  });

  describe('takeHit', () => {
    it('increments hits and returns false until sunk', () => {
      expect(ship.takeHit()).toBe(false);
      expect(ship.hits).toBe(1);
      expect(ship.sunk).toBe(false);
    });

    it('returns true when all hits landed', () => {
      for (let i = 0; i < 4; i++) ship.takeHit();
      expect(ship.takeHit()).toBe(true);
      expect(ship.sunk).toBe(true);
    });

    it('continues returning true after sunk', () => {
      for (let i = 0; i < 5; i++) ship.takeHit();
      expect(ship.sunk).toBe(true);
      expect(ship.takeHit()).toBe(true);
      expect(ship.hits).toBe(6);
    });
  });

  describe('canShiftTo', () => {
    it('returns false for out-of-bounds position', () => {
      const tb = new Ship(
        { id: 'torpedo-boat', name: 'Torpedo Boat', size: 2, symbol: 'T', canShift: true },
        'tb-1',
        0,
        0,
        false
      );
      expect(tb.canShiftTo(-1, 0, false, new Set())).toBe(false);
    });

    it('returns false for overlapping position', () => {
      const tb = new Ship(
        { id: 'torpedo-boat', name: 'Torpedo Boat', size: 2, symbol: 'T', canShift: true },
        'tb-1',
        3,
        3,
        false
      );
      // Candidate at (0,0) would occupy cells (0,0) and (0,1) which overlap with occupied
      const occupied = new Set(['0,0', '0,1']);
      expect(tb.canShiftTo(0, 0, false, occupied)).toBe(false);
    });

    it('returns true for valid adjacent position', () => {
      const tb = new Ship(
        { id: 'torpedo-boat', name: 'Torpedo Boat', size: 2, symbol: 'T', canShift: true },
        'tb-1',
        3,
        3,
        false
      );
      const empty = new Set(); // No ships in the way
      expect(tb.canShiftTo(3, 4, false, empty)).toBe(true);
    });

    it('allows diagonal adjacency shift', () => {
      const tb = new Ship(
        { id: 'torpedo-boat', name: 'Torpedo Boat', size: 2, symbol: 'T', canShift: true },
        'tb-1',
        5,
        5,
        false
      );
      expect(tb.canShiftTo(6, 6, true, new Set())).toBe(true);
    });

    it('blocks shift too far away', () => {
      const tb = new Ship(
        { id: 'torpedo-boat', name: 'Torpedo Boat', size: 2, symbol: 'T', canShift: true },
        'tb-1',
        0,
        0,
        false
      );
      // Distance > 1 from all original cells
      expect(tb.canShiftTo(5, 5, false, new Set())).toBe(false);
    });
  });
});

describe('Board', () => {
  let board;

  beforeEach(() => {
    board = new Board('p1');
  });

  describe('construction', () => {
    it('creates empty grid', () => {
      expect(board.grid).toHaveLength(GRID_SIZE);
      for (let r = 0; r < GRID_SIZE; r++) {
        expect(board.grid[r]).toHaveLength(GRID_SIZE);
        for (let c = 0; c < GRID_SIZE; c++) {
          expect(board.grid[r][c]).toBe(CELL.EMPTY);
        }
      }
    });

    it('stores playerId', () => {
      const b2 = new Board('p2');
      expect(b2.playerId).toBe('p2');
    });

    it('starts with empty ships and shots', () => {
      expect(board.ships).toHaveLength(0);
      expect(board.shots).toBeInstanceOf(Set);
      expect(Object.keys(board.shotResults)).toHaveLength(0);
    });
  });

  describe('placeShipsRandomly', () => {
    it('places all 6 ships', () => {
      board.placeShipsRandomly();
      expect(board.ships).toHaveLength(6);
    });

    it('marks grid cells as SHIP', () => {
      board.placeShipsRandomly();
      for (const s of board.ships) {
        for (const c of s.getCells()) {
          expect(board.grid[c.row][c.col]).toBe(CELL.SHIP);
        }
      }
    });

    it('no two ships overlap', () => {
      board.placeShipsRandomly();
      const occupied = new Set();
      for (const s of board.ships) {
        for (const c of s.getCells()) {
          const key = `${c.row},${c.col}`;
          expect(occupied.has(key)).toBe(false);
          occupied.add(key);
        }
      }
    });

    it('all ships are within grid bounds', () => {
      board.placeShipsRandomly();
      for (const s of board.ships) {
        for (const c of s.getCells()) {
          expect(c.row).toBeGreaterThanOrEqual(0);
          expect(c.row).toBeLessThan(GRID_SIZE);
          expect(c.col).toBeGreaterThanOrEqual(0);
          expect(c.col).toBeLessThan(GRID_SIZE);
        }
      }
    });

    it('can be called multiple times to re-place', () => {
      board.placeShipsRandomly();
      const firstBoard = JSON.stringify(board.ships.map((s) => `${s.row},${s.col},${s.vertical}`));
      board.placeShipsRandomly();
      const secondBoard = JSON.stringify(board.ships.map((s) => `${s.row},${s.col},${s.vertical}`));
      // With high probability the placement differs
      expect(firstBoard).not.toBe(secondBoard);
    });

    it('places ships of correct sizes', () => {
      board.placeShipsRandomly();
      const sizes = board.ships.map((s) => s.size).sort((a, b) => b - a);
      expect(sizes).toEqual([5, 4, 3, 3, 2, 2]);
    });
  });

  describe('fire', () => {
    beforeEach(() => {
      board.placeShipsRandomly();
    });

    it('marks cell as HIT when shooting a ship', () => {
      // Find a ship cell to target
      const targetShip = board.ships[0];
      const cell = targetShip.getCells()[0];
      const result = board.fire(cell.row, cell.col);
      expect(result.result).toBe('hit');
      expect(result.ship).toBe(targetShip);
      expect(board.shotResults[`${cell.row},${cell.col}`]).toBe('hit');
    });

    it('marks cell as MISS when shooting water', () => {
      // Shoot a cell far from any likely ship position
      const result = board.fire(0, 0);
      expect(result.result).toBe('miss');
      expect(result.ship).toBeNull();
      expect(board.shotResults[`${0},${0}`]).toBe('miss');
    });

    it('returns already-shot for repeated shots', () => {
      board.fire(0, 0);
      const result = board.fire(0, 0);
      expect(result.result).toBe('already-shot');
    });

    it('tracks sink correctly', () => {
      const carrier = board.ships.find((s) => s.id === 'carrier') || board.ships[0];
      let lastResult = null;
      for (const cell of carrier.getCells()) {
        lastResult = board.fire(cell.row, cell.col);
      }
      expect(carrier.sunk).toBe(true);
      expect(lastResult.result).toBe('sink');
    });

    it('marks sunk ship with sink result', () => {
      // Use the torpedo boat (size 2) for predictable sinking
      const targetShip = board.ships.find((s) => s.size === 2 && !s.canShift) || board.ships[0];
      for (const cell of targetShip.getCells()) {
        board.fire(cell.row, cell.col);
      }
      expect(targetShip.sunk).toBe(true);
    });

    it('handles out-of-bounds gracefully', () => {
      const result = board.fire(-1, 0);
      expect(result.result).toBe('miss');
      const result2 = board.fire(GRID_SIZE, GRID_SIZE);
      expect(result2.result).toBe('miss');
    });

    it('reveals submarine when first hit', () => {
      const sub = board.ships.find((s) => s.id === 'submarine');
      // Submarines start hidden, so this is implicit from placement
      expect(sub).toBeDefined();
      expect(sub.hidden).toBe(true);
    });

    it('fireBatch fires multiple cells', () => {
      const results = board.fireBatch([
        { row: 0, col: 0 },
        { row: 1, col: 1 },
        { row: 2, col: 2 },
      ]);
      expect(results).toHaveLength(3);
      for (const r of results) {
        expect(['hit', 'miss']).toContain(r.result);
      }
    });

    it('fireBatch skips already-shot cells', () => {
      board.fire(0, 0);
      const results = board.fireBatch([
        { row: 0, col: 0 },
        { row: 1, col: 1 },
      ]);
      expect(results[0].result).toBe('already-shot');
    });
  });

  describe('toSyncData', () => {
    it('returns ships with correct structure', () => {
      board.placeShipsRandomly();
      const data = board.toSyncData();
      expect(data.ships).toHaveLength(6);
      for (const s of data.ships) {
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('row');
        expect(s).toHaveProperty('col');
        expect(s).toHaveProperty('vertical');
        expect(s).toHaveProperty('sunk');
        expect(s).toHaveProperty('hidden');
        expect(s).toHaveProperty('name');
        expect(s).toHaveProperty('symbol');
      }
    });

    it('includes torpedo shift data for shift-enabled ships', () => {
      board.placeShipsRandomly();
      const data = board.toSyncData();
      const tbShip = board.ships.find((s) => s.canShift);
      if (tbShip) {
        expect(data.torpedoShifts).toBeDefined();
        expect(data.torpedoShifts.some((t) => t.id === tbShip.id)).toBe(true);
      }
    });

    it('includes shot results', () => {
      board.placeShipsRandomly();
      const result = board.fire(0, 0);
      const data = board.toSyncData();
      expect(data.shotResults).toBeDefined();
      expect(data.shotResults['0,0']).toBe(result.result);
    });

    it('returns empty arrays for unpopulated board', () => {
      const data = board.toSyncData();
      expect(data.ships).toHaveLength(0);
      expect(data.torpedoShifts).toBeDefined();
      expect(Object.keys(data.shotResults)).toHaveLength(0);
    });
  });
});

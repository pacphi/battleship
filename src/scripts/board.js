export const GRID_SIZE = 12;
export const SHIP_TYPES = [
  { id: 'carrier',   name: 'Carrier',   size: 5, symbol: 'C' },
  { id: 'battleship', name: 'Battleship', size: 4, symbol: 'B' },
  { id: 'heavy-cruiser', name: 'Heavy Cruiser', size: 3, symbol: 'H' },
  { id: 'light-cruiser', name: 'Light Cruiser', size: 3, symbol: 'L' },
  { id: 'submarine',   name: 'Submarine', size: 2, symbol: 'S', hiddenUntilSunk: true },
  { id: 'torpedo-boat', name: 'Torpedo Boat', size: 2, symbol: 'T', canShift: true },
];

export const CELL = { EMPTY: 0, SHIP: 1, HIT: 2, MISS: 3 };

export class Ship {
  constructor(config, id, row, col, vertical) {
    this.id = id;
    this.name = config.name;
    this.symbol = config.symbol;
    this.size = config.size;
    this.row = row;
    this.col = col;
    this.vertical = vertical;
    this.hits = 0;
    this.sunk = false;
    this.hidden = !!config.hiddenUntilSunk;
    this.canShift = !!config.canShift;
  }

  getCells() {
    const cells = [];
    for (let i = 0; i < this.size; i++) {
      cells.push({
        row: this.vertical ? this.row + i : this.row,
        col: this.vertical ? this.col : this.col + i,
      });
    }
    return cells;
  }

  isCellAt(row, col) {
    const cells = this.getCells();
    return cells.some((c) => c.row === row && c.col === col);
  }

  takeHit() {
    this.hits++;
    const didSink = this.hits >= this.size;
    if (didSink) this.sunk = true;
    return didSink;
  }

  canShiftTo(newRow, newCol, newVertical, occupied) {
    const candidate = new Ship({ name: 'torpedo', size: 2, symbol: 'T', canShift: true }, -1, newRow, newCol, newVertical);
    const cells = candidate.getCells();
    if (cells.some((c) => c.row < 0 || c.row >= GRID_SIZE || c.col < 0 || c.col >= GRID_SIZE)) return false;
    for (const c of cells) {
      if (occupied.has(`${c.row},${c.col}`)) return false;
    }
    const origCells = this.getCells();
    for (const orig of origCells) {
      for (const cand of cells) {
        if (Math.abs(orig.row - cand.row) <= 1 && Math.abs(orig.col - cand.col) <= 1) return true;
      }
    }
    return false;
  }
}

export class Board {
  constructor(playerId) {
    this.playerId = playerId;
    this.grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(CELL.EMPTY));
    this.ships = [];
    this.shots = new Set();
    this.shotResults = {};
  }

  placeShipsRandomly() {
    const placed = [];
    for (const type of SHIP_TYPES) {
      let ship = null;
      let attempts = 0;
      while (!ship && attempts < 1000) {
        const vertical = Math.random() < 0.5;
        const row = Math.floor(Math.random() * (vertical ? GRID_SIZE - type.size + 1 : GRID_SIZE));
        const col = Math.floor(Math.random() * (vertical ? GRID_SIZE : GRID_SIZE - type.size + 1));
        const candidate = new Ship(type, type.id, row, col, vertical);
        const cells = candidate.getCells();
        const overlap = cells.some((c) => this.grid[c.row][c.col] === CELL.SHIP);
        if (!overlap) {
          ship = candidate;
          for (const c of cells) {
            this.grid[c.row][c.col] = CELL.SHIP;
          }
          placed.push(ship);
        }
        attempts++;
      }
      if (!ship) throw new Error(`Failed to place ${type.name}`);
    }
    this.ships = placed;
  }

  fire(row, col) {
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
      return { result: 'miss', ship: null, row, col };
    }

    const key = `${row},${col}`;
    if (this.shots.has(key)) return { result: 'already-shot', row, col };

    this.shots.add(key);
    const ship = this.ships.find((s) => s.isCellAt(row, col));

    if (ship) {
      const sunk = ship.takeHit();
      const result = sunk ? 'sink' : 'hit';
      this.grid[row][col] = CELL.HIT;
      this.shotResults[key] = result;
      if (ship.hidden && sunk) ship.hidden = false;
      return { result, ship, row, col };
    }

    this.grid[row][col] = CELL.MISS;
    this.shotResults[key] = 'miss';
    return { result: 'miss', ship: null, row, col };
  }

  fireBatch(rowsCols) {
    return rowsCols.map(({ row, col }) => this.fire(row, col));
  }

  toSyncData() {
    return {
      ships: this.ships.map((s) => ({
        id: s.id,
        row: s.row,
        col: s.col,
        vertical: s.vertical,
        sunk: s.sunk,
        hidden: s.hidden,
        name: s.name,
        symbol: s.symbol,
        size: s.size,
        hits: s.hits,
      })),
      shotResults: this.shotResults,
      torpedoShifts: this.ships
        .filter((s) => s.canShift)
        .map((s) => ({ id: s.id, row: s.row, col: s.col, vertical: s.vertical })),
    };
  }
}

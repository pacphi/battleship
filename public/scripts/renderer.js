import { GRID_SIZE } from './board.js';

// Phosphor CRT palette — green-on-black with amber alert accent.
const COLORS = {
  bg: '#020a05',
  board: '#062611',
  ship: '#0a6e35',
  shipOutline: '#2bff88',
  hit: '#ffb000', // amber hit marker — contrasts the green field
  miss: '#16c85f',
  water: '#041a0c',
  waterAlt: '#062611',
  text: '#2bff88',
  accent: '#2bff88',
  timer: '#ffb000',
  grid: 'rgba(43,255,136,0.14)',
  hover: 'rgba(43,255,136,0.2)',
  shipLabel: '#001a0a',
};

// === Blocky ship sprites ===
// Each ship is drawn as a pixel sprite on an 8-row grid, SHIP_UNIT pixels per
// cell along its length. Bow points toward +x (the cell-order direction). Grid
// values: 1 = hull, 2 = superstructure (brighter). Vertical ships rotate 90°.
const SHIP_UNIT = 8;

function makeGrid(gw) {
  return Array.from({ length: SHIP_UNIT }, () => new Array(gw).fill(0));
}

function fillRect(g, x, y, w, h, v) {
  for (let r = y; r < y + h; r++) {
    if (r < 0 || r >= g.length) continue;
    for (let c = x; c < x + w; c++) {
      if (c < 0 || c >= g[0].length) continue;
      g[r][c] = v;
    }
  }
}

// Build the sprite grid for a ship type at a given length (in cells).
function buildShipGrid(id, sizeCells) {
  const gw = sizeCells * SHIP_UNIT;
  const g = makeGrid(gw);
  const mid = Math.floor(gw / 2);

  switch (id) {
    case 'carrier': {
      // Long, flat-topped flight deck with a small offset island.
      fillRect(g, 0, 4, gw, 3, 1); // hull
      fillRect(g, 1, 2, gw - 2, 2, 1); // full-length flight deck
      fillRect(g, 1, 2, gw - 2, 1, 2); // bright deck surface
      fillRect(g, mid + 3, 0, 5, 2, 2); // island tower
      g[2][gw - 2] = 0; // raked deck front
      g[4][gw - 1] = 0; // bow
      break;
    }
    case 'battleship': {
      // Bulky hull bristling with turrets and a tall central bridge.
      fillRect(g, 0, 4, gw, 3, 1); // hull
      fillRect(g, 2, 2, 4, 2, 2); // fore turret
      fillRect(g, gw - 6, 2, 4, 2, 2); // aft turret
      fillRect(g, mid - 3, 0, 6, 4, 2); // tall central bridge
      fillRect(g, mid + 5, 1, 2, 3, 1); // funnel
      g[4][gw - 1] = 0; // bow rake
      g[4][0] = 0; // stern
      break;
    }
    case 'heavy-cruiser': {
      // Medium warship: central bridge flanked by two turrets.
      fillRect(g, 0, 4, gw, 3, 1); // hull
      fillRect(g, mid - 2, 1, 5, 3, 2); // bridge
      fillRect(g, 2, 3, 3, 1, 2); // fore turret
      fillRect(g, gw - 5, 3, 3, 1, 2); // aft turret
      g[4][gw - 1] = 0; // bow
      break;
    }
    case 'light-cruiser': {
      // Slimmer, lower hull with a single slender tower.
      fillRect(g, 0, 5, gw, 2, 1); // low slim hull
      fillRect(g, mid - 1, 2, 3, 4, 2); // slender tower
      fillRect(g, 3, 4, 2, 1, 2); // single turret
      g[5][gw - 1] = 0; // bow
      break;
    }
    case 'submarine': {
      // Low cylindrical hull with a conning tower and periscope.
      fillRect(g, 1, 5, gw - 2, 2, 1); // hull
      g[5][1] = 0; // rounded ends
      g[5][gw - 2] = 0;
      fillRect(g, mid - 1, 3, 3, 2, 2); // conning tower
      g[2][mid] = 2; // periscope
      break;
    }
    case 'torpedo-boat': {
      // Small, sleek fast boat with a tiny cockpit and mast.
      fillRect(g, 1, 5, gw - 2, 2, 1); // small hull
      fillRect(g, 3, 3, 3, 2, 2); // cockpit
      g[2][4] = 2; // mast
      g[5][gw - 2] = 0; // pointed bow
      g[6][gw - 2] = 0;
      break;
    }
    default:
      fillRect(g, 0, 4, gw, 3, 1);
  }
  return { g, gw };
}

export class Renderer {
  constructor(canvas, config = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cellSize = config.cellSize || 40;
    this.offsetX = config.offsetX || 0;
    this.offsetY = config.offsetY || 0;
    this.showShips = config.showShips !== false;
    this.hoverCell = null;
    this.animFrame = 0;
    this.hitEffects = [];
    this.missEffects = [];
  }

  setSize() {
    this.canvas.width = GRID_SIZE * this.cellSize;
    this.canvas.height = GRID_SIZE * this.cellSize;
  }

  render(board, label) {
    const ctx = this.ctx;
    const cs = this.cellSize;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (label) {
      ctx.fillStyle = COLORS.text;
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, this.canvas.width / 2, 25);
    }

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        this._drawCell(row, col, board);
      }
    }

    if (this.showShips) {
      this._drawShips(board);
    }

    if (this.hoverCell) {
      const { row, col } = this.hoverCell;
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        ctx.fillStyle = COLORS.hover;
        ctx.fillRect(col * cs, row * cs + 30, cs, cs);
      }
    }

    this._drawEffects();
  }

  _drawCell(row, col, board) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const x = col * cs;
    const y = row * cs + 30;

    const gradient = ctx.createLinearGradient(x, y, x + cs, y + cs);
    gradient.addColorStop(0, COLORS.water);
    gradient.addColorStop(1, COLORS.waterAlt);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, cs, cs);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, cs, cs);

    const shotResult = board.shotResults[`${row},${col}`];

    if (shotResult) {
      if (shotResult === 'hit') {
        this._drawHit(x, y, cs);
      } else if (shotResult === 'miss') {
        this._drawMiss(x, y, cs);
      } else if (shotResult === 'sink') {
        this._drawHit(x, y, cs);
        this.hitEffects.push({ x, y, cs, t: Date.now(), type: 'sink' });
      }
    }
  }

  _drawShips(board) {
    for (const ship of board.ships) {
      if (ship.sunk && ship.hidden) continue;
      this._drawShipSprite(ship, board);
    }
  }

  _drawShipSprite(ship, board) {
    const ctx = this.ctx;
    const cs = this.cellSize;
    const px = cs / SHIP_UNIT;
    const { g, gw } = buildShipGrid(ship.id, ship.size);
    const x0 = ship.col * cs;
    const y0 = ship.row * cs + 30;

    const sunk = ship.sunk;
    const hullColor = sunk ? 'rgba(10,110,53,0.4)' : COLORS.ship;
    const superColor = sunk ? 'rgba(43,255,136,0.4)' : COLORS.accent;
    const edgeColor = sunk ? 'rgba(43,255,136,0.35)' : COLORS.shipOutline;

    // Map a sprite cell to its top-left screen pixel (rotate 90° if vertical).
    const screenX = (gx, gy) => (ship.vertical ? x0 + gy * px : x0 + gx * px);
    const screenY = (gx, gy) => (ship.vertical ? y0 + gx * px : y0 + gy * px);

    // Pass 1: a 1px-larger edge-colour pad behind each pixel. Interior pads are
    // covered by neighbours, leaving a crisp bright outline around the hull.
    ctx.fillStyle = edgeColor;
    for (let gy = 0; gy < g.length; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        if (!g[gy][gx]) continue;
        ctx.fillRect(screenX(gx, gy) - 1, screenY(gx, gy) - 1, px + 2, px + 2);
      }
    }

    // Pass 2: the hull / superstructure fills.
    for (let gy = 0; gy < g.length; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const v = g[gy][gx];
        if (!v) continue;
        ctx.fillStyle = v === 2 ? superColor : hullColor;
        ctx.fillRect(screenX(gx, gy), screenY(gx, gy), px + 0.4, px + 0.4);
      }
    }

    // Overlay damage markers so hits on your own ships stay visible.
    for (const c of ship.getCells()) {
      const res = board.shotResults[`${c.row},${c.col}`];
      if (res === 'hit' || res === 'sink') {
        this._drawHit(c.col * cs, c.row * cs + 30, cs);
      }
    }
  }

  _drawHit(x, y, cs) {
    const ctx = this.ctx;
    ctx.strokeStyle = COLORS.hit;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + cs * 0.2, y + cs * 0.2);
    ctx.lineTo(x + cs * 0.8, y + cs * 0.8);
    ctx.moveTo(x + cs * 0.8, y + cs * 0.2);
    ctx.lineTo(x + cs * 0.2, y + cs * 0.8);
    ctx.stroke();

    const now = Date.now();
    const glow = Math.sin(((now % 1000) / 1000) * Math.PI) * 0.3;
    ctx.fillStyle = `rgba(255,176,0,${glow})`;
    ctx.fillRect(x, y, cs, cs);
  }

  _drawMiss(x, y, cs) {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.miss;
    ctx.beginPath();
    ctx.arc(x + cs / 2, y + cs / 2, cs * 0.15, 0, Math.PI * 2);
    ctx.fill();

    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const r = cs * (0.2 + i * 0.15) + Math.sin((now % 2000) / 1000 + i) * 3;
      ctx.strokeStyle = `rgba(43,255,136,${0.3 - i * 0.08})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + cs / 2, y + cs / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawEffects() {
    const now = Date.now();
    this.hitEffects = this.hitEffects.filter((e) => {
      const age = now - e.t;
      if (age > 2000) return false;

      const alpha = 1 - age / 2000;
      const ctx = this.ctx;

      if (e.type === 'sink') {
        const r = e.cs * (0.5 + (age / 2000) * 2);
        ctx.strokeStyle = `rgba(255,176,0,${alpha * 0.5})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x + e.cs / 2, e.y + e.cs / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      return true;
    });
  }

  getCellFromMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cs = this.cellSize;
    const col = Math.floor(x / cs);
    const row = Math.floor((y - 30) / cs);
    return { row, col };
  }
}

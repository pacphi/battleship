import { GRID_SIZE } from './board.js';

const COLORS = {
  bg: '#0a1628',
  board: '#1a3a5c',
  ship: '#2c5f8a',
  shipOutline: '#1a3a5c',
  hit: '#e74c3c',
  miss: '#ecf0f1',
  water: '#0d2137',
  waterAlt: '#1a3a5c',
  text: '#ecf0f1',
  accent: '#3498db',
  timer: '#f39c12',
  grid: 'rgba(255,255,255,0.08)',
  hover: 'rgba(52,152,219,0.3)',
  shipLabel: '#ffffff',
};

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
    const ctx = this.ctx;
    const cs = this.cellSize;

    for (const ship of board.ships) {
      if (ship.sunk && ship.hidden) continue;

      const cells = ship.getCells();
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const x = c.col * cs;
        const y = c.row * cs + 30;

        ctx.fillStyle = ship.sunk ? 'rgba(44,95,138,0.4)' : COLORS.ship;
        ctx.fillRect(x + 1, y + 1, cs - 2, cs - 2);

        ctx.strokeStyle = COLORS.shipOutline;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);

        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        for (let d = -cs; d < cs * 2; d += 8) {
          ctx.beginPath();
          ctx.moveTo(x + d, y + 1);
          ctx.lineTo(x + d + cs, y + cs - 1);
          ctx.stroke();
        }

        if (i === 0) {
          ctx.fillStyle = COLORS.shipLabel;
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const labelX = x + cs / 2;
          const labelY = y + cs / 2;
          ctx.fillText(ship.symbol, labelX, labelY);
        }
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
    ctx.fillStyle = `rgba(231,76,60,${glow})`;
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
      ctx.strokeStyle = `rgba(236,240,241,${0.3 - i * 0.08})`;
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
        ctx.strokeStyle = `rgba(231,76,60,${alpha * 0.5})`;
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

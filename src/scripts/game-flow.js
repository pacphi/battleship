import { GRID_SIZE } from './board.js';

export class GameFlow {
  constructor(game, webrtc) {
    this.game = game;
    this.webrtc = webrtc;
    this.timer = null;
    this.idleTimer = null;
    this.pendingOpponentTargets = [];
    this.hybridGraceActive = false;
    this.hybridGraceTimer = null;
  }

  start(mode) {
    this.game.mode = mode;
    this.pendingOpponentTargets = [];

    switch (mode) {
      case 'round':
        this._startRoundMode();
        break;
      case 'queue':
        this._startQueueMode();
        break;
      case 'hybrid':
        this._startHybridMode();
        break;
    }
  }

  // --- Round-Based Mode ---
  _startRoundMode() {
    this._nextRoundTimer(3000);
  }

  _nextRoundTimer(duration) {
    this.game.lastActivity = Date.now();
    let remaining = duration;

    this.timer = setInterval(() => {
      remaining -= 100;
      const timerEl = document.getElementById('timer');
      if (timerEl) {
        const secs = Math.ceil(remaining / 1000);
        timerEl.textContent = `⏱ ${secs}s`;
        if (secs <= 2) {
          timerEl.classList.add('urgent');
        } else {
          timerEl.classList.remove('urgent');
        }
      }

      if (remaining <= 0) {
        clearInterval(this.timer);
        this.timer = null;
        this._resolveRound();
      }
    }, 100);
  }

  _resolveRound() {
    // Flush all targets
    const myTargets = this.game.flushTargets();
    if (myTargets.length === 0) {
      // Auto-fire first unshot cell
      const auto = this._findFirstUnshot();
      if (auto) myTargets.push(auto);
    }

    // Collect opponent pending targets
    const allTargets = [
      ...myTargets.map((t) => ({ ...t, player: this.game.playerId })),
      ...this.pendingOpponentTargets.map((t) => ({
        row: t.row,
        col: t.col,
        player: this.game.playerId === 1 ? 2 : 1,
      })),
    ];

    // Reset opponent queue
    this.pendingOpponentTargets = [];

    // Broadcast resolution
    this.webrtc.send({
      type: 'resolution',
      turns: allTargets,
      mode: this.game.mode,
    });

    // Start next round
    this._nextRoundTimer(3000);
  }

  // --- Queue-Based Mode ---
  _startQueueMode() {
    this._startIdleTimer();
  }

  _startIdleTimer() {
    this.game.lastActivity = Date.now();
    this.idleTimer = setTimeout(() => {
      // Auto-target after idle
      const auto = this._findFirstUnshot();
      if (auto) {
        this.submitTarget(auto.row, auto.col);
      }
    }, 15000);
  }

  _checkQueue() {
    if (this.pendingOpponentTargets.length > 0) {
      clearTimeout(this.idleTimer);
      const myTargets = this.game.flushTargets();
      const allTargets = [
        ...myTargets.map((t) => ({ ...t, player: this.game.playerId })),
        ...this.pendingOpponentTargets.map((t) => ({
          row: t.row,
          col: t.col,
          player: this.game.playerId === 1 ? 2 : 1,
        })),
      ];
      this.pendingOpponentTargets = [];

      this.webrtc.send({
        type: 'resolution',
        turns: allTargets,
        mode: this.game.mode,
      });
      this._startIdleTimer();
    }
  }

  // --- Hybrid Mode ---
  _startHybridMode() {
    this._nextRoundTimer(3000);
    this.hybridGraceActive = false;
    this.hybridGraceTimer = null;
  }

  _handleHybridTimeout() {
    // Grace period started
    this.hybridGraceActive = true;
    let graceRemaining = 5000;

    this.hybridGraceTimer = setInterval(() => {
      graceRemaining -= 100;
      const timerEl = document.getElementById('timer');
      if (timerEl) {
        timerEl.textContent = `⏱ Grace: ${Math.ceil(graceRemaining / 1000)}s`;
        if (graceRemaining <= 2000) {
          timerEl.classList.add('urgent');
        } else {
          timerEl.classList.remove('urgent');
        }
      }

      if (graceRemaining <= 0) {
        clearInterval(this.hybridGraceTimer);
        this.hybridGraceTimer = null;
        this.hybridGraceActive = false;
        this._resolveRound();
      }
    }, 100);
  }

  // --- Shared helpers ---

  receiveOpponentTarget(row, col) {
    this.pendingOpponentTargets.push({ row, col });

    if (this.game.mode === 'queue') {
      this._checkQueue();
    } else if (this.game.mode === 'hybrid' && !this.hybridGraceActive) {
      // Check if opponent fired before timer
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
        this._handleHybridTimeout();
      }
    }
  }

  submitTarget(row, col) {
    clearTimeout(this.idleTimer);
    this.game.lastActivity = Date.now();
    this.game.addTarget(row, col);

    // Send to opponent
    this.webrtc.send({ type: 'target', row, col });
  }

  _findFirstUnshot() {
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!this.game.enemyBoard.shots.has(`${row},${col}`)) {
          return { row, col };
        }
      }
    }
    return null;
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.hybridGraceTimer) clearInterval(this.hybridGraceTimer);
  }
}

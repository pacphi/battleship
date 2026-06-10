/**
 * webrtc-cog.js
 *
 * Drop-in replacement for the WebSocket-based signaling in webrtc.js.
 * Uses HTTP fetch + long-polling against the cog-battleship signal API
 * instead of a WebSocket connection.
 *
 * The bearer token is read once from:
 *   1. window.COG_TOKEN  (set by the page / inline script), or
 *   2. <meta name="cog-token" content="..."> in the document head.
 *
 * All paired endpoints require "Authorization: Bearer <token>".
 */

// ---------------------------------------------------------------------------
// Token resolution
// ---------------------------------------------------------------------------

function getCogToken() {
  if (typeof window !== 'undefined' && window.COG_TOKEN) {
    return window.COG_TOKEN;
  }
  const meta = document.querySelector('meta[name="cog-token"]');
  return meta ? meta.getAttribute('content') : '';
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getCogToken()}`,
  };
}

// ---------------------------------------------------------------------------
// Low-level signal API wrappers
// ---------------------------------------------------------------------------

/**
 * Create a new signaling room.
 * @returns {Promise<string>} The 6-char room code.
 */
export async function createRoom() {
  const res = await fetch('/signal/create', {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`createRoom failed: ${res.status}`);
  const { code } = await res.json();
  return code;
}

/**
 * Join an existing signaling room.
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function joinRoom(code) {
  const res = await fetch(`/signal/${code}/join`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`joinRoom failed: ${res.status}`);
}

/**
 * Push a message into a room.
 * @param {string} code
 * @param {*} msg  Any JSON-serialisable value.
 * @returns {Promise<void>}
 */
export async function pushMessage(code, msg) {
  const res = await fetch(`/signal/${code}/push`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(msg),
  });
  if (!res.ok) throw new Error(`pushMessage failed: ${res.status}`);
}

/**
 * Poll for new messages starting at `seq`.
 * @param {string} code
 * @param {number} seq  Sequence number to start from (inclusive).
 * @returns {Promise<{messages: Array<{seq:number, payload:*}>, seq:number}>}
 */
export async function pollMessages(code, seq) {
  const res = await fetch(`/signal/${code}/poll?seq=${seq}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  if (res.status === 204) return { messages: [], seq };
  if (!res.ok) throw new Error(`pollMessages failed: ${res.status}`);
  return res.json(); // { messages: [...], seq: <next> }
}

/**
 * Leave (and close) a signaling room.
 * @param {string} code
 * @returns {Promise<void>}
 */
export async function leaveRoom(code) {
  const res = await fetch(`/signal/${code}/leave`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`leaveRoom failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// CogSignalingManager — drop-in replacement for WebRTCManager's signaling
// ---------------------------------------------------------------------------

/**
 * Replaces the WebSocket-based signaling channel used by WebRTCManager.
 *
 * Usage:
 *   const mgr = new CogSignalingManager();
 *   mgr.onMessage = (msg) => { ... };          // replaces ws.onmessage
 *   mgr.onStateChange = (state, data) => { ... };
 *
 *   // Host
 *   await mgr.createGame();
 *
 *   // Guest
 *   await mgr.joinGame(code);
 *
 *   // Send a signaling message
 *   mgr.send(payload);
 */
export class CogSignalingManager {
  constructor() {
    /** @type {string|null} */
    this.roomCode = null;
    /** @type {number} */
    this._nextSeq = 0;
    /** @type {boolean} */
    this._polling = false;
    /** @type {AbortController|null} */
    this._pollAbort = null;

    /** Callback: receives each decoded message payload. */
    this.onMessage = null;
    /** Callback: (state: string, data?: any) => void */
    this.onStateChange = null;
  }

  // ---- Public API (mirrors WebRTCManager) ---------------------------------

  async createGame() {
    this.roomCode = await createRoom();
    this._emit('waiting', this.roomCode);
    this._startPolling();
  }

  async joinGame(code) {
    this.roomCode = code;
    try {
      await joinRoom(code);
    } catch {
      this._emit('disconnected');
      return;
    }
    this._emit('signaling');
    this._startPolling();
  }

  /** Send a signaling message to the room. */
  send(payload) {
    if (!this.roomCode) return;
    pushMessage(this.roomCode, payload).catch((err) => {
      console.warn('cog-signal: pushMessage error', err);
    });
  }

  /** Tear down the polling loop and leave the room. */
  destroy() {
    this._stopPolling();
    if (this.roomCode) {
      leaveRoom(this.roomCode).catch(() => {});
      this.roomCode = null;
    }
  }

  // ---- Internal -----------------------------------------------------------

  _emit(state, data) {
    if (this.onStateChange) this.onStateChange(state, data);
  }

  _startPolling() {
    if (this._polling) return;
    this._polling = true;
    this._pollAbort = new AbortController();
    this._pollLoop();
  }

  _stopPolling() {
    this._polling = false;
    if (this._pollAbort) {
      this._pollAbort.abort();
      this._pollAbort = null;
    }
  }

  async _pollLoop() {
    while (this._polling && this.roomCode) {
      try {
        const { messages, seq } = await pollMessages(this.roomCode, this._nextSeq);
        if (seq > this._nextSeq) this._nextSeq = seq;
        for (const { payload } of messages) {
          if (this.onMessage) this.onMessage(payload);
        }
      } catch (err) {
        if (!this._polling) break; // intentional teardown
        console.warn('cog-signal: poll error, retrying in 1 s', err);
        await _sleep(1000);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

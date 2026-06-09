import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';

const PORT = 3001;
const CODE_LENGTH = 6;
const STALE_TIMEOUT = 60_000;

// All active rooms: Map<code, { hostWs, guestWs, lastActivity }>
const rooms = new Map();

function generateCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code;
  do {
    code = randomBytes(CODE_LENGTH).toString('hex').slice(0, CODE_LENGTH);
  } while (rooms.has(code));
  return code;
}

const wss = new WebSocketServer({ port: PORT });

console.log(`Signaling server running on ws://localhost:${PORT}`);

// Cleanup stale rooms periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > STALE_TIMEOUT) {
      room.hostWs?.close(1001, 'Room stale');
      room.guestWs?.close(1001, 'Room stale');
      rooms.delete(code);
    }
  }
}, 30_000);

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    switch (msg.type) {
      case 'create-game': {
        const code = generateCode();
        const room = { hostWs: ws, guestWs: null, lastActivity: Date.now() };
        rooms.set(code, room);

        room.joinTimeout = setTimeout(() => {
          if (!room.guestWs) {
            room.hostWs.send(JSON.stringify({
              type: 'game-expired',
              code,
            }));
            rooms.delete(code);
          }
        }, 30_000);

        ws.send(JSON.stringify({
          type: 'game-created',
          code,
          role: 'host',
        }));
        break;
      }

      case 'join-game': {
        const code = msg.code?.toLowerCase().trim();
        const room = rooms.get(code);
        if (!room) {
          ws.send(JSON.stringify({ type: 'join-failed', reason: 'invalid-code' }));
          return;
        }
        if (room.guestWs) {
          ws.send(JSON.stringify({ type: 'join-failed', reason: 'already-joined' }));
          return;
        }

        clearTimeout(room.joinTimeout);
        room.guestWs = ws;
        room.lastActivity = Date.now();

        room.hostWs.send(JSON.stringify({
          type: 'guest-joined',
          code,
        }));

        ws.send(JSON.stringify({
          type: 'game-joined',
          role: 'guest',
          code,
        }));
        break;
      }

      case 'relay': {
        const code = msg.code;
        const room = rooms.get(code);
        if (!room) return;

        const target = msg.to === 'host' ? room.hostWs : room.guestWs;
        if (target && target.readyState === target.OPEN) {
          target.send(data.toString());
        }
        break;
      }

      default:
        break;
    }
  });

  ws.on('close', () => {
    for (const [code, room] of rooms) {
      if (room.hostWs === ws || room.guestWs === ws) {
        const other = room.hostWs === ws ? room.guestWs : room.hostWs;
        if (other && other.readyState === other.OPEN) {
          other.send(JSON.stringify({ type: 'opponent-disconnected' }));
        }
        clearTimeout(room.joinTimeout);
        rooms.delete(code);
      }
    }
  });
});

wss.on('listening', () => {
  console.log(`Active rooms endpoint: ws://localhost:${PORT} (send {"type":"list-rooms"})`);
});

process.on('SIGINT', () => {
  console.log('Shutting down signaling server...');
  for (const [, room] of rooms) {
    room.hostWs?.close();
    room.guestWs?.close();
  }
  rooms.clear();
  wss.close();
  process.exit(0);
});

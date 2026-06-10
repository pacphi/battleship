import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { extname, join, normalize, resolve } from 'path';
import { createServer } from 'http';

const PORT = Number(process.env.PORT || 4321);
const DIST_DIR = resolve(process.env.DIST_DIR || 'dist');
const CODE_LENGTH = 6;
const HEARTBEAT_INTERVAL = 30_000;
const SIGNALING_PATH = '/signaling';

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

// All active rooms: Map<code, { hostWs, guestWs, lastActivity }>
const rooms = new Map();

function generateCode() {
  let code;
  do {
    code = randomBytes(CODE_LENGTH).toString('hex').slice(0, CODE_LENGTH);
  } while (rooms.has(code));
  return code;
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function resolveStaticPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const relativePath = normalize(decodedPath)
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^[/\\]/, '');
  const candidate = resolve(DIST_DIR, relativePath || 'index.html');

  if (candidate !== DIST_DIR && !candidate.startsWith(`${DIST_DIR}/`)) {
    return null;
  }

  if (existsSync(candidate)) {
    return candidate;
  }

  const indexCandidate = join(candidate, 'index.html');
  if (existsSync(indexCandidate)) {
    return indexCandidate;
  }

  return join(DIST_DIR, 'index.html');
}

const server = createServer((req, res) => {
  if (!existsSync(DIST_DIR)) {
    sendText(res, 503, 'dist/ not found. Run `pnpm build` before starting the tunnel server.\n');
    return;
  }

  if (req.url === '/healthz') {
    sendText(res, 200, 'ok\n');
    return;
  }

  const filePath = resolveStaticPath(req.url || '/');
  if (!filePath || !existsSync(filePath)) {
    sendText(res, 404, 'not found\n');
    return;
  }

  const contentType = CONTENT_TYPES.get(extname(filePath)) || 'application/octet-stream';
  res.writeHead(200, { 'content-type': contentType });
  createReadStream(filePath).pipe(res);
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (pathname !== SIGNALING_PATH) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

server.listen(PORT, () => {
  console.log(`Battleship tunnel server running on http://localhost:${PORT}`);
  console.log(`Signaling endpoint: ws://localhost:${PORT}${SIGNALING_PATH}`);
});

// WebSocket heartbeat: ping every client periodically and terminate any that
// stop responding. Reaping a dead socket fires its 'close' handler, which
// deletes the associated room. This keeps a waiting host's room alive for as
// long as the tab stays open, and prevents idle-connection drops through the
// tunnel (zrok/ngrok close idle WebSockets after ~60s).
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
      continue;
    }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL);

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    switch (msg.type) {
      case 'create-game': {
        const code = generateCode();
        const room = { hostWs: ws, guestWs: null, lastActivity: Date.now() };
        rooms.set(code, room);

        // No join timeout: the room lives as long as the host stays connected.
        // Dead host sockets are reaped by the heartbeat, whose 'close' handler
        // cleans up the room.
        ws.send(
          JSON.stringify({
            type: 'game-created',
            code,
            role: 'host',
          })
        );
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

        room.guestWs = ws;
        room.lastActivity = Date.now();

        room.hostWs.send(
          JSON.stringify({
            type: 'guest-joined',
            code,
          })
        );

        ws.send(
          JSON.stringify({
            type: 'game-joined',
            role: 'guest',
            code,
          })
        );
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
        rooms.delete(code);
      }
    }
  });
});

wss.on('listening', () => {
  console.log(`Active rooms endpoint: ws://localhost:${PORT}${SIGNALING_PATH}`);
});

process.on('SIGINT', () => {
  console.log('Shutting down signaling server...');
  clearInterval(heartbeat);
  for (const [, room] of rooms) {
    room.hostWs?.close();
    room.guestWs?.close();
  }
  rooms.clear();
  wss.close(() => {
    server.close(() => process.exit(0));
  });
});

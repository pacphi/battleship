# Battleship P2P — Maintainer Guide

## Prerequisites

| Tool    | Minimum Version      | Notes                                                                |
| ------- | -------------------- | -------------------------------------------------------------------- |
| Node.js | ≥ 26 (even-numbered) | Astro v6 drops support for Node < 22.12.0; this project targets ≥ 26 |
| pnpm    | ≥ 11                 | Must be installed on PATH (or use `pnpm/action-setup` in CI)         |

### Setup

```bash
# Enable corepack (ships with Node ≥ 16)
corepack enable

# Verify pnpm version
pnpm --version   # should be ≥ 11.x

# Install dependencies
pnpm install

# Verify build
pnpm build
```

## Project Structure

```
├── src/
│   ├── pages/           # Astro pages (index.astro, game.astro)
│   └── scripts/         # Client-side JS modules
│       ├── board.js     # Board + Ship classes
│       ├── game.js      # Game engine (state machine)
│       ├── renderer.js  # Canvas rendering engine
│       ├── webrtc.js    # WebRTC connection manager
│       ├── game-flow.js # Round/queue/hybrid mode logic
│       ├── landing.js   # Landing page interaction
│       └── styles.css   # Global + landing + game page styles
├── server/              # Signaling server (standalone Node.js app)
│   ├── package.json
│   └── index.mjs        # WebSocket signaling relay
├── docs/                # Documentation
├── astro.config.mjs     # Astro config (static output)
└── package.json         # Root: astro + ws dependencies
```

## Commands

| Command        | Description                                          |
| -------------- | ---------------------------------------------------- |
| `pnpm dev`     | Start Astro dev server (http://localhost:4321)       |
| `pnpm build`   | Build static site to `dist/`                         |
| `pnpm preview` | Preview built site locally                           |
| `pnpm server`  | Run signaling server (`server/index.mjs`, port 3001) |

### Running both simultaneously

```bash
# Terminal 1 — Signaling server
pnpm --filter battleship-signaling start

# Terminal 2 — Astro dev server
pnpm dev
```

Or from the root:

```bash
(node server/index.mjs &) && pnpm dev
```

## Architecture Overview

- **Signaling server** (`server/`): WebSocket relay for WebRTC SDP/ICE exchange. Not involved in game state.
- **Client**: Pure HTML/CSS/JS — Astro pages deliver static assets; all game logic runs in the browser via ESM modules over `/scripts/`.
- **WebRTC**: P2P data channel carries all game messages after handshake.
- **Game engine**: Server-authoritative model is avoided; both peers maintain independent board state synced via P2P resolution batch messages.

## Building for Production

```bash
pnpm install  # ensures pnpm-lock.yaml generated
pnpm build    # outputs to dist/
```

The `dist/` directory contains the complete static site — ready to deploy to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3, etc.).

## Testing

### Manual testing workflow

1. Start signaling server: `pnpm server`
2. Start Astro dev: `pnpm dev`
3. Open two browser tabs at `http://localhost:4321`
4. Tab 1: Select mode → "Create Game" → share code
5. Tab 2: Enter code → "Join Game"
6. Verify split boards render, clicks resolve across peers

### Edge cases to verify

- Invalid game code returns error message
- Game expires after 30s without guest join
- Opponent disconnect shows overlay
- P2P restore on temporary network blip
- Torpedo boat shift with no valid adjacent position
- Submarine reveals properly on first hit

## Release Checklist

1. Run full manual test flow (above)
2. Verify `pnpm build` produces clean `dist/`
3. Update `CHANGELOG.md` with version and changes
4. Tag release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
5. Push tags: `git push --tags`

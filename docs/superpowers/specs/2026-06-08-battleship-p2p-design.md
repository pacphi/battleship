---
title: Battleship P2P Game
date: 2026-06-08
status: approved
---

# Battleship — WebRTC Peer-to-Peer Multiplayer Game

## Overview

A multiplayer Battleship game built with Astro.js for static pages, WebRTC for peer-to-peer game state exchange, and HTML5 Canvas for graphics. Two players on the same LAN connect directly — no game server needed, only a minimal signaling server for the initial handshake.

## Architecture

```
Player 1 Browser (Astro pages)  ←─ WebRTC P2P data channel ─→  Player 2 Browser (Astro pages)
         ▲                                                              ▲
         │ signaling (SDP exchange)                                   │ signaling (SDP exchange)
         │                                                            │
    ┌──────────────┐                                                 
    │ Signaling Svr │ (Node.js / ws, port 3001, used only for handshake)
    └──────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Static pages | Astro (output: static) |
| Game rendering | HTML5 Canvas (vanilla JS) |
| Game networking | WebRTC DataChannel (P2P) |
| Signaling | Node.js `ws` WebSocket server |
| Styling | CSS (no framework) |

### Key Design Decisions

- **P2P game state**: All game logic and state lives in-browser. The signaling server only exchanges SDP offer/answer and ICE candidates — it never sees game state.
- **Separate processes**: Astro dev on port 4321, signaling server on port 3001. Production builds serve static files via any HTTP server; signaling server runs independently.
- **No frameworks**: Pure vanilla JS for the game client. No React, Vue, or Svelte needed for canvas rendering.

## Game Rules

### Grid

- 12×12 grid. Rows labeled A–L, columns 1–12.
- Each player has two boards: **Fleet** (their own ships) and **Enemy** (opponent's fleet, partially revealed).

### Ships (randomly placed, no manual phase)

| Ship | Size | Special Ability |
|------|------|-----------------|
| Carrier | 5 | Standard |
| Battleship | 4 | Standard |
| Heavy Cruiser | 3 | Standard |
| Light Cruiser | 3 | Standard |
| Submarine | 2 | Hidden until first hit — shows as a hit with no ship outline until all cells are revealed |
| Torpedo Boat | 2 | After an opponent fires a miss, shifts to an adjacent 2-cell position (if valid and unoccupied). Announced to opponent |

### Win Condition

Sink all ships in the opponent's fleet.

## Game Flow Modes

Players select one mode on the landing page before connecting. Host picks, guest confirms.

### Round-Based Mode

- Each round has a **3-second countdown timer** displayed at the top of the screen.
- Both players click targets during the round. Clicks are queued locally.
- At timer end, all queued targets resolve simultaneously.
- Results broadcast to both players simultaneously.
- Next round begins immediately.

### Queue-Based Mode

- Players click targets whenever ready — no timer.
- When **both** players have submitted a target, the pair resolves simultaneously.
- If a player is idle >15 seconds, they auto-target their first unshot cell.
- Auto-targets are announced ("Auto-fire!").

### Hybrid Mode

- Round-based (3-second timer) **with** 5-second grace period.
- If only one player fires within the round, the second player has 5 seconds to respond.
- After grace period expires, both pending targets resolve: the non-firer auto-targets their first unshot cell.
- Combines the structure of round-based with the flexibility of queue-based.

### Mode Selection Screen

```
┌─────────────────────────────────────┐
│         SELECT GAME MODE            │
│                                     │
│  [  Round-Based  ]  Timer-driven  │
│  [  Queue-Based    ] Click anytime│
│  [  Hybrid       ] Timer + grace  │
│                                     │
│  "Round-based forces fast decisions │
│   Queue-based is more relaxed.      │
│   Hybrid gives the best of both."   │
│                                     │
│              [ OK ]                  │
└─────────────────────────────────────┘
```

## Components

### 1. Landing Page (`src/pages/index.astro`)

- Game rules display (collapsible)
- Mode selector with explanations
- "Create Game" → generates 6-char game code, starts signaling server
- "Join Game" → input field for game code
- Visual connection status indicator

### 2. Game Page (`src/pages/game.astro`)

- Split view with two 12×12 Canvas elements side by side
  - **Left board**: Your fleet — all ships visible, your shots marked (hit/miss)
  - **Right board**: Enemy fleet — ships hidden, revealed by shots
- Status bar: mode, current turn indicators, game phase
- Chat/message area: ship abilities announced here ("Torpedo Boat moved!", "Submarine revealed!")
- Game over overlay with restart option

### 3. Game Client (`src/scripts/game-client.js`)

- **WebRTCManager**: Handles peer connection, data channel, signaling exchange
- **GameEngine**: Manages game state machine (placing → playing → finished)
- **BoardManager**: Ship placement, hit/miss logic, torpedo boat shifting, submarine reveal
- **Renderer**: HTML5 Canvas drawing (boards, ships, markers, animations)
- **InputHandler**: Click detection, target queuing, timer logic
- **GameLoop**: Main render loop (`requestAnimationFrame`)

### 4. Signaling Server (`server/index.mjs`)

Minimal relay server. Handles only:
- `create-game`: Generates unique 6-char code (from `a-z0-9` alphabet, ~300M combinations), assigns to a host connection
- `join-game`: Matches a guest to a host with the given code
- `relay`: Forwards SDP offer/answer and ICE candidates between peers
- **Multiple concurrent sessions**: Each game code maps to an independent room in-memory. No hard limit — constrained only by server memory (typical room: ~2 WebSocket connections + small object)
- Auto-cleanup of stale game rooms after 60 seconds of inactivity or upon either player disconnecting
- Room list endpoint (`/rooms`) returns active game codes (for hosts to verify their game is discoverable)

## Protocol (WebRTC DataChannel Messages)

```json
{ "type": "join",       "code": "abc123" }
{ "type": "sdp",        "data": { type: "offer"|"answer", sdp: "..." } }
{ "type": "ice",        "data": { candidate: "..." } }
{ "type": "target",     "row": 3,  "col": 7 }
{ "type": "resolution", "turns": [
    { "player": 1, "row": 3,  "col": 7, "result": "hit" },
    { "player": 2, "row": 5,  "col": 4, "result": "miss" }
  ],
  "mode": "round" }
{ "type": "torpedo-move", "boatId": 5, "from": [[7,8],[7,9]], "to": [[6,8],[6,9]] }
{ "type": "sub-reveal", "shipId": 4 }
{ "type": "game-over",  "winner": 1|2 }
{ "type": "disconnect", "reason": "timeout" }
```

## Game State Machine

```
                    ┌──────────┐
   Host: create     │          │   Guest: join
  ───────────────►  │  WAITING │ ───────────────►
                    │          │              │
                    └──────────┐              ▼
                             │          ┌──────────┐
                             │          │ SIGNALING│──SDP/ICE exchange──►
                             │          │          │              │
                             ▼          └──────────┘              ▼
                    ┌──────────┐                            ┌──────────┐
  ┌──────────────►  │  PLAYING │◄──────────────────────────►│  PLAYING │
  │                 │          │   WebRTC P2P data channel   │          │
  │                 └──────────┘                             └──────────┘
  │                      │
  │                      ▼
  │                 ┌──────────┐
  └─────────────────│  FINISHED│
                    └──────────┘
```

## Error Handling

| Scenario | Handling |
|----------|----------|
| P2P connection lost | Detect via `iceconnectionstatechange`. Show overlay. Save state locally for potential resume. |
| One player disconnects | Other sees "Opponent disconnected" message. Game state preserved locally. |
| Signaling server down | Error on create/join. No fallback. |
| Invalid move (duplicate, out of bounds) | Silently ignored client-side. No server round-trip. |
| Torpedo boat shift blocked | Boat stays in place. Message: "Torpedo Boat could not shift!" |
| Submarine hit | Standard hit. Ship remains hidden until sunk (all cells revealed). |

## Visual Design

### Board Canvas (12×12)

- Grid lines: subtle gray
- Water cells: light blue gradient
- Ship cells: dark blue with hull pattern
- Hit markers: red X with fire animation
- Miss markers: white splash/ripple animation
- Ship labels: text overlay (C, B, H, L, S, T)
- Active shot cursor: crosshair on hover
- Torpedo boat shift animation: smooth transition

### Color Palette

- Background: `#0a1628` (deep navy)
- Board: `#1a3a5c` (ocean blue)
- Ship hulls: `#2c5f8a` with `#1a3a5c` outline
- Hit: `#e74c3c` (red)
- Miss: `#ecf0f1` (white splash)
- Water: gradient `#0d2137` → `#1a3a5c`
- Text: `#ecf0f1`
- Accent: `#3498db` (action buttons)
- Timer: `#f39c12` (amber countdown)

## File Structure

```
battleship/
├── astro.config.mjs
├── package.json
├── src/
│   ├── pages/
│   │   ├── index.astro        # Landing page (rules, mode select, join/create)
│   │   └── game.astro         # Game page (split board view)
│   └── scripts/
│       ├── game-client.js     # Main game logic (WebRTC + rendering + state)
│       ├── board.js           # Board management, ship logic
│       ├── renderer.js        # Canvas rendering engine
│       ├── signaling.js       # Signaling server (also used client-side for WS)
│       └── styles.css         # Game UI styles
├── server/
│   ├── package.json
│   └── index.mjs              # Minimal signaling relay server
├── dist/                      # Built by `astro build`
└── docker-compose.yml         # Dev deployment
```

## Build & Run

### Development

```bash
# Terminal 1: Astro dev server
npm run dev

# Terminal 2: Signaling server
cd server && node index.mjs
```

### Production

```bash
npm run build          # Astro builds to dist/
serve dist/            # Serve static files (or nginx/caddy)
cd server && node index.mjs   # Run signaling server
```

## Success Criteria

1. Two browsers on the same LAN can connect by exchanging a 6-char game code
2. Both players see their boards rendered on HTML5 Canvas
3. Shots resolve simultaneously in all three game flow modes
4. Special abilities work correctly (submarine hidden until sunk, torpedo boat shifts)
5. Game declares a winner when one fleet is fully sunk
6. Connection loss is handled gracefully with clear messages
7. All game state is consistent between both players at all times

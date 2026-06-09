# Battleship P2P — User Guide

## What is this?

Battleship P2P is a peer-to-peer multiplayer Battleship game built with Astro. Two players connect directly through their browsers using WebRTC — no game servers, no downloads required.

## How to Play

### Prerequisites

- A modern browser (Chrome, Firefox, Edge, or Safari)
- No account or installation needed

### Starting a Game

1. Open the game URL in your browser (e.g., `https://your-domain.com`)
2. Select a game mode:
   - **Round-Based**: Both players have 3 seconds per round to fire. Fast-paced.
   - **Queue-Based**: Fire whenever you're ready. Resolves when both have fired. Relaxed pace.
   - **Hybrid**: Round timer with a 5-second grace period if only one player fires. Best of both worlds.
3. Click **"Create Game"** to generate a 6-character code
4. Share that code with your opponent

### Joining a Game

1. Open the same URL in a second browser tab or another device
2. Select the same game mode as the host
3. Enter the 6-character game code
4. Click **"Join Game"**

### Gameplay

- **Your fleet** (left board) shows your hidden ship positions
- **Enemy waters** (right board) is where you attack — click to fire
- Both players fire simultaneously in all modes
- First player to sink all 6 enemy ships wins
- Sunk ships are revealed; submarines stay hidden until the first hit

### Ship Fleet

| Ship          | Size    | Special Ability                                            |
| ------------- | ------- | ---------------------------------------------------------- |
| Carrier       | 5 cells | Standard                                                   |
| Battleship    | 4 cells | Standard                                                   |
| Heavy Cruiser | 3 cells | Standard                                                   |
| Light Cruiser | 3 cells | Standard                                                   |
| Submarine     | 2 cells | Hidden until first hit (disappears when sunk)              |
| Torpedo Boat  | 2 cells | Shifts to an adjacent position after opponent fires a miss |

## Game Modes Explained

### Round-Based Mode

- 3-second timer each round
- Both players must submit a target before time expires
- Auto-fires first unshot cell if you don't act in time
- Fastest gameplay — ideal for quick matches

### Queue-Based Mode

- No timer — fire at your own pace
- Resolution happens when both players have submitted targets
- 15-second auto-target if idle
- Best for casual play

### Hybrid Mode

- Round-based timer (3 seconds)
- If only one player fires before the timer, a 5-second grace period activates for the other player
- Balances speed and fairness

## Troubleshooting

| Problem               | Solution                                                                  |
| --------------------- | ------------------------------------------------------------------------- |
| "Connection failed"   | Ensure WebRTC is allowed in browser settings; check firewall/proxy rules  |
| P2P connection lost   | Game continues if signaling still works; refresh to re-establish          |
| Opponent disconnected | Game ends with overlay message                                            |
| Code invalid/expired  | Host has 30 seconds before the game expires; ask them to create a new one |

## Technical Notes

- **P2P only**: After the initial handshake via our signaling server, all game data flows peer-to-peer. We never see your moves.
- **Signaling server**: Relays WebRTC negotiation data (SDP/ICE candidates) between peers for ~60 seconds then cleans up.
- **Grid size**: 12×12 cells (rows A–L, columns 1–12)
- **Browser compatibility**: Works in any browser with WebRTC support

## Deployment

The built site is fully static (`dist/` directory). Deploy to:

- **GitHub Pages**: Push `dist/` to a `gh-pages` branch or use the GitHub Actions workflow
- **Netlify/Vercel**: Point at the repo root; build command is `pnpm build`
- **Cloudflare Pages**: Connect repo; build command `pnpm build`
- **S3 + CloudFront**: Upload `dist/` contents as static website hosting

See `.github/workflows/release.yml` for automated GitHub Releases with packaged artifacts.

---

## LAN Party Tunneling

At a LAN party you need two things reachable from any device on the network:

1. The static game site (the page you open and click "Create Game" or "Join Game")
2. The signaling server (`ws://` on port 3001) — relays WebRTC handshake data between peers

Because **the game derives the signaling URL from `window.location.hostname`** (it connects to `ws://${hostname}:3001`), any tunneling solution that exposes **both services under the same hostname** works with zero code changes. You don't need separate URLs, proxy headers, or environment variables — just one shareable link.

### Method 1: zrok (recommended)

[zrok](https://github.com/openz.zone/zrok) is open-source, free for personal use, and creates stable reverse tunnels under a shared frontend domain.

#### Setup (one person — the host)

```bash
# Install
brew install openz.zone/zrok          # macOS
# or: curl -s https://app.zrok.io/installer | sh

# Register a free account (takes 30 seconds)
zrok invite accept <invite-code>

# Start a frontend on localhost (optional — lets you watch tunnels)
zrok frontend public

# Terminal 1 — expose the static game site
zrok share exposed dist http://localhost:4321

# → Outputs something like: https://<your-shared-id>.zrok.io

# Terminal 2 — expose the signaling server on the SAME hostname
zrok share exposed server/index.mjs http://localhost:3001 \
  --address https://<your-shared-id>.zrok.io
```

Both tunnels now listen under the same `.zrok.io` domain. Share that single URL with everyone — the game page hits `wss://<id>.zrok.io:3001` automatically.

**Why zrok**: free tier, stable long-lived sessions, open-source, and the `--address` flag lets you pin both tunnels to one hostname.

### Method 2: ngrok

[ngrok](https://ngrok.com) is the quickest way to get a tunnel up — no account needed for basic use. Free tier gives you a random URL that changes each session.

#### Quick start (no install)

```bash
# Terminal 1 — game site
npx ngrok http 4321

# → Copies a forwarding URL like https://abc1.ngrok-free.app

# Terminal 2 — signaling server (same domain)
npx ngrok http 3001 --domain abc1.ngrok-free.app

# Or use the single-command multi-port approach:
ngrok http http://localhost:4321,http://localhost:3001 \
  --resolver-endpoint dns+https://dns.google/dns-query
```

**With ngrok CLI installed** (persistent domain):

```bash
brew install ngrok/ngrok/ngrok
ngrok authtoken <your-token>

# Tunnel both services under one domain
ngrok http https://localhost:4321 \
  --hostname tunnel.ngrok-free.app
ngrok tcp 3001 --region us              # TCP port on same account
```

Then point the game site to `wss://tunnel.ngrok-free.app:443` for signaling.

**Why ngrok**: instant setup with `npx`, widely available at events, well-documented REST API for managing tunnels.

### Method 3: localtunnel (lightest option)

[lc](https://github.com/localtunnel/cli) — zero install, just one package global.

```bash
npm i -g localtunnel

# Terminal 1 — game site
lt --port 4321
# → https://abcd.localtunnel.me

# Terminal 2 — signaling (same hostname via --subdomain)
lt --port 3001 --subdomain abcd
```

**Caveat**: free localtunnel instances sleep after 2 minutes of inactivity. Use **zrok** for longer LAN events.

### How it works under the hood

```
Browser (Player A) ──┐
                      ├──► tunnel URL (game page + signaling ws://:3001)
Browser (Player B) ──┘                   │
                                  zrok/ngrok/localtunnel
                                           │
                              ┌────────────┴────────────┐
                              │  localhost:4321 (game)  │
                              │  localhost:3001 (ws)    │
                              └─────────────────────────┘
                                         │
                              WebRTC P2P data channel ───► game data
```

The tunnel only handles the **initial handshake** (SDP + ICE candidates). Once WebRTC establishes a direct peer-to-peer connection, all subsequent game data flows between browsers — no longer through the tunnel. If you disconnect the tunnel mid-game, the game continues uninterrupted.

### Troubleshooting LAN connections

| Problem | Solution |
| --- | --- |
| "Signaling connection failed" | Make sure **both** the static site and port 3001 are tunneled under the same hostname |
| WebRTC handshake hangs | Check that STUN servers (Google) are reachable; some LANs block `stun.l.google.com:19302` |
| Tunnel drops mid-game | Game continues P2P — just re-tunnel to let new players join. Restart tunnel, refresh page with same code |
| Firewall blocking port 3001 | Tunneling bypasses local firewall — only matters if you run both services locally behind a host firewall |

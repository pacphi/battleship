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

| Ship | Size | Special Ability |
|------|------|-----------------|
| Carrier | 5 cells | Standard |
| Battleship | 4 cells | Standard |
| Heavy Cruiser | 3 cells | Standard |
| Light Cruiser | 3 cells | Standard |
| Submarine | 2 cells | Hidden until first hit (disappears when sunk) |
| Torpedo Boat | 2 cells | Shifts to an adjacent position after opponent fires a miss |

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

| Problem | Solution |
|---------|----------|
| "Connection failed" | Ensure WebRTC is allowed in browser settings; check firewall/proxy rules |
| P2P connection lost | Game continues if signaling still works; refresh to re-establish |
| Opponent disconnected | Game ends with overlay message |
| Code invalid/expired | Host has 30 seconds before the game expires; ask them to create a new one |

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

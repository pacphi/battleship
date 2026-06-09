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

The built site is static (`dist/` directory), but multiplayer needs a WebSocket signaling endpoint on the same origin at `/signaling`.

- **LAN/demo**: Run `pnpm build && pnpm server` and tunnel `http://localhost:4321`
- **Hosted production**: Deploy `dist/` plus a WebSocket-capable signaling service mounted at `/signaling`

For static-only hosting, the game page can load, but multiplayer cannot connect unless signaling is also available.

---

## LAN Party Tunneling

At a LAN party you need one public URL. The local server serves both:

1. The static game site
2. The WebSocket signaling endpoint at `/signaling`

The browser derives signaling from the current page origin. If the page is `https://example`, signaling uses `wss://example/signaling`.

### Method 1: zrok (recommended)

[zrok](https://github.com/openziti/zrok) is open-source and provides public sharing through the current `zrok2` CLI.

#### Setup

```bash
# Install zrok2 locally for this project. The script downloads the versioned
# GitHub release artifact and verifies checksums.sha256.txt before installing.
pnpm tunnel:install:zrok

# Enable your zrok environment once with your account token.
.tools/bin/zrok2 enable <account-token>

# Build, serve, and open one public tunnel.
pnpm tunnel:zrok
```

Share the single public URL printed by zrok.

#### Uninstall

```bash
pnpm tunnel:uninstall:zrok
```

Windows:

```powershell
.\scripts\tunnel-setup.pwsh install zrok -Scope project
.\.tools\bin\zrok2.cmd enable <account-token>
.\scripts\tunnel-setup.pwsh run zrok
.\scripts\tunnel-setup.pwsh uninstall zrok -Scope project
```

On Windows ARM64, the installer uses zrok's Windows x64 artifact under Windows-on-ARM compatibility because zrok does not currently publish a Windows ARM64 artifact.

### Method 2: ngrok

[ngrok](https://ngrok.com) is widely available and works well with the single-origin server.

#### Setup

```bash
# Install ngrok from https://ngrok.com/download or through the helper where supported.
scripts/tunnel-setup.sh install ngrok --scope user

# Add your authtoken once.
ngrok config add-authtoken <your-token>

# Build, serve, and open one public tunnel.
pnpm tunnel:ngrok
```

Windows:

```powershell
.\scripts\tunnel-setup.pwsh install ngrok -Scope user
ngrok config add-authtoken <your-token>
.\scripts\tunnel-setup.pwsh run ngrok
```

#### Uninstall

```bash
scripts/tunnel-setup.sh uninstall ngrok --scope user
```

Windows:

```powershell
.\scripts\tunnel-setup.pwsh uninstall ngrok -Scope user
```

### Tool Support

The helper scripts support these zrok release artifacts:

- macOS ARM64
- Linux x64, ARM64, ARMv7 on Debian, Ubuntu, Fedora, Alpine, SUSE, Arch, and other distros that can run the upstream binary
- Windows x64
- Windows ARM64 via x64 compatibility

ngrok installation is delegated to official native installers where possible:

- macOS: Homebrew
- Debian/Ubuntu: ngrok's official apt repository
- Linux distros with Snap: snap
- Windows: winget or Scoop

For Alpine, SUSE, Arch, Fedora without Snap, and other Linux distributions, install ngrok from the official download page and then run `pnpm tunnel:ngrok`. Project-local ngrok installation is intentionally not managed because ngrok does not expose the same release checksum workflow as zrok.

Use `pnpm tunnel:doctor` to check local tool availability.

### How It Works Under the Hood

```
Browser (Player A) ──┐
                      ├──► tunnel URL
Browser (Player B) ──┘                   │
                                      zrok/ngrok
                                           │
                              http://localhost:4321
                         static files + /signaling WebSocket
                                         │
                              WebRTC P2P data channel ───► game data
```

The tunnel only handles the **initial handshake** (SDP + ICE candidates). Once WebRTC establishes a direct peer-to-peer connection, all subsequent game data flows between browsers — no longer through the tunnel. If you disconnect the tunnel mid-game, the game continues uninterrupted.

### Troubleshooting LAN connections

| Problem                       | Solution                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| "Signaling connection failed" | Make sure the tunnel points to the single local server on port 4321                                      |
| WebRTC handshake hangs        | Check that STUN servers (Google) are reachable; some LANs block `stun.l.google.com:19302`                |
| Tunnel drops mid-game         | Game continues P2P — just re-tunnel to let new players join. Restart tunnel, refresh page with same code |
| zrok2 not found               | Run `pnpm tunnel:install:zrok`, or add `.tools/bin` to PATH                                              |

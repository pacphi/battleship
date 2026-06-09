# &#x1F30A; Battleship P2P &#x1F680;

[![CI](https://img.shields.io/github/actions/workflow/status/pacphi/battleship/ci.yml?style=flat)](https://github.com/pacphi/battleship/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

## Drop in. Aim true. Sink everything. &#x1F525;

**Battleship**, the classic naval combat game — reborn for the modern web. No downloads. No accounts. Just open a link, share a code, and wage full-on fleet war against a friend. &#x1F6E0;&#xFE0F;

&#x26A1; Built with **[Astro](https://astro.build)**, **WebRTC**, and pure vanilla JS — all game data flows peer-to-peer between browsers. Zero server-side game logic. Maximum privacy. Minimum latency.

---

## &#x1F525; Why You'll Love It

| Feature                        | The Deal                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| &#x1F9E1; **True P2P**         | Your shots never touch a game server — browsers connect directly via WebRTC                               |
| &#x1F310; **Zero Sign-Up**     | Open the URL. Pick a mode. Share a 6-character code. That's it.                                           |
| &#x1F525; **Three Game Modes** | _Round-Based_ for fast-fire thrills, _Queue-Based_ for chill tactical play, _Hybrid_ for the best of both |
| &#x1F699; **Special Ships**    | Sneaky submarines that hide until first hit. Shifting torpedo boats that dodge after a miss.              |
| &#x1F3A8; **Canvas Graphics**  | Smooth HTML5 Canvas rendering with fire & splash animations                                               |
| &#x1F4CD; **LAN-Ready**        | Works on your home network, at a hackathon, or across the globe                                           |

---

## &#x1F6E0;&#xFE0F; How to Play in 30 Seconds

1. **Open** the game URL in any modern browser &#x1F5A4;&#xFE0F;
2. **Create a game** (or join with a code)
3. **Pick your mode:**
   - &#x23F1;&#xFE0F; **Round-Based** — 3-second timer per round. Fast decisions. Who blinks first?
   - &#x1F984; **Queue-Based** — Fire whenever you're ready. No pressure. Maximum strategy.
   - &#x1F504; **Hybrid** — Timer + grace period. Structure _and_ flexibility.
4. **Share the 6-char code** with your opponent via chat, DM, or carrier pigeon &#x1F54A;
5. **Click to fire.** Sink all 6 ships to win. &#x2694;&#xFE0F;

### The Fleet

| Ship                            | Size    | &#x1F3AF; Special Ability                                |
| ------------------------------- | ------- | -------------------------------------------------------- |
| &#x1F6DD; Carrier               | 5 cells | Classic heavy hitter                                     |
| &#x1F6A2; Battleship            | 4 cells | Second only to the carrier in power                      |
| &#x1F6E3;&#xFE0F; Heavy Cruiser | 3 cells | Solid workhorse of the fleet                             |
| &#x1F6E3;&#xFE0F; Light Cruiser | 3 cells | Agile and versatile                                      |
| &#x1F432; Submarine             | 2 cells | **Hidden until first hit** — invisible threat!           |
| &#x1F6A5; Torpedo Boat          | 2 cells | **Shifts position after a miss** — never still for long! |

---

## &#x1F680; Quick Start

```bash
# Install dependencies
pnpm install

# Start the Astro dev server
pnpm dev            # &#x1F3B2;&#xFE0F;  http://localhost:4321
```

For local multiplayer testing, also start the single-origin production-style server after building:

```bash
pnpm build
pnpm server         # &#x1F50D;  http://localhost:4321 with /signaling WebSocket
```

Open two browser tabs, create a game in one, join with the code in the other. **Done.** &#x1F389;

### LAN Tunnels

```bash
# Install a project-local, checksum-verified zrok2 binary
pnpm tunnel:install:zrok

# Build, start the local server, and open a zrok tunnel
pnpm tunnel:zrok

# Or use an existing ngrok install
pnpm tunnel:ngrok

# Remove the project-local zrok2 install
pnpm tunnel:uninstall:zrok
```

Windows users can run the PowerShell helper directly:

```powershell
.\scripts\tunnel-setup.pwsh install zrok -Scope project
.\scripts\tunnel-setup.pwsh run zrok
.\scripts\tunnel-setup.pwsh uninstall zrok -Scope project
```

---

## &#x1F4BE; Under the Hood

```
Browser (Player 1)  <──────── WebRTC P2P ────────►  Browser (Player 2)
        ▲                                                 ▲
        │  Signaling handshake only (SDP + ICE)           │
        └────────── Node.js / WebSocket ─────────────────┘
```

- **Game state** lives entirely in each player's browser &#x1F9F0;
- **Signaling server** handles _only_ the initial WebRTC handshake on `/signaling` — it never sees a single move
- **Rendering** via vanilla HTML5 Canvas with `requestAnimationFrame` loop
- **Zero dependencies** on UI frameworks — just pure, performant JS

---

## 📚 Documentation

- **[🧑‍💻 User Guide](docs/USER-GUIDE.md)** — How to play, game modes, troubleshooting, and LAN tunneling with zrok/ngrok.
- **[🔧 Maintainer Docs](docs/MAINTAINERS.md)** — Project setup, architecture overview, testing, and release process.

---

## &#x1F9EA; Tech Stack

| Layer                       | Tech                      |
| --------------------------- | ------------------------- |
| &#x1F3A8; Pages             | Astro (static output)     |
| &#x1F579;&#xFE0F; Rendering | HTML5 Canvas (vanilla JS) |
| &#x1F517; Networking        | WebRTC DataChannel (P2P)  |
| &#x1F50D; Signaling         | Node.js `ws` WebSocket    |
| &#x1F3AF; Styling           | Pure CSS                  |
| &#x1F9EA; Testing           | Vitest                    |

---

## &#x2699;&#xFE0F; Scripts

```bash
pnpm dev          # &#x1F3B2;&#xFE0F;  Astro dev server
pnpm build        # &#x1F4E6;  production bundle
pnpm preview      # &#x1F440;  local preview of build
pnpm server       # &#x1F50D;  static site + /signaling WebSocket
pnpm tunnel:doctor
pnpm tunnel:install:zrok
pnpm tunnel:uninstall:zrok
pnpm tunnel:zrok
pnpm tunnel:ngrok
pnpm test         # &#x1F9EA;  run all tests
pnpm lint         # &#x1F9E1;  ESLint
pnpm lint:md      # &#x1F4D6;  Markdown lint (markdownlint-cli2)
pnpm format       # &#x1F4BE;  Prettier across everything
pnpm check        # &#x2705  typecheck + lint + format + test
```

---

## &#x1F3AF; Ship It

Deploy the static `dist/` folder to **any** static hosting provider and run `server/index.mjs` anywhere that can serve WebSockets:

- &#x1F436; **GitHub Pages** — use the included CI workflow
- &#x2699;&#xFE0F; **Netlify / Vercel** — connect repo, build cmd: `pnpm build`
- &#x2601;&#xFE0F; **Cloudflare Pages** — same build command
- &#x2744;&#xFE0F; **S3 + CloudFront** — upload `dist/` as a static website

For LAN parties and demos, `pnpm server` serves both the static build and signaling on one port.

---

## &#x1F51D; License

MIT — go forth and wage naval warfare. &#x1F680;&#x1F30A;

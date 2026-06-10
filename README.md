# &#x1F30A; Battleship P2P &#x1F680;

[![CI](https://img.shields.io/github/actions/workflow/status/pacphi/battleship/ci.yml?style=flat)](https://github.com/pacphi/battleship/actions/workflows/ci.yml) [![Security Audit](https://img.shields.io/github/actions/workflow/status/pacphi/battleship/security.yml?style=flat&label=security)](https://github.com/pacphi/battleship/actions/workflows/security.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat)](LICENSE)

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

### Host friends over a tunnel

Want a friend on another computer to join? Run the guided setup — it picks a tunnel, signs
you in, and opens one public link to share:

```bash
pnpm tunnel:setup        # interactive: pick zrok/ngrok, install, sign in, host
pnpm tunnel:doctor       # friendly "is everything ready?" health check
```

Prefer to do it by hand?

```bash
pnpm tunnel:install:zrok        # project-local, checksum-verified
.tools/bin/zrok2 enable <token> # one-time sign-in (see the Hosting guide)
pnpm tunnel:zrok                # build, serve, and open a zrok tunnel

pnpm tunnel:install:ngrok       # system-wide via your OS package manager
ngrok config add-authtoken <token>
pnpm tunnel:ngrok
```

> `zrok` installs project-local into `.tools/` (checksum-verified); `ngrok` installs
> system-wide via your OS package manager. The **[Hosting guide](docs/HOSTING.md)** explains
> why, where to get a free token, and how to troubleshoot.

Windows users run the PowerShell helper directly:

```powershell
.\scripts\tunnel-setup.pwsh setup
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

Want a feel for the game first? Take the **[📸 Screenshots tour](docs/SCREENSHOTS.md)** — a few annotated shots from start screen to firing the first salvo.

Start at the **[Guide index](docs/USER-GUIDE.md)** — it routes you by what you want to do:

- **[🎮 Playing](docs/PLAYING.md)** — a friend sent you a link or a code. Zero setup, just a browser.
- **[🎉 Hosting](docs/HOSTING.md)** — invite friends to play online. Run `pnpm tunnel:setup` and it walks you through everything.
- **[🚀 Deploying](docs/DEPLOYING.md)** — put the game on a real web address (static `dist/` + signaling).
- **[🌱 Seed](docs/SEED.md)** — run the game natively on a Cognitum One Seed device as a self-contained Rust cog.
- **[🔧 Maintainer Docs](docs/MAINTAINERS.md)** — project setup, architecture overview, testing, and release process.

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
# &#x1F3D7;&#xFE0F;  Build & run
pnpm dev          # &#x1F3B2;&#xFE0F;  Astro dev server
pnpm build        # &#x1F4E6;  production bundle
pnpm preview      # &#x1F440;  local preview of build
pnpm server       # &#x1F50D;  static site + /signaling WebSocket

# &#x1F9ED;  Host friends over a tunnel (see docs/HOSTING.md for the walkthrough)
pnpm tunnel:setup             # &#x1F9ED;  guided: pick a tunnel, sign in, host
pnpm tunnel:doctor            # &#x1FA7A;  health check: is everything ready to host?
pnpm tunnel:install:zrok      # project-local, checksum-verified
pnpm tunnel:uninstall:zrok
pnpm tunnel:install:ngrok     # system-wide (user scope, via package manager)
pnpm tunnel:uninstall:ngrok
pnpm tunnel:zrok              # build, serve, open a zrok tunnel
pnpm tunnel:ngrok             # build, serve, open an ngrok tunnel

# &#x2705;  Quality gates (see docs/MAINTAINERS.md → Developer workflow)
pnpm test         # &#x1F9EA;  run all tests once
pnpm test:watch   # &#x1F441;&#xFE0F;   re-run tests on change
pnpm typecheck    # &#x1F50E;  astro check (TS + template types)
pnpm lint         # &#x1F9E1;  ESLint
pnpm lint:fix     # &#x1F527;  ESLint with autofix
pnpm format       # &#x1F4BE;  Prettier across everything
pnpm format:check # &#x1F4CF;  Prettier in check-only mode
pnpm lint:md      # &#x1F4D6;  Markdown lint (markdownlint-cli2)
pnpm lint:md:fix  # &#x1F4DD;  Markdown lint with autofix
pnpm check        # &#x2705;  typecheck + lint + format:check + test
pnpm fix          # &#x1F9F9;  lint:fix + format (auto-clean everything)

# &#x1F4E6;  Dependency hygiene
pnpm audit            # &#x1F6E1;&#xFE0F;   report known vulnerabilities (also runs weekly in CI)
pnpm audit:fix        # &#x1F527;  apply available audit fixes
pnpm deps:outdated    # &#x1F4C5;  list outdated dependencies
pnpm deps:update      # &#x2B06;&#xFE0F;   update within semver ranges
pnpm deps:update:latest  # &#x1F680;  update to latest (may break)
```

---

## &#x1F3AF; Ship It

Deploy the static `dist/` folder to **any** static hosting provider and run `server/index.mjs` anywhere that can serve WebSockets:

- &#x1F436; **GitHub Pages** — use the included CI workflow
- &#x2699;&#xFE0F; **Netlify / Vercel** — connect repo, build cmd: `pnpm build`
- &#x2601;&#xFE0F; **Cloudflare Pages** — same build command
- &#x2744;&#xFE0F; **S3 + CloudFront** — upload `dist/` as a static website
- &#x1F331; **Cognitum One Seed** — build the Rust cog (`cross build --release`) and register it on the device; no Node.js required

For LAN parties and demos, `pnpm server` serves both the static build and signaling on one port.

---

## &#x1F51D; License

MIT — go forth and wage naval warfare. &#x1F680;&#x1F30A;

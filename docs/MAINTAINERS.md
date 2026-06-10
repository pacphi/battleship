# Battleship P2P — Maintainer Guide

> **Other guides:** [Playing](PLAYING.md) (players) · [Hosting](HOSTING.md) (tunnels) ·
> [Deploying](DEPLOYING.md) (production). This page is for working on the code itself.

## Prerequisites

| Tool    | Minimum Version      | Notes                                                                |
| ------- | -------------------- | -------------------------------------------------------------------- |
| Node.js | ≥ 26 (even-numbered) | Astro v6 drops support for Node < 22.12.0; this project targets ≥ 26 |
| pnpm    | ≥ 11                 | Must be installed on PATH (or use `pnpm/action-setup` in CI)         |
| Rust    | stable               | Required only to build the Seed cog (`cogs/battleship/`)             |
| cross   | latest               | Docker-based cross-compiler for Pi Zero 2W (`cargo install cross`)   |

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
│   ├── pages/              # Astro pages (index.astro, game.astro)
│   └── scripts/            # Client-side JS modules
│       ├── board.js        # Board + Ship classes
│       ├── game.js         # Game engine (state machine)
│       ├── renderer.js     # Canvas rendering engine
│       ├── webrtc.js       # WebRTC connection manager (WebSocket signaling)
│       ├── webrtc-cog.js   # Drop-in replacement using HTTP long-poll (Seed only)
│       ├── game-flow.js    # Round/queue/hybrid mode logic
│       ├── landing.js      # Landing page interaction
│       └── styles.css      # Global + landing + game page styles
├── server/                 # Single-origin static + WebSocket server
│   ├── package.json
│   └── index.mjs           # Serves dist/ and WebSocket signaling on /signaling
├── cogs/
│   └── battleship/         # Cognitum One Seed cog
│       ├── Cargo.toml      # Rust package: binary cog-battleship, deps tiny_http/serde_json/subtle/getrandom
│       ├── cog.toml        # Seed cog manifest: endpoints, hardware_requirement, bind_loopback_only
│       ├── build.rs        # Runs pnpm build (COG_MODE=true), embeds dist/ via include_bytes! into OUT_DIR
│       └── src/
│           ├── main.rs     # HTTP server: open/paired routing, runtime token injection, asset serving
│           ├── signal.rs   # RoomStore: create/join/push/poll (Condvar long-poll)/leave
│           └── lib.rs      # Re-exports signal for integration tests
├── docs/
│   ├── adr/                # Architecture Decision Records
│   │   └── ADR-001-cognitum-seed-cog.md
│   └── ...
├── astro.config.mjs        # Astro config (static output)
└── package.json            # Root: astro + ws dependencies
```

## Commands

| Command                        | Description                                                    |
| ------------------------------ | -------------------------------------------------------------- |
| `pnpm dev`                     | Start Astro dev server (<http://localhost:4321>)               |
| `pnpm build`                   | Build static site to `dist/`                                   |
| `pnpm preview`                 | Preview built site locally                                     |
| `pnpm server`                  | Serve `dist/` and `/signaling` on port 4321                    |
| `pnpm tunnel:setup`            | Guided, interactive tunnel setup (install, sign in, host)      |
| `pnpm tunnel:doctor`           | Health check: Node, pnpm, build, port, tunnel readiness        |
| `pnpm tunnel:install:zrok`     | Install project-local zrok2 with checksum verification         |
| `pnpm tunnel:uninstall:zrok`   | Remove project-local zrok2                                     |
| `pnpm tunnel:zrok`             | Build, serve, and open a zrok tunnel                           |
| `pnpm tunnel:ngrok`            | Build, serve, and open an ngrok tunnel                         |
| `pnpm test`                    | Run the full test suite once (Vitest)                          |
| `pnpm test:watch`              | Re-run tests on file change                                    |
| `pnpm typecheck`               | `astro check` — TypeScript and template type checking          |
| `pnpm lint` / `lint:fix`       | ESLint (report / autofix)                                      |
| `pnpm format` / `format:check` | Prettier (write / check-only)                                  |
| `pnpm lint:md` / `lint:md:fix` | Markdown lint via markdownlint-cli2 (report / autofix)         |
| `pnpm check`                   | Typecheck + lint + format:check + test (local pre-commit gate) |
| `pnpm fix`                     | `lint:fix` + `format` — auto-clean the working tree            |
| `pnpm audit` / `audit:fix`     | Report / fix known dependency vulnerabilities                  |
| `pnpm deps:outdated`           | List dependencies with newer versions available                |
| `pnpm deps:update`             | Update dependencies within their semver ranges                 |
| `pnpm deps:update:latest`      | Update dependencies to the latest versions (may break)         |

### Developer workflow

A typical change runs through these scripts in order. The whole loop is just two
composite commands — `pnpm fix` to clean up, `pnpm check` to verify.

1. **Start the dev server** and make your change:

   ```bash
   pnpm dev          # http://localhost:4321, hot-reloads as you edit
   ```

2. **Write or update tests** and watch them as you go:

   ```bash
   pnpm test:watch   # re-runs the affected tests on every save
   ```

3. **Auto-clean before you commit** — formats code and applies safe lint fixes:

   ```bash
   pnpm fix          # = lint:fix + format
   ```

4. **Run the local gate:**

   ```bash
   pnpm check        # = typecheck + lint + format:check + test
   ```

   If `check` fails on formatting, run `pnpm fix` and re-run. If it fails on a
   type or lint error, fix it by hand — `fix` won't resolve those.

5. **Docs touched?** Markdown has its own lint pass (also part of CI):

   ```bash
   pnpm lint:md:fix  # autofix, then pnpm lint:md to confirm clean
   ```

6. **Dependency hygiene** (periodic, not every change):

   ```bash
   pnpm deps:outdated   # see what's behind
   pnpm deps:update     # bump within semver ranges
   pnpm audit           # check for known vulnerabilities
   ```

> **Note:** `pnpm check` is a _subset_ of CI. The CI workflow
> (`.github/workflows/ci.yml`) runs each step individually and adds two more:
> `lint:md` and `build`. The full CI sequence is:
>
> ```text
> typecheck → lint → lint:md → format:check → test → build
> ```
>
> `pnpm audit` is **not** in the per-push gate — it runs weekly (and on demand)
> in [`security.yml`](../.github/workflows/security.yml), so a freshly-published
> advisory can't fail an unrelated PR.
>
> **Rule of thumb:** `pnpm fix && pnpm check && pnpm lint:md && pnpm build`
> before pushing mirrors CI closely. If those pass, the pipeline should too.

### Local production-style run

```bash
pnpm build
pnpm server
```

## Architecture Overview

- **Single-origin server** (`server/`): Serves `dist/` and relays WebRTC SDP/ICE over `/signaling`. Not involved in game state.
- **Seed cog** (`cogs/battleship/`): Alternative to the Node server for Cognitum One Seed devices. Embeds the frontend as a static binary, replaces WebSocket signaling with HTTP long-poll. Build with `cross build --release --target armv6-unknown-linux-musleabihf`. See [ADR-001](adr/ADR-001-cognitum-seed-cog.md) for the design rationale.
- **Dual-mode frontend**: `game.astro` selects the signaling adapter at build time via `COG_MODE`. Standard builds (`pnpm build`) load `webrtc.js` (WebSocket). Cog builds (`build.rs` sets `COG_MODE=true`) load `webrtc-cog.js` (HTTP polling).
- **Client**: Pure HTML/CSS/JS — Astro pages deliver static assets; all game logic runs in the browser via ESM modules over `/scripts/`.
- **WebRTC**: P2P data channel carries all game messages after handshake.
- **Game engine**: Server-authoritative model is avoided; both peers maintain independent board state synced via P2P resolution batch messages.

## Building for Production

```bash
pnpm install  # ensures pnpm-lock.yaml generated
pnpm build    # outputs to dist/
```

The `dist/` directory contains the static site. For multiplayer, serve it with `server/index.mjs` or deploy the static assets with a WebSocket-capable signaling service exposed on the same origin at `/signaling`.

## Testing

### Manual testing workflow

1. Build the site: `pnpm build`
2. Start the single-origin server: `pnpm server`
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

## Building the Seed Cog

```bash
# Add cross-compile target (one time)
rustup target add armv6-unknown-linux-musleabihf
cargo install cross

# Build for Pi Zero 2W (build.rs runs pnpm build automatically)
cross build --manifest-path cogs/battleship/Cargo.toml \
            --release \
            --target armv6-unknown-linux-musleabihf

# Check without cross-compiling (fast — uses host target)
cargo check --manifest-path cogs/battleship/Cargo.toml
```

The `build.rs` script runs `pnpm build` with `COG_MODE=true COG_TOKEN=__COG_TOKEN__`
so the embedded HTML contains the cog-mode meta tags and the `__COG_TOKEN__` placeholder.
`main.rs` replaces the placeholder with the real `COGNITUM_COG_TOKEN` at startup.

## Release Checklist

1. Run full manual test flow (above)
2. Verify `pnpm build` produces clean `dist/`
3. Verify `cargo check --manifest-path cogs/battleship/Cargo.toml` passes
4. Update `CHANGELOG.md` with version and changes
5. Tag release: `git tag -a vX.Y.Z -m "Release vX.Y.Z"`
6. Push tags: `git push --tags`

# Deploying

**For:** anyone putting Battleship P2P on a real web address so people can visit it directly
— no tunnel, no shared codes to start. Comfortable with a terminal assumed.

> Just want to invite a few friends right now? A tunnel is faster — see
> **[Hosting a game](HOSTING.md)**. Deploying is for a permanent, public install.

## What a deployment needs

Battleship has two pieces, and multiplayer needs **both on the same origin** (same
protocol + host + port):

1. **The static site** — the built game in `dist/`. Plain files; any static host serves them.
2. **The signaling endpoint** — introduces the two browsers to each other. In the standard
   deployment this is a WebSocket at **`/signaling`**; in the Seed deployment it's an HTTP
   long-poll API inside a self-contained Rust binary.

```
https://your-domain/            →  static files from dist/
https://your-domain/signaling   →  signaling (WebSocket or HTTP long-poll)
```

> ⚠️ **Static-only hosting isn't enough by itself.** If you deploy only `dist/`, the game
> page loads but players can't connect. You need a signaling service on the **same origin**.

## Build it

```bash
pnpm install     # generates pnpm-lock.yaml on first run
pnpm build       # outputs the static site to dist/
```

## Option A — one process serves everything (simplest)

`server/index.mjs` serves the static `dist/` **and** the `/signaling` WebSocket on a single
port. Run it anywhere that runs Node and allows WebSockets (a VPS, a container, a PaaS):

```bash
pnpm build
pnpm server      # serves dist/ + /signaling on port 4321
```

Configure with environment variables:

| Variable   | Default | Purpose                        |
| ---------- | ------- | ------------------------------ |
| `PORT`     | `4321`  | Port to listen on.             |
| `DIST_DIR` | `dist`  | Path to the built static site. |

Put a reverse proxy (nginx, Caddy, your platform's router) in front for TLS and your domain,
and make sure it **forwards WebSocket upgrades** to `/signaling`. A health check is available
at `/healthz` (returns `ok`).

This is the recommended path for VPS / container / Fly.io / Render / Railway-style hosts.

## Option B — split static host + signaling service

Host the static `dist/` on a CDN/static platform, and run the signaling separately — **as
long as `/signaling` resolves to the same origin** the browser loaded the page from. The
client derives the signaling URL from the page origin: load `https://example.com`, and it
connects to `wss://example.com/signaling`. If signaling lives elsewhere, route
`/signaling` to it at the edge (proxy/redirect rule) so the origins match.

| Platform                | Static `dist/`             | Signaling `/signaling`                                                      |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------- |
| **GitHub Pages**        | ✅ via the included CI     | ❌ no WebSockets — pair with an external signaling host + proxy             |
| **Netlify / Vercel**    | ✅ build cmd `pnpm build`  | Needs a WebSocket-capable function/service routed at `/signaling`           |
| **Cloudflare Pages**    | ✅ same build command      | Use a Worker/Durable Object or external service at `/signaling`             |
| **S3 + CloudFront**     | ✅ upload `dist/`          | Route `/signaling` to a WebSocket origin (e.g. an EC2/Fargate Node process) |
| **Any VPS / container** | ✅ served by `pnpm server` | ✅ same process (this is Option A)                                          |

> If WebSocket signaling on your static platform is awkward, the path of least resistance is
> **Option A** on a small Node host, with your static platform (if any) proxying `/signaling`
> to it.

## Option C — Cognitum One Seed

A Seed device (Raspberry Pi Zero 2W running Cognitum OS) runs a single self-contained
Rust binary — `cog-battleship` — that embeds the entire frontend and replaces the
Node.js signaling server with an HTTP long-poll API. No Node.js on the device.
No WebSocket proxy configuration. The Seed agent handles reverse-proxying.

```bash
# Build the cog for Pi Zero 2W (runs pnpm build automatically)
cross build --manifest-path cogs/battleship/Cargo.toml \
            --release \
            --target armv6-unknown-linux-musleabihf

# Copy binary and manifest to the device, then:
cog install ~/cogs/battleship/cog.toml
cog start battleship
```

The game URL comes from the Seed dashboard. Players open it and play identically to
any other deployment — the long-poll/WebSocket distinction is invisible to them.

> This is the only deployment option that requires a Rust toolchain to build.
> See the **[Seed guide](SEED.md)** for the full walkthrough, prerequisites, and
> troubleshooting.

---

## How the pieces fit

- **No game server logic.** Both browsers keep their own game state and sync directly over a
  WebRTC data channel. The server you deploy only relays the initial WebRTC handshake
  (SDP/ICE) and never sees a move.
- **Signaling is short-lived.** Rooms are cleaned up after about 60 seconds of inactivity,
  and an unjoined game code expires after 30 seconds.
- **Same-origin requirement** exists because the browser builds the `wss://…/signaling` URL
  from whatever origin served the page. Keep them identical and everything connects.

For architecture internals, code layout, and the release process, see the
**[Maintainer Guide](MAINTAINERS.md)**.

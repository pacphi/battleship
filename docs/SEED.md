# Hosting on a Cognitum One Seed

**For:** someone who has a Cognitum One Seed device and wants to run Battleship on it
— so anyone on the same network (or through the Seed agent's public URL) can play
without you keeping a laptop open.

> **Just want to play from a laptop?** You don't need a Seed. See
> **[Hosting a game](HOSTING.md)** for the tunnel-based path.

---

## What this does

The Seed cog is a self-contained Rust binary. It embeds the entire game — HTML, CSS,
and JavaScript — and replaces the Node.js signaling server with an HTTP long-poll API
the Seed agent can proxy. No Node.js on the device, no WebSocket configuration, no
separate static host.

```
Player A's browser ──┐
                     ├──► Seed agent (public URL)
Player B's browser ──┘            │
                         http://127.0.0.1:8073
                     (cog-battleship binary on device)
                                   │
                  direct browser-to-browser WebRTC ──► all game moves
```

Once both players have connected, game moves go **directly between browsers** — the
device only handles the initial handshake.

---

## Prerequisites

| Tool | What you need | Notes |
|------|--------------|-------|
| **Rust** | stable toolchain | `curl https://sh.rustup.rs \| sh` |
| **Cross-compile target** | `armv6-unknown-linux-musleabihf` | `rustup target add armv6-unknown-linux-musleabihf` |
| **musl cross-linker** | `cross` (recommended) or `arm-linux-musleabihf-gcc` | `cargo install cross` |
| **pnpm** | ≥ 11 | Required by the Cargo build script to build the frontend |
| **A Seed device** | Pi Zero 2W with Cognitum OS | With `cog` CLI available |

> **`cross` vs. a native linker:** `cross` uses Docker to handle the musl toolchain
> automatically and is the simplest option on macOS and Linux. If you're on a Linux
> host and prefer a native toolchain, install `gcc-arm-linux-gnueabihf` and configure
> `.cargo/config.toml` accordingly.

---

## Build the cog

From the repo root:

```bash
# Build frontend assets + Rust binary for Pi Zero 2W
cross build --manifest-path cogs/battleship/Cargo.toml \
            --release \
            --target armv6-unknown-linux-musleabihf
```

`build.rs` runs `pnpm build` automatically (with `COG_MODE=true`) if `dist/` is
absent or stale. The compiled binary lands at:

```
cogs/battleship/target/armv6-unknown-linux-musleabihf/release/cog-battleship
```

Name it per the cog convention before copying it to the device:

```bash
cp cogs/battleship/target/armv6-unknown-linux-musleabihf/release/cog-battleship \
   cog-battleship-arm
```

---

## Deploy to the device

Copy the binary and the cog manifest:

```bash
scp cog-battleship-arm          user@seed-device:~/cogs/battleship/
scp cogs/battleship/cog.toml    user@seed-device:~/cogs/battleship/
```

On the device, make the binary executable:

```bash
chmod +x ~/cogs/battleship/cog-battleship-arm
```

---

## Register and start

The Seed agent manages cog lifecycle. Register it once:

```bash
cog install ~/cogs/battleship/cog.toml
```

The agent reads `COGNITUM_COG_TOKEN` from the environment it maintains for the cog.
You don't set this yourself — the agent generates and injects it. Starting the cog:

```bash
cog start battleship
```

Check it's running:

```bash
cog status battleship
```

The game is now available at the Seed agent's public URL. You'll see it listed in the
Seed dashboard.

---

## How to play

Playing is identical to any other hosting method. See **[Playing the Game](PLAYING.md)**.

The only difference: instead of a tunnel link, your players open the URL from your Seed
dashboard. The 6-character code workflow, game modes, and controls are all the same.

---

## Environment variables (advanced)

The cog binary reads these at startup. The Seed agent sets `COGNITUM_COG_TOKEN`
automatically; the others are optional overrides:

| Variable | Default | Purpose |
|---|---|---|
| `COGNITUM_COG_TOKEN` | (required, set by agent) | Bearer token for authenticated endpoints |
| `COG_PORT` | `8073` | Port to bind on loopback |
| `COG_POLL_TIMEOUT_MS` | `20000` | Max milliseconds a poll request blocks |
| `COG_MAX_ROOMS` | `256` | Max concurrent signaling rooms |

---

## If something goes wrong

| Problem | What to do |
|---|---|
| `cross build` fails with linker error | Run `cross doctor` to check Docker is running |
| `pnpm build` fails inside the Rust build | Run `pnpm build` manually from the repo root to see the Astro error |
| `cog status` shows the cog crashed | Check `cog logs battleship` — the most likely cause is `COGNITUM_COG_TOKEN` not set |
| Players get 401 on every request | The browser token doesn't match the runtime token — rebuild: the placeholder substitution requires a fresh binary start |
| WebRTC handshake hangs | Some networks block STUN servers (`stun.l.google.com:19302`). Try a different network. |
| Game works locally but not for remote players | Confirm the Seed agent is exposing port 8073 and the public URL is reachable |

---

## How the signaling differs from the standard server

The standard `server/index.mjs` uses a WebSocket at `/signaling`. The Seed cog uses
HTTP long-poll instead, because the Seed agent proxy doesn't support WebSocket
upgrades. The browser automatically uses the long-poll adapter when the page is served
with the `cog-mode` meta tag — no configuration needed.

Once the WebRTC DataChannel opens, all gameplay is P2P and the cog is no longer
involved. Signaling is only needed for the ~10 messages that establish the connection.

For the architectural rationale, see **[ADR-001](adr/ADR-001-cognitum-seed-cog.md)**.

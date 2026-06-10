# ADR-001: Cognitum One Seed Cog for Battleship

**Status:** Accepted  
**Date:** 2026-06-10  
**Branch:** cognitum-one-distro

---

## Context

The battleship game is an Astro static site with a Node.js WebSocket signaling server (`server/index.mjs`). Two players establish a WebRTC peer-to-peer DataChannel for gameplay; the server only mediates the WebRTC handshake (SDP offer/answer and ICE candidate exchange).

Cognitum One Seed devices run cogs — self-contained Rust binaries that bind a loopback HTTP port. The Seed agent reverse-proxies HTTP to them but **does not support WebSocket upgrades**. The goal is to package the game as a cog so it can run on a Pi Zero 2W Seed device while also continuing to run standalone (dev/hosting) without modification.

---

## Decision

### 1. HTTP long-poll replaces WebSocket signaling

The existing `ws://host/signaling` endpoint is replaced with a REST + long-poll API served by the Rust cog:

| Endpoint                                  | Auth   | Purpose                                 |
| ----------------------------------------- | ------ | --------------------------------------- |
| `POST /signal/create`                     | paired | Host creates room → `{"code":"abc123"}` |
| `POST /signal/{code}/join`                | paired | Guest joins room                        |
| `POST /signal/{code}/push`                | paired | Push SDP/ICE message                    |
| `GET /signal/{code}/poll?seq=N`           | paired | Long-poll for messages after seq N      |
| `POST /signal/{code}/leave`               | paired | Tear down room                          |
| `GET /`, `/game`, `/scripts/*`, `/health` | open   | Static assets + liveness                |

Poll blocks up to 20 s on a `Condvar`; returns HTTP 204 on timeout, 200 + JSON array on messages. This faithfully replaces WebSocket push semantics for the thin signaling phase (tens of messages, not a stream).

### 2. Dual-mode browser client

A new `src/scripts/webrtc-cog.js` provides `CogSignalingManager`, a drop-in replacement for the existing `WebRTCManager`. `game.astro` selects the implementation at **build time** via `COG_MODE`:

- `COG_MODE` unset → `import('/scripts/webrtc.js')` (WebSocket, existing behaviour)
- `COG_MODE=true` → `import('/scripts/webrtc-cog.js')` (HTTP polling)

All four module imports (`webrtc`, `game`, `renderer`, `game-flow`) are **dynamic** (`await Promise.all([...])`) to avoid the invalid-syntax constraint of static `import` declarations after `await` expressions in a module script.

### 3. Runtime token injection via build-time placeholder

The Seed agent assigns `COGNITUM_COG_TOKEN` at device setup — the value is not known when `pnpm build` runs. The cog build pipeline therefore uses a two-step substitution:

1. `build.rs` invokes `pnpm build` with `COG_MODE=true COG_TOKEN=__COG_TOKEN__`, baking the literal string `__COG_TOKEN__` into the `<meta name="cog-token">` tag in the embedded HTML.
2. At cog startup, `main.rs` reads the real `COGNITUM_COG_TOKEN` from the environment and performs an in-memory `str::replace("__COG_TOKEN__", &token)` on the HTML bytes before storing them in an `Arc<Vec<u8>>`. Every subsequent HTML serve is a zero-copy clone of that buffer.

This means the cog binary is token-agnostic; any Seed device can run the same artifact.

### 4. Asset embedding via `build.rs` + `include_bytes!` (OUT_DIR)

`build.rs` walks `dist/` after the pnpm build and generates `$OUT_DIR/assets.rs` containing a `get_asset(path) -> Option<(&'static str, &'static [u8])>` match table using `include_bytes!` with absolute paths. The cog binary is fully self-contained — no filesystem access at runtime.

Generated files go to `$OUT_DIR` (not `src/`) to follow Cargo conventions and avoid polluting the source tree.

### 5. CSPRNG room codes

Room codes are generated with `getrandom::getrandom` (3 bytes → 6 hex chars, ~16M combinations). The previous implementation used `SystemTime::subsec_nanos() XOR pid`, which was deterministic and brute-forceable. While room codes are not cryptographic secrets, predictable codes allow session hijacking during the signaling window.

### 6. Bearer token auth via `subtle::ConstantTimeEq`

All `/signal/*` endpoints require `Authorization: Bearer <token>`. The comparison uses `subtle::ConstantTimeEq` to prevent timing oracle attacks. Open endpoints (`/`, `/game`, `/scripts/*`, `/health`) are handled before the auth gate.

---

## Consequences

### Positive

- The same `pnpm build` output (without `COG_MODE`) continues to work with the existing Node.js server and WebSocket signaling — no regression for standalone hosting.
- The cog binary is a single self-contained artifact with no Node.js or pnpm runtime dependency on the Seed device.
- HTTP long-poll over the Seed agent's reverse-proxy is functionally equivalent to WebSocket for the ~10 signaling messages exchanged during WebRTC handshake; once the DataChannel opens, all gameplay is P2P and the signaling channel is idle.
- Token injection at runtime means the same compiled binary can be deployed to any Seed device regardless of its token.

### Negative / Trade-offs

- Two build modes must be maintained (`COG_MODE` on/off). The cog build must be triggered explicitly; it is not the default `pnpm build`.
- The `pnpm build` step is embedded in Rust's `build.rs`, coupling the Cargo build to a Node.js toolchain. CI must have both `cargo` and `pnpm` available when building the cog.
- HTTP long-poll introduces up to 20 s of latency for `opponent-disconnected` delivery if the disconnect happens between polls. The existing WebSocket connection detected drops immediately. This is acceptable for a casual game.
- Rooms are in-memory only; a cog restart during an active signaling session requires both players to restart. This matches the existing server behaviour.

---

## Alternatives Considered

**Server-Sent Events (SSE):** SSE is HTTP/1.1 chunked streaming, which may or may not be supported by the Seed agent proxy. Long-poll has more predictable proxy compatibility. Rejected in favour of long-poll.

**WebSocket via a sidecar process:** Run the existing `server/index.mjs` as a child process from the cog binary. Rejected — requires Node.js on the device, increases binary complexity, and doesn't solve the proxy constraint.

**Static file serving only (no signaling):** Use an external signaling service (e.g. a public STUN/TURN + signaling relay). Rejected — requires external network connectivity and doesn't work offline.

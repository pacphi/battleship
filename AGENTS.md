# AGENTS.md

Instructions for coding agents working in this repo. `docs/MAINTAINERS.md` has the full setup and command
reference; `docs/adr/ADR-001-cognitum-seed-cog.md` explains the Seed cog. This file holds the rules.

## What this is

Battleship P2P: a browser Battleship game. An Astro static site plus vanilla JS; players connect browser to browser over
WebRTC. A small server only does signaling. The same game also ships as a Rust "cog" for a Cognitum One Seed device
(`cogs/battleship/`).

- `src/pages/` Astro pages (`index.astro`, `game.astro`).
- `src/scripts/` client modules: `board.js`, `game.js` (state machine), `game-flow.js` (round, queue and hybrid
  modes), `renderer.js` (canvas), `webrtc.js` (WebSocket signaling), `webrtc-cog.js` (HTTP long-poll signaling).
- `server/index.mjs` serves `dist/` and WebSocket signaling on `/signaling`, port 4321.
- `cogs/battleship/` the Rust cog: HTTP long-poll signaling, assets embedded from `dist/` by `build.rs`.
- `tests/` and `src/scripts/*.test.js` Vitest (jsdom); `cogs/battleship/tests/` Rust integration tests.

## Toolchain

- Node 26 (even-numbered, `.node-version`) and pnpm 11 (`packageManager` pins `pnpm@11.28.6`). Use pnpm only;
  `preinstall` rejects npm and yarn. Do not edit `pnpm-lock.yaml` by hand.
- Install scripts are blocked by default. `esbuild` and `sharp` are allowed in `package.json` `approvedBuilds` and in
  `pnpm-workspace.yaml` `allowBuilds`. Keep the two lists identical, and add a package to both only when it truly
  needs a build script.
- Rust (stable) is needed only for the cog. The release workflow builds it for armv6 with `cross`.

## Before you push

Run `pnpm fix`, then `pnpm check` (typecheck, lint, format check, tests). CI also runs `pnpm run lint:md` and
`pnpm run build`, and a `cargo check --tests` job for the cog, so run those when you touch docs, the build, or
anything under `cogs/`. A frozen lockfile install must pass: `pnpm install --frozen-lockfile`.

- Prettier is the formatter (single quotes, semicolons, print width 100, the Astro plugin). Do not hand-format.
- Markdown follows `.markdownlint.json`. Tables are not aligned by Prettier, so do not realign them.

## Rules that are easy to break

- **Game data stays peer to peer.** The server and the cog only exchange signaling (SDP and ICE) and hold room state.
  Never add game logic, shot data or player state to either.
- **Two signaling clients, one interface.** `webrtc.js` and `webrtc-cog.js` are interchangeable; `game.astro` picks one at
  build time with `COG_MODE`. A change to one needs the matching change in the other. Keep the `import()` calls in
  `game.astro` dynamic (ADR-001 section 2).
- **The cog binary is token-agnostic.** `build.rs` bakes the literal `__COG_TOKEN__` into the page; `main.rs` swaps in
  `COGNITUM_COG_TOKEN` at startup. Never build a real token into `dist/` or commit one.
- **Cog auth.** Every `/signal/*` route needs `Authorization: Bearer <token>`, compared with `subtle::ConstantTimeEq`.
  Open routes (`/`, `/game`, `/scripts/*`, `/health`) are handled before the auth gate. Do not widen the open set, and
  keep `bind_loopback_only = true` in `cog.toml`.
- **Room codes come from a CSPRNG** (`getrandom` in the cog, `crypto.randomBytes` in `server/index.mjs`). Do not
  replace them with anything predictable.
- **Special ships are rules, not decoration.** The submarine is hidden until its first hit and the torpedo boat shifts after
  a miss. Changes to `board.js` or `game.js` need tests in the matching `*.test.js`.

## Dependencies and CI

- Renovate opens dependency PRs with a 3-day release-age gate. Do not bypass the gate, and take majors deliberately.
- `pnpm audit` runs weekly in `security.yml` and on demand, not on every PR. A red run means triage the advisory.
- Workflow actions are pinned by version tag, so bump them through Renovate, not by hand.

## Commits and releases

- Commit subjects follow `type(scope): summary` (`feat`, `fix`, `chore`, `docs`), as in the history. No
  `Co-Authored-By` trailer unless asked.
- Record user-visible changes in `CHANGELOG.md` under `[Unreleased]`.
- A `v*` tag triggers `release.yml`: the web zip, the armv6 cog and a GitHub release. Tag only a commit whose CI is green.

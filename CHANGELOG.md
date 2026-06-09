# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- pnpm packageManager pinning (≥ 11)
- Node.js ≥ 26 engine requirement
- Corepack-based toolchain management via `.tool-versions`
- GitHub Actions CI workflow (Node 26 + pnpm build verification)
- GitHub Actions Release workflow (tagged builds → zip artifact download)
- Maintainer documentation (`docs/MAINTAINERS.md`)
- User guide and release documentation (`docs/USER-GUIDE.md`)

### Changed
- Migrated from npm to pnpm (see `docs/MAINTAINERS.md` for local setup)
- Added `.gitignore` to exclude build artifacts, dependencies, and IDE files

---

## [v0.1.0] — Initial Release

### Added
- Astro static site with two pages: landing + game
- WebSocket signaling server (SDP/ICE relay, room management)
- WebRTC P2P connection manager
- Board model: 12×12 grid, 6 ship types, random placement, hit/miss logic
- Game engine: round-based / queue-based / hybrid flow modes
- HTML5 Canvas rendering engine (ships, grid, hit/miss animations)
- Landing page with mode selection and create/join game flow
- Three game flow modes (round, queue, hybrid) with timers
- P2P reconnect detection and visual polish (shake, pulse, slide-in animations)

---

_Versions follow [Semantic Versioning](https://semver.org/)._

#!/usr/bin/env bash
# shellcheck disable=SC2034,SC2154
#
# tunnel-setup.sh — Interactive LAN-party tunneling setup for macOS & Linux
#
# Prompts you to choose a provider (ngrok or zrok), checks if the CLI is
# installed, offers to install it via mise (preferred) or Homebrew, then walks
# you through account setup and tunnel creation step by step.
#
# Color coding : Green = success  |  Red = failure / error  |  Yellow = warning

set -euo pipefail
cd "$(dirname "$0")/.."   # cd to the repo root

# ── colours (256-colour terminals + fallback) ──────────────────────────────
if [ -t 1 ]; then               # only emit codes when writing to a terminal
  GREEN=$'\e[32m'
  RED=$'\e[31m'
  YELLOW=$'\e[33m'
  BLUE=$'\e[34m'
  BOLD=$'\e[1m'
  DIM=$'\e[2m'
  RESET=$'\e[0m'
else
  GREEN="" ; RED="" ; YELLOW="" ; BLUE="" ; BOLD="" ; DIM="" ; RESET=""
fi

# ── helpers ─────────────────────────────────────────────────────────────────
ok()   { echo "${GREEN}✓ $*${RESET}"; }
err()  { echo "${RED}✗ $*${RESET}" >&2; }
warn() { echo "${YELLOW}! $*${RESET}"; }
info() { echo "${BLUE}→ $*${RESET}"; }
sep()  { echo -e "${DIM}─── $* ───${RESET}"; }

prompt() { echo -en "${BOLD}$* ${RESET}"; read -r; }   # inline reader
yn_prompt() {
  echo -ne "${BOLD}$* [Y/n] ${RESET}"
  read -r ans
  case "$ans" in [nN][oO]|[nN]) return 1;; esac    # false means "no"
}

# ── platform detection ──────────────────────────────────────────────────────
PLATFORM="unknown"
if [[ "$OSTYPE" == darwin* ]]; then   PLATFORM="macos"
elif [[ "$OSTYPE" == linux-gnu* ]]; then PLATFORM="linux"
fi

has_cmd() { command -v "$1" &>/dev/null; }

# ── 0  WELCOME ──────────────────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
echo -e "${BOLD}    🎯 Battleship P2P — LAN Tunnel Setup${RESET}"
echo ""
info "This helper walks you through setting up a tunnel so friends on your LAN"
info "can open the game in their browser and connect peer-to-peer."
echo ""

# ── 1  Pick a provider ─────────────────────────────────────────────────────
sep "Step 1 of 5 — Choose a tunnel provider"
echo ""
echo -e "  ${BOLD}ngrok${RESET}     ${DIM}Quickest to start. Free tier gives a random URL that changes"
echo -e "             each session. No install needed (uses \`npx\`) but you can"
echo -e "             install the CLI for a persistent domain."
echo ""
echo -e "  ${BOLD}zrok${RESET}      ${DIM}Open-source & free. Creates stable long-lived tunnels under a"
echo -e "             shared frontend domain. Best for multi-day LAN events."
echo ""
prompt "Which provider do you want?  (1 = ngrok, 2 = zrok) : "

case "$REPLY" in
  1|ngrok|NGROK) PROVIDER="ngrok";;
  2|zrok|ZROK)   PROVIDER="zrok";;
  *)
    err "Unrecognized input '${REPLY}'. Expected 1 or 2."
    exit 1;;
esac
ok "You chose: ${BOLD}$PROVIDER${RESET}"
echo ""

# ── 2  Check CLI ────────────────────────────────────────────────────────────
sep "Step 2 of 5 — Is the $PROVIDER CLI installed?"
CLI_NAME="${PROVIDER}"          # ngrok → ngrok, zrok → zrok

if has_cmd "$CLI_NAME"; then
  ok "$CLI_NAME is installed ($(which "$CLI_NAME"))"
  prompt "Keep it? (Y/n) : "
  case "${REPLY:-Y}" in [nN][oO]|[nN]) want_install=true;; *) want_install=false;; esac
else
  warn "$BOLD$CLI_NAME${RESET} was NOT found on your system."
fi

if [[ "${want_install:-true}" == true ]]; then
  echo ""
  # ── detect install tool ───────────────────────────────────────────────
  echo "We'll use one of these to install $CLI_NAME:"
  echo ""

  # macOS / Linux: mise > homebrew
  if [[ "$PLATFORM" != "linux" ]] && has_cmd brew; then
    echo -e "  ${BOLD}Homebrew${RESET}       — the macOS package manager"
    info "detected Homebrew at $(which brew)"
  fi
  if has_cmd mise; then
    info "detected mise at $(which mise)"
    echo ""
    info "${DIM}(mise is preferred over Homebrew when both are available)${RESET}"
  fi

  # Windows: winget > scoop   (handled later if detected as windows)

  echo ""

  want_install=false
  prompt "Do you want us to install $CLI_NAME now? (Y/n) : "
  case "${REPLY:-Y}" in [nN][oO]|[nN]) want_install=false;; *) want_install=true;; esac

  if [[ "$want_install" == true ]]; then
    echo ""
    sep "Installing $PROVIDER CLI"

    installed=false

    # ── mise (preferred) ────────────────────────────────────────────────
    if has_cmd mise; then
      info "Using mise to install..."
      if mise install "$CLI_NAME"; then
        ok "$CLI_NAME installed by mise at $(mise which "$CLI_NAME" 2>/dev/null || echo '<unknown>')"
        # Ensure the mise shims directory is in PATH for this session
        if [[ -d "${HOME}/.local/share/mise/shims" ]] && [[ ":$PATH:" != *":${HOME}/.local/share/mise/shims:"* ]]; then
          export PATH="${HOME}/.local/share/mise/shims:$PATH"
        fi
        installed=true
      else
        warn "mise install failed — trying next option…"
      fi
    fi

    # ── Homebrew (fallback) ─────────────────────────────────────────────
    if [[ "$installed" != true ]] && has_cmd brew; then
      info "Using Homebrew to install..."
      case "$CLI_NAME" in
        ngrok)
          FORMULA="ngrok/ngrok/ngrok" ;;
        zrok)
          FORMULA="openz.zone/zrok" ;;
        *)
          FORMULA="$CLI_NAME" ;;
      esac
      if brew install "$FORMULA"; then
        ok "$CLI_NAME installed by Homebrew at $(which "$CLI_NAME")"
        installed=true
      else
        warn "Homebrew install failed — see errors above."
      fi
    fi

    # ── generic apt/dnf fallback for zrok on Linux when nothing worked ──
    if [[ "$installed" != true ]] && [[ "$PLATFORM" == "linux" ]]; then
      warn "No package manager succeeded. You may need to download the binary manually."
      info "Go to https://ngrok.com/download or https://github.com/openzzone/zrok/releases"
    fi

    # Re-check after install
    if has_cmd "$CLI_NAME"; then
      ok "Great — $CLI_NAME is now available. Version: $( "$CLI_NAME" --version 2>/dev/null || echo 'unknown' )"
    else
      err "$CLI_NAME still not found after install. Please try installing it manually."
      exit 1
    fi
    echo ""
  fi

fi  # end CLI / install block

# ── 3  Account setup ────────────────────────────────────────────────────────
sep "Step 3 of 5 — Set up your account"

case "$PROVIDER" in
  ngrok)
    info "ngrok needs an (free) account for a persistent auth token."
    echo ""
    info "1. Go to https://ngrok.com and sign up (takes ~30 seconds)"
    echo "2. After logging in, go to your dashboard: https://dashboard.ngrok.com/get-started/your-authtoken"
    echo "3. Copy the 'Authtoken' value (looks like a long alphanumeric string)"
    echo ""

    if prompt "Paste your ngrok Authtoken here (or press Enter to skip for now) : "; then
      if [[ -n "$REPLY" ]]; then
        ngrok config add-authtoken "$REPLY" 2>/dev/null || \
          err "Could not save token. Please run manually:"
        if [[ $? -eq 0 ]] 2>/dev/null; then
          ok "ngrok authtoken saved."
        fi
      else
        warn "Skipping — you can set it later with: ngrok config add-authtoken <token>"
      fi
    fi
    echo ""

    # Quick test
    if has_cmd ngrok && ngrok version &>/dev/null; then
      info "Quick check — your ngrok status:"
      ngrok version 2>/dev/null || true
    fi
    ;;

  zrok)
    info "zrok requires a free account invite code (you get one at signup)."
    echo ""
    info "1. Go to https://app.zrok.io/register and create your free account"
    echo "2. Check your email for the 'invite accept' link"
    echo "3. Click the link — it will give you an invite code like: ZRxxxxx"
    echo ""

    prompt "Paste your zrok invite code here (or press Enter to skip) : "
    if [[ -n "${REPLY:-}" ]]; then
      if zrok invite accept "$REPLY" 2>/dev/null; then
        ok "zrok account linked."
      else
        warn "Could not accept invite. You may need to run:"
        echo "   zrok invite accept <your-invite-code>"
      fi
    else
      warn "Skipping — you can set it later with: zrok invite accept <code>"
    fi
    echo ""
    ;;
esac

# ── 4  Start the build server ───────────────────────────────────────────────
sep "Step 4 of 5 — Build & start the game"

info "Before creating a tunnel, let's make sure the game is built and running."
echo ""

if [[ ! -d "dist" ]]; then
  warn "No 'dist/' directory found. We'll build the site first."
  if has_cmd pnpm; then
    pnpm build
  elif has_cmd npm; then
    npm run build
  else
    err "Neither pnpm nor npm found. Please build the site manually before continuing."
    exit 1
  fi
  ok "Build complete!"
else
  ok "dist/ directory already exists."
fi

echo ""
info "Starting the game server on port 4321…"
info "(press Ctrl+C later to stop it — don't close this terminal)"
echo ""

# Start the Astro dev server in the background, capture its PID
if has_cmd pnpm; then
  pnpm dev --port 4321 &
elif has_cmd npm; then
  npm run dev -- --port 4321 &
fi
DEV_PID=$!
ok "Game server started (PID $DEV_PID) on http://localhost:4321"
echo ""

# ── 5  Create the tunnel ────────────────────────────────────────────────────
sep "Step 5 of 5 — Open your tunnels"

echo -e "${BOLD}We need TWO tunnels under the SAME hostname:${RESET}"
echo ""
echo -e "  ${GREEN}Tunnel 1${RESET}  → Static game site (port 4321)"
echo -e "  ${GREEN}Tunnel 2${RESET}  → Signaling server   (port 3001)"
echo ""
info "Open TWO new terminal windows/terminals. We'll show you the commands."
echo ""

case "$PROVIDER" in
  ngrok)
    echo -e "${BOLD}Terminal 1 — tunnel for the game site:${RESET}"
    info 'Run: ngrok http 4321'
    echo ""
    info "Copy the forwarding URL (starts with https:// … .ngrok-free.app)"
    echo ""

    prompt "Paste the URL you got above to verify Terminal 2 will use the same domain : "
    TUNNEL_URL="$REPLY"

    echo ""
    echo -e "${BOLD}Terminal 2 — tunnel for the signaling server:${RESET}"
    # ngrok multi-port HTTP is free; TCP on a shared domain needs the paid plan,
    # so we use the free multi-port approach.
    if [[ "$TUNNEL_URL" == *"ngrok"* ]]; then
      DOMAIN="${TUNNEL_URL#https://}"
      DOMAIN="${DOMAIN%%/*}"
      info "Copy these commands into Terminal 2:"
      echo ""
      echo -e "  ${BOLD}Option A — single ngrok process with both ports:${RESET}"
      echo "    ngrok http http://localhost:4321,http://localhost:3001"
      echo ""
      echo -e "  ${BOLD}Option B — if you want separate control of each tunnel:${RESET}"
      echo "    # This uses the same domain as Terminal 1 (auto-discovered)"
      echo "    ngrok http 3001 --domain $(echo "$DOMAIN" | sed 's/-[a-f0-9]*$//')"
      echo ""
      warn "Note: If Option B shows a domain mismatch, use Option A instead."
    else
      warn "Could not parse the ngrok URL. Manually point both services under"
      warn "the same ngrok dashboard domain."
    fi
    ;;

  zrok)
    echo -e "${BOLD}Terminal 1 — tunnel for the game site:${RESET}"
    info 'Run: zrok share exposed dist http://localhost:4321'
    echo ""
    info "Copy the shared URL it outputs (starts with https:// … .zrok.io)"
    echo ""

    prompt "Paste the zrok public forwarding URL to continue : "
    ZROK_URL="$REPLY"

    if [[ -n "$ZROK_URL" ]]; then
      # Strip trailing slashes and extract the base address for tunnel 2
      ZROK_BASE="${ZROK_URL%/}"
      # The --address flag pins both tunnels to the same frontend domain
      echo ""
      echo -e "${BOLD}Terminal 2 — tunnel for the signaling server:${RESET}"
      info "Copy this command into Terminal 2 (use the URL you just pasted):"
      echo ""
      echo "    zrok share exposed server/index.mjs http://localhost:3001 \\"
      echo "      --address ${ZROK_BASE}"
      echo ""
      ok "Both tunnels will share the domain: ${BOLD}${ZROK_BASE}${RESET}"
    else
      warn "Skipping — you can figure out Terminal 2 manually."
    fi
    ;;
esac

echo ""
sep "All done! Here's what to share with your friends"
echo ""

case "$PROVIDER" in
  ngrok)
    info "After setting up both tunnels in separate terminals:"
    if [[ -n "${TUNNEL_URL:-}" ]]; then
      info "Share this URL: ${BOLD}${TUNNEL_URL}${RESET}"
    else
      info "Share the ngrok URL from Terminal 1."
    fi
    ;;
  zrok)
    if [[ -n "${ZROK_URL:-}" ]]; then
      info "Share this URL: ${BOLD}${ZROK_URL}${RESET}"
    else
      info "Share the zrok public forwarding URL from Terminal 1."
    fi
    ;;
esac

echo ""
info "Players open that link → choose a game mode → click 'Create Game' or 'Join Game'"
info "The tunnel only handles the initial handshake. Once WebRTC connects,"
info "game data flows peer-to-peer — no longer through the tunnel."
echo ""

# ── cleanup on exit ─────────────────────────────────────────────────────────
trap '
  echo ""
  warn "Tunnel setup finished."
  warn "To stop the game server later, run: kill ${DEV_PID:-0}"
' EXIT

info "Enjoy your LAN party! 🎮"
echo ""

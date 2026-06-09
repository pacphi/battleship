#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_ZROK_VERSION="2.0.4"
DEFAULT_SCOPE="project"
PORT="${PORT:-4321}"

if [ -t 1 ]; then
  GREEN=$'\e[32m'; RED=$'\e[31m'; YELLOW=$'\e[33m'; BLUE=$'\e[34m'; BOLD=$'\e[1m'; RESET=$'\e[0m'
else
  GREEN=""; RED=""; YELLOW=""; BLUE=""; BOLD=""; RESET=""
fi

ok() { printf '%s\n' "${GREEN}✓ $*${RESET}"; }
err() { printf '%s\n' "${RED}✗ $*${RESET}" >&2; }
warn() { printf '%s\n' "${YELLOW}! $*${RESET}"; }
info() { printf '%s\n' "${BLUE}→ $*${RESET}"; }

usage() {
  cat <<'USAGE'
Usage:
  scripts/tunnel-setup.sh doctor
  scripts/tunnel-setup.sh install zrok [--scope project|user] [--version 2.0.4]
  scripts/tunnel-setup.sh uninstall zrok [--scope project|user]
  scripts/tunnel-setup.sh install ngrok [--scope user]
  scripts/tunnel-setup.sh uninstall ngrok [--scope user]
  scripts/tunnel-setup.sh run zrok [--port 4321]
  scripts/tunnel-setup.sh run ngrok [--port 4321]

Recommended:
  scripts/tunnel-setup.sh install zrok --scope project
  scripts/tunnel-setup.sh run zrok

Notes:
  zrok installs are managed by this repo and verified with upstream SHA-256 checksums.
  ngrok installs use official native package-manager paths where available.
USAGE
}

has_cmd() { command -v "$1" >/dev/null 2>&1; }

confirm() {
  local prompt="$1" ans
  printf '%s [y/N] ' "$prompt"
  read -r ans
  case "$ans" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

scope_paths() {
  local tool="$1" scope="$2" version="${3:-}"
  if [[ "$scope" == "project" ]]; then
    INSTALL_ROOT="$ROOT_DIR/.tools/$tool"
    BIN_DIR="$ROOT_DIR/.tools/bin"
    MANIFEST_DIR="$ROOT_DIR/.tools/manifests"
  else
    INSTALL_ROOT="$HOME/.local/share/battleship-tools/$tool"
    BIN_DIR="$HOME/.local/bin"
    MANIFEST_DIR="$HOME/.local/share/battleship-tools/manifests"
  fi
  INSTALL_DIR="$INSTALL_ROOT/$version"
  MANIFEST_PATH="$MANIFEST_DIR/$tool-$scope.json"
}

detect_zrok_asset() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64) printf 'darwin_arm64' ;;
        *) err "Only macOS ARM64 is supported by this installer. Found: $arch"; exit 1 ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64|amd64) printf 'linux_amd64' ;;
        aarch64|arm64) printf 'linux_arm64' ;;
        armv7l|armv7) printf 'linux_armv7' ;;
        *) err "Unsupported Linux architecture: $arch"; exit 1 ;;
      esac
      ;;
    *)
      err "Unsupported OS for this Bash installer: $os"
      exit 1
      ;;
  esac
}

download() {
  local url="$1" out="$2"
  if has_cmd curl; then
    curl -fsSL "$url" -o "$out"
  elif has_cmd wget; then
    wget -q "$url" -O "$out"
  else
    err "Install requires curl or wget."
    exit 1
  fi
}

sha256_file() {
  local file="$1"
  if has_cmd shasum; then
    shasum -a 256 "$file" | awk '{print $1}'
  elif has_cmd sha256sum; then
    sha256sum "$file" | awk '{print $1}'
  else
    err "Install requires shasum or sha256sum."
    exit 1
  fi
}

write_zrok_manifest() {
  local scope="$1" version="$2" asset="$3" sha="$4" bin_path="$5"
  mkdir -p "$MANIFEST_DIR"
  cat >"$MANIFEST_PATH" <<JSON
{
  "tool": "zrok2",
  "provider": "zrok",
  "version": "$version",
  "asset": "$asset",
  "scope": "$scope",
  "installDir": "$INSTALL_DIR",
  "binDir": "$BIN_DIR",
  "binPath": "$bin_path",
  "sha256": "$sha"
}
JSON
}

install_zrok() {
  local scope="$1" version="$2" platform asset base_url archive_url checksum_url tmp archive checksums expected actual extracted_bin shim_path
  platform="$(detect_zrok_asset)"
  asset="zrok_${version}_${platform}.tar.gz"
  base_url="https://github.com/openziti/zrok/releases/download/v${version}"
  archive_url="$base_url/$asset"
  checksum_url="$base_url/checksums.sha256.txt"

  scope_paths "zrok2" "$scope" "$version"
  mkdir -p "$INSTALL_DIR" "$BIN_DIR"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  archive="$tmp/$asset"
  checksums="$tmp/checksums.sha256.txt"

  info "Downloading $asset"
  download "$archive_url" "$archive"
  download "$checksum_url" "$checksums"

  expected="$(awk -v asset="$asset" '$2 == asset {print $1}' "$checksums")"
  if [[ -z "$expected" ]]; then
    err "Checksum file did not contain $asset"
    exit 1
  fi

  actual="$(sha256_file "$archive")"
  if [[ "$expected" != "$actual" ]]; then
    err "Checksum mismatch for $asset"
    exit 1
  fi
  ok "Verified SHA-256 checksum"

  tar -xzf "$archive" -C "$tmp"
  extracted_bin="$(find "$tmp" -type f -name zrok2 -perm -u+x | head -n 1)"
  if [[ -z "$extracted_bin" ]]; then
    err "Archive did not contain executable zrok2"
    exit 1
  fi

  install -m 0755 "$extracted_bin" "$INSTALL_DIR/zrok2"
  shim_path="$BIN_DIR/zrok2"
  ln -sfn "$INSTALL_DIR/zrok2" "$shim_path"
  write_zrok_manifest "$scope" "$version" "$asset" "$actual" "$shim_path"

  ok "Installed zrok2 $version at $INSTALL_DIR/zrok2"
  if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    warn "$BIN_DIR is not on PATH. Use: export PATH=\"$BIN_DIR:\$PATH\""
  fi
}

uninstall_zrok() {
  local scope="$1" version="${2:-$DEFAULT_ZROK_VERSION}" bin_path install_dir
  scope_paths "zrok2" "$scope" "$version"

  if [[ ! -f "$MANIFEST_PATH" ]]; then
    warn "No manifest found at $MANIFEST_PATH"
    return 0
  fi

  bin_path="$(awk -F'"' '/"binPath"/ {print $4}' "$MANIFEST_PATH")"
  install_dir="$(awk -F'"' '/"installDir"/ {print $4}' "$MANIFEST_PATH")"

  if [[ "$install_dir" != "$INSTALL_ROOT"/* ]]; then
    err "Refusing to remove unmanaged install dir: $install_dir"
    exit 1
  fi

  if [[ -L "$bin_path" ]]; then
    rm "$bin_path"
  fi
  rm -rf "$install_dir"
  rm -f "$MANIFEST_PATH"
  ok "Uninstalled managed zrok2 ($scope)"
}

install_ngrok() {
  local scope="$1" os
  if [[ "$scope" != "user" ]]; then
    err "ngrok project-local installs are intentionally not managed because upstream does not publish the same checksum flow as zrok."
    info "Install ngrok with --scope user, or install it from https://ngrok.com/download and rerun this script."
    exit 1
  fi

  os="$(uname -s)"
  case "$os" in
    Darwin)
      if has_cmd brew; then
        brew install ngrok/ngrok/ngrok
      else
        err "Homebrew not found. Install ngrok from https://ngrok.com/download/macos"
        exit 1
      fi
      ;;
    Linux)
      if has_cmd apt-get; then
        warn "This will install ngrok using the official apt repository and sudo."
        confirm "Continue?" || exit 1
        curl -fsSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main" | sudo tee /etc/apt/sources.list.d/ngrok.list >/dev/null
        sudo apt-get update
        sudo apt-get install -y ngrok
      elif has_cmd snap; then
        warn "This will install ngrok using snap and sudo."
        confirm "Continue?" || exit 1
        sudo snap install ngrok
      else
        err "No supported native ngrok installer found. Use https://ngrok.com/download/linux"
        exit 1
      fi
      ;;
    *)
      err "Unsupported OS for this Bash installer: $os"
      exit 1
      ;;
  esac
  ok "ngrok is installed at $(command -v ngrok)"
}

uninstall_ngrok() {
  local os
  os="$(uname -s)"
  case "$os" in
    Darwin)
      has_cmd brew && brew uninstall ngrok/ngrok/ngrok || warn "Homebrew ngrok formula was not found."
      ;;
    Linux)
      if has_cmd snap && snap list ngrok >/dev/null 2>&1; then
        warn "This will remove ngrok with sudo snap remove."
        confirm "Continue?" || exit 1
        sudo snap remove ngrok
      elif has_cmd dpkg && dpkg -s ngrok >/dev/null 2>&1; then
        warn "This will remove ngrok with sudo apt-get remove."
        confirm "Continue?" || exit 1
        sudo apt-get remove -y ngrok
      else
        warn "No managed ngrok package found. Remove your manually installed ngrok binary yourself."
      fi
      ;;
    *)
      err "Unsupported OS for this Bash uninstaller: $os"
      exit 1
      ;;
  esac
}

tool_path() {
  local provider="$1"
  case "$provider" in
    zrok)
      if [[ -x "$ROOT_DIR/.tools/bin/zrok2" ]]; then
        printf '%s\n' "$ROOT_DIR/.tools/bin/zrok2"
      elif has_cmd zrok2; then
        command -v zrok2
      else
        return 1
      fi
      ;;
    ngrok)
      has_cmd ngrok && command -v ngrok || return 1
      ;;
    *) return 1 ;;
  esac
}

ensure_build() {
  cd "$ROOT_DIR"
  if [[ ! -d dist ]]; then
    info "Building static site"
    pnpm build
  fi
}

run_provider() {
  local provider="$1" tool server_pid
  tool="$(tool_path "$provider")" || {
    err "$provider CLI not found. Run: scripts/tunnel-setup.sh install $provider"
    exit 1
  }

  ensure_build
  cd "$ROOT_DIR"
  info "Starting single-origin Battleship server on http://localhost:$PORT"
  PORT="$PORT" pnpm server &
  server_pid=$!
  trap 'kill "$server_pid" >/dev/null 2>&1 || true' EXIT INT TERM
  sleep 2

  case "$provider" in
    zrok)
      info "Starting zrok public share"
      "$tool" share public "$PORT"
      ;;
    ngrok)
      info "Starting ngrok HTTP endpoint"
      "$tool" http "$PORT"
      ;;
  esac
}

doctor() {
  info "Node: $(node --version 2>/dev/null || echo missing)"
  if has_cmd pnpm; then
    info "pnpm: $(command -v pnpm)"
  else
    info "pnpm: missing"
  fi
  info "zrok2: $(zrok2 version 2>/dev/null || "$ROOT_DIR/.tools/bin/zrok2" version 2>/dev/null || echo missing)"
  info "ngrok: $(ngrok version 2>/dev/null || echo missing)"
}

COMMAND="${1:-}"
PROVIDER="${2:-}"
SCOPE="$DEFAULT_SCOPE"
ZROK_VERSION="$DEFAULT_ZROK_VERSION"

shift $(( $# > 0 ? 1 : 0 ))
shift $(( $# > 0 ? 1 : 0 ))

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scope) SCOPE="${2:-}"; shift 2 ;;
    --version) ZROK_VERSION="${2:-}"; shift 2 ;;
    --port) PORT="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) err "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

case "$COMMAND:$PROVIDER" in
  doctor:) doctor ;;
  install:zrok) install_zrok "$SCOPE" "$ZROK_VERSION" ;;
  uninstall:zrok) uninstall_zrok "$SCOPE" "$ZROK_VERSION" ;;
  install:ngrok) install_ngrok "$SCOPE" ;;
  uninstall:ngrok) uninstall_ngrok ;;
  run:zrok|run:ngrok) run_provider "$PROVIDER" ;;
  *:*)
    usage
    exit 1
    ;;
esac

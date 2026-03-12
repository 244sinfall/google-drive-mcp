#!/bin/sh
set -eu

fix_dir() {
  p="$1"
  [ -n "$p" ] || return 0
  d="$(dirname "$p")"
  mkdir -p "$d" 2>/dev/null || true
  chown -R node:node "$d" 2>/dev/null || true
}

# Ensure config/token directories are writable when mounted as volumes.
fix_dir "${GOOGLE_DRIVE_OAUTH_CREDENTIALS:-}"
fix_dir "${GOOGLE_DRIVE_MCP_TOKEN_PATH:-}"

if [ -d "/config" ]; then
  chown -R node:node /config 2>/dev/null || true
fi

exec gosu node:node "$@"


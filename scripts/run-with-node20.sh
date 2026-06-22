#!/usr/bin/env bash
# Prefer Homebrew node@20 when system node is too old (Next.js 16 requires >=20.9.0).
set -euo pipefail

if command -v brew >/dev/null 2>&1; then
  NODE20_PREFIX="$(brew --prefix node@20 2>/dev/null || true)"
  if [ -n "$NODE20_PREFIX" ] && [ -x "$NODE20_PREFIX/bin/node" ]; then
    export PATH="$NODE20_PREFIX/bin:$PATH"
  fi
fi

MAJOR="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
if [ "$MAJOR" -lt 20 ]; then
  echo "Error: Node.js >=20.9.0 is required (current: $(node -v 2>/dev/null || echo unknown))."
  echo "Install Node 20: brew install node@20"
  echo "Then add to your shell: export PATH=\"\$(brew --prefix node@20)/bin:\$PATH\""
  exit 1
fi

exec "$@"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${TURSO_DB_NAME:-ckaabal-booking-crm}"
ENV_FILE="${ENV_FILE:-$ROOT/.env.local}"

export PATH="${HOME}/.turso:${PATH}"

if ! command -v turso >/dev/null 2>&1; then
  echo "Turso CLI not found. Install: curl -sSfL https://get.tur.so/install.sh | bash" >&2
  exit 1
fi

if ! turso auth whoami >/dev/null 2>&1; then
  echo "Not logged in to Turso. Run: turso auth login" >&2
  exit 1
fi

echo "Creating Turso database: $DB_NAME"
if turso db show "$DB_NAME" >/dev/null 2>&1; then
  echo "Database '$DB_NAME' already exists — reusing it."
else
  turso db create "$DB_NAME"
fi

DB_URL="$(turso db show "$DB_NAME" --url)"
TOKEN="$(turso db tokens create "$DB_NAME")"

echo ""
echo "Pushing schema to Turso..."
cd "$ROOT"
TURSO_DATABASE_URL="$DB_URL" TURSO_AUTH_TOKEN="$TOKEN" npm run db:push

if [[ ! -f "$ENV_FILE" ]]; then
  cp "$ROOT/.env.example" "$ENV_FILE"
fi

update_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    fi
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

update_env "TURSO_DATABASE_URL" "$DB_URL"
update_env "TURSO_AUTH_TOKEN" "$TOKEN"

echo ""
echo "Done. Updated $ENV_FILE with:"
echo "  TURSO_DATABASE_URL=$DB_URL"
echo "  TURSO_AUTH_TOKEN=<token written to .env.local>"
echo ""
echo "Restart the dev server to use Turso."

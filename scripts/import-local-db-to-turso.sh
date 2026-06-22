#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="${TURSO_DB_NAME:-ckaabal-booking-crm}"
LOCAL_DB="${LOCAL_DB_PATH:-$ROOT/data/booking-crm.db}"
DUMP_FILE="${TMPDIR:-/tmp}/leadfinder-dump.sql"

if ! command -v turso >/dev/null 2>&1; then
  echo "turso CLI not found. Install: https://docs.turso.tech/cli" >&2
  exit 1
fi

if [[ ! -f "$LOCAL_DB" ]]; then
  echo "Local database not found: $LOCAL_DB" >&2
  exit 1
fi

echo "Exporting $LOCAL_DB ..."
sqlite3 "$LOCAL_DB" .dump > "$DUMP_FILE"

echo "Importing into Turso database '$DB_NAME' ..."
turso db shell "$DB_NAME" < "$DUMP_FILE"

echo "Done. Set on Vercel:"
turso db show "$DB_NAME" --url
echo "TURSO_AUTH_TOKEN=<create with: turso db tokens create $DB_NAME>"

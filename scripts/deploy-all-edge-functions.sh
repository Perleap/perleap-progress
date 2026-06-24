#!/usr/bin/env bash
# Deploy every edge function that has an index.ts (skips shared helper folders).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FUNCTIONS_DIR="$ROOT/supabase/functions"

for dir in "$FUNCTIONS_DIR"/*/; do
  name="$(basename "$dir")"
  case "$name" in
    _shared | shared) continue ;;
  esac
  if [[ -f "$dir/index.ts" ]]; then
    echo "Deploying edge function: $name"
    supabase functions deploy "$name"
  fi
done

echo "All edge functions deployed."

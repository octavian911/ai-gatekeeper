#!/usr/bin/env bash
set -euo pipefail

# Atomic file writer without node/python.
# Usage:
#   ./safe_write.sh path/to/file <<'CONTENT'
#   ...content...
#   CONTENT

OUT="${1:-}"
if [ -z "$OUT" ]; then
  echo "Usage: $0 <output-file>"
  exit 1
fi

DIR="$(dirname "$OUT")"
mkdir -p "$DIR"

TMP="$(mktemp "${OUT}.tmp.XXXXXX")"
cat > "$TMP"
mv -f "$TMP" "$OUT"

echo "✅ Wrote $OUT"

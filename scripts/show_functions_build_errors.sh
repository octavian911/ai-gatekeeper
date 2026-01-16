#!/usr/bin/env bash
set -euo pipefail

cd ~/ai-gatekeeper/functions || exit 1

echo "==> Running TypeScript build (capturing errors)..."
rm -f /tmp/tsc.err || true

# Capture both stdout+stderr so we don't miss anything
if npm run build > /tmp/tsc.out 2> /tmp/tsc.err; then
  echo "✅ build OK"
  exit 0
fi

echo "❌ build FAILED (exit=$?)"
echo
echo "----- tsc stderr (first 120 lines) -----"
sed -n '1,120p' /tmp/tsc.err || true

echo
echo "----- tsc stdout (first 120 lines) -----"
sed -n '1,120p' /tmp/tsc.out || true

echo
echo "==> Showing code context for any src/*.ts:<line>:<col> errors..."

# Extract file:line:col from typical tsc format: src/index.ts:139:1 -
grep -Eo 'src\/[^:]+\.ts:[0-9]+:[0-9]+' /tmp/tsc.err /tmp/tsc.out 2>/dev/null | head -n 8 | while read -r loc; do
  f="${loc%%:*}"
  rest="${loc#*:}"
  line="${rest%%:*}"
  start=$(( line-6 )); [ $start -lt 1 ] && start=1
  end=$(( line+10 ))
  echo
  echo "----- ${f}:${line} (context ${start}-${end}) -----"
  sed -n "${start},${end}p" "$f" | nl -ba
done

exit 1

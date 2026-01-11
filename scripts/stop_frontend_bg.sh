#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-5173}"
PIDFILE="/tmp/vite-${PORT}.pid"

if [[ -f "${PIDFILE}" ]]; then
  PID="$(cat "${PIDFILE}" || true)"
  if [[ -n "${PID}" ]]; then
    kill "${PID}" 2>/dev/null || true
  fi
  rm -f "${PIDFILE}"
fi

# Also ensure nothing is still listening
lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null || true
echo "✅ Stopped Vite on ${PORT}"

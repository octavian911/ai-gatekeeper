#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-5173}"
LOG="/tmp/vite-${PORT}.log"
PIDFILE="/tmp/vite-${PORT}.pid"

cd ~/ai-gatekeeper/frontend || exit 1

# Kill anything already listening
lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null | xargs -r kill 2>/dev/null || true
sleep 1

# Start
nohup bun run dev -- --host 0.0.0.0 --port "${PORT}" --strictPort >"${LOG}" 2>&1 &

# Wait for listener and record LISTEN PID (not the bun wrapper PID)
for i in $(seq 1 30); do
  LPID="$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [[ -n "${LPID}" ]]; then
    echo "${LPID}" > "${PIDFILE}"
    break
  fi
  sleep 0.5
done

if [[ ! -f "${PIDFILE}" ]]; then
  echo "❌ Vite did not start. Tail log:"
  tail -n 120 "${LOG}" || true
  exit 1
fi

echo "✅ Vite running"
echo "   Port: ${PORT}"
echo "   PID:  $(cat "${PIDFILE}")"
echo "   Log:  ${LOG}"
echo
echo "Tip: open http://localhost:${PORT} (or the Network URL shown in the log)"
echo "---- last log lines ----"
tail -n 20 "${LOG}" || true

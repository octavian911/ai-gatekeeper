#!/bin/bash
set -e

PORT=3000
BASE_URL="http://localhost:$PORT"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    echo "Stopping server (PID: $SERVER_PID)..."
    kill $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

echo "Checking if port $PORT is available..."
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo "Port $PORT is in use. Killing existing process..."
  lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
  sleep 2
fi

echo "Starting Next.js server..."
npm run start > /tmp/next-server.log 2>&1 &
SERVER_PID=$!

echo "Waiting for $BASE_URL to be ready..."
npx wait-on $BASE_URL --timeout 60000

if [ $? -ne 0 ]; then
  echo "Error: Server failed to start within 60 seconds"
  echo "Server logs:"
  cat /tmp/next-server.log
  exit 1
fi

echo "Server is ready. Running AI Gatekeeper..."
npx ai-gate run --baseURL $BASE_URL

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ All visual regression tests passed"
else
  echo "❌ Visual regression tests failed"
  echo "Evidence available at: .ai-gate/evidence/"
fi

exit $EXIT_CODE

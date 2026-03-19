#!/bin/bash
# Restart SystemEdu backend (gateway) and frontend (Next.js dev server)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Stopping services ==="

# Kill backend on port 18820
if lsof -ti:18820 >/dev/null 2>&1; then
  lsof -ti:18820 | xargs kill -9 2>/dev/null
  echo "Backend stopped (port 18820)"
else
  echo "Backend not running"
fi

# Kill frontend on port 3000
if lsof -ti:3000 >/dev/null 2>&1; then
  lsof -ti:3000 | xargs kill -9 2>/dev/null
  echo "Frontend stopped (port 3000)"
else
  echo "Frontend not running"
fi

sleep 1

echo ""
echo "=== Starting backend ==="
cd "$PROJECT_DIR"
source .venv/bin/activate
python -m systemedu.gateway.server &
BACKEND_PID=$!
echo "Backend starting (PID: $BACKEND_PID)"

echo ""
echo "=== Starting frontend ==="
cd "$PROJECT_DIR/web"
npm run dev &
FRONTEND_PID=$!
echo "Frontend starting (PID: $FRONTEND_PID)"

# Wait for backend to be ready
echo ""
echo "=== Waiting for services ==="
for i in $(seq 1 10); do
  if curl -s --noproxy '*' http://127.0.0.1:18820/api/status >/dev/null 2>&1; then
    echo "Backend ready on http://127.0.0.1:18820"
    break
  fi
  sleep 1
done

echo "Frontend dev server on http://localhost:3000"
echo ""
echo "=== SystemEdu restarted ==="
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

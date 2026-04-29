#!/bin/bash
# Restart SystemEdu backend (gateway), frontend (Next.js), and dighuman avatar server.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

DIGHUMAN_PORT="${DIGHUMAN_PORT:-8787}"

echo "=== Stopping services ==="

kill_port() {
  local port=$1
  local label=$2
  local pids="$(lsof -ti:"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
    echo "$label stopped (port $port)"
  else
    echo "$label not running"
  fi
}

kill_port 18820 "Backend"
kill_port 3000 "Frontend"
kill_port "$DIGHUMAN_PORT" "Dighuman"

sleep 1

echo ""
echo "=== Starting backend ==="
cd "$PROJECT_DIR"
mkdir -p "$PROJECT_DIR/.run"
nohup bash -lc "cd '$PROJECT_DIR' && source .venv/bin/activate && python -m systemedu.gateway.server" > "$PROJECT_DIR/.run/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend starting (PID: $BACKEND_PID)"

echo ""
echo "=== Starting dighuman avatar server ==="
if [ -d "$PROJECT_DIR/dighuman/packages/server/node_modules" ]; then
  nohup bash -lc "cd '$PROJECT_DIR/dighuman' && PORT=$DIGHUMAN_PORT pnpm dev" > "$PROJECT_DIR/.run/dighuman.log" 2>&1 &
  DIGHUMAN_PID=$!
  echo "Dighuman starting (PID: $DIGHUMAN_PID, port: $DIGHUMAN_PORT)"
else
  echo "Dighuman: skipping (node_modules missing — run 'cd dighuman && pnpm install' once)"
  DIGHUMAN_PID=""
fi

echo ""
echo "=== Starting frontend ==="
cd "$PROJECT_DIR/web"
nohup npm run dev > "$PROJECT_DIR/.run/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend starting (PID: $FRONTEND_PID)"

echo ""
echo "=== Waiting for services ==="
for i in $(seq 1 10); do
  if curl -s --noproxy '*' http://127.0.0.1:18820/api/status >/dev/null 2>&1; then
    echo "Backend ready on http://127.0.0.1:18820"
    break
  fi
  sleep 1
done

if [ -n "$DIGHUMAN_PID" ]; then
  for i in $(seq 1 10); do
    if curl -s --noproxy '*' "http://127.0.0.1:$DIGHUMAN_PORT/api/health" >/dev/null 2>&1; then
      echo "Dighuman ready on http://127.0.0.1:$DIGHUMAN_PORT"
      break
    fi
    sleep 1
  done
fi

echo "Frontend dev server on http://localhost:3000"
echo ""
echo "=== SystemEdu restarted ==="
echo "Backend  PID: $BACKEND_PID"
[ -n "$DIGHUMAN_PID" ] && echo "Dighuman PID: $DIGHUMAN_PID"
echo "Frontend PID: $FRONTEND_PID"

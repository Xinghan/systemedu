#!/bin/bash
# spec 028+031: 重启 student-app (backend :18820 + web :4000 + fact_extractor worker).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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

kill_pattern() {
  local pattern=$1
  local label=$2
  local pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill -9 $pids 2>/dev/null || true
    echo "$label stopped (pids: $pids)"
  else
    echo "$label not running"
  fi
}

kill_port 18820 "student-app backend"
kill_port 4000  "student-app web"
kill_pattern "systemedu.student.workers.fact_extractor_worker" "fact_extractor worker"

sleep 1

mkdir -p "$PROJECT_DIR/.run"

echo ""
echo "=== Starting student-app backend (:18820) ==="
nohup bash -lc "cd '$PROJECT_DIR' && source .venv/bin/activate && python -m systemedu.student.server" \
  > "$PROJECT_DIR/.run/student-backend.log" 2>&1 &
BACKEND_PID=$!
echo "backend pid=$BACKEND_PID"

echo ""
echo "=== Starting fact_extractor worker ==="
nohup bash -lc "cd '$PROJECT_DIR' && source .venv/bin/activate && python -m systemedu.student.workers.fact_extractor_worker" \
  > "$PROJECT_DIR/.run/fact-extractor.log" 2>&1 &
WORKER_PID=$!
echo "worker pid=$WORKER_PID"

echo ""
echo "=== Starting student-app web (:4000) ==="
if [ -d "$PROJECT_DIR/web/node_modules" ]; then
  nohup bash -lc "cd '$PROJECT_DIR/web' && PORT=4000 npm run dev" \
    > "$PROJECT_DIR/.run/student-web.log" 2>&1 &
  WEB_PID=$!
  echo "web pid=$WEB_PID"
else
  echo "web: skipping (run 'cd web && npm install' first)"
  WEB_PID=""
fi

echo ""
echo "=== Waiting for backend ==="
for i in $(seq 1 10); do
  if curl -s --noproxy '*' http://127.0.0.1:18820/api/status >/dev/null 2>&1; then
    echo "backend ready: http://127.0.0.1:18820"
    break
  fi
  sleep 1
done

echo ""
echo "=== student-app restarted ==="
echo "  backend  PID=$BACKEND_PID  log=.run/student-backend.log"
echo "  worker   PID=$WORKER_PID   log=.run/fact-extractor.log"
[ -n "$WEB_PID" ] && echo "  web      PID=$WEB_PID      log=.run/student-web.log     http://localhost:4000"

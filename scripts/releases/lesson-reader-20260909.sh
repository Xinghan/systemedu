#!/usr/bin/env bash
set -euo pipefail
source /opt/systemedu/scripts/deploy.env
RELEASE="$REPO_ROOT/releases/lesson-reader-20260909"
LIVE="$REPO_ROOT/packages/student-web"
PY="$REPO_ROOT/.venv/bin/python"
CHECK="$RELEASE/reader-release.py"
case "${1:-}" in
 stage)
  test ! -e "$RELEASE/student-web"
  "$PY" "$CHECK" baseline
  mkdir "$RELEASE/student-web"
  tar -C "$LIVE" --exclude=node_modules --exclude=.next --exclude=tsconfig.tsbuildinfo -cf - . | tar -C "$RELEASE/student-web" -xf -
  "$PY" "$CHECK" patch "$RELEASE/student-web"
  ;;
 prepare-retry)
  test ! -f "$RELEASE/web-live.ok";test ! -e "$RELEASE/student-web"
  mv "$RELEASE/student-web-candidate-v1" "$RELEASE/student-web"
  rm -f "$RELEASE/build.ok" "$RELEASE/smoke.ok"
  "$PY" "$CHECK" patch "$RELEASE/student-web"
  ;;
 build)
  cd "$RELEASE/student-web"
  npm ci --no-audit --no-fund > "$RELEASE/npm-ci.log" 2>&1
  READER_ROOT="$PWD" NODE_PATH="$PWD/node_modules" node --test "$RELEASE/test-lesson-carousel.cjs" > "$RELEASE/player-tests.log" 2>&1
  tail -10 "$RELEASE/player-tests.log"
  "$PY" "$CHECK" pre-switch "$RELEASE/student-web"
  "$PY" "$CHECK" types
  NEXT_PUBLIC_STUDENT_API_URL='' NEXT_PUBLIC_GATEWAY_URL='' npm run build > "$RELEASE/build.log" 2>&1
  test -s .next/BUILD_ID;touch "$RELEASE/build.ok";tail -20 "$RELEASE/build.log"
  ;;
 smoke)
  test -f "$RELEASE/build.ok";cd "$RELEASE/student-web"
  nohup node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4001 > "$RELEASE/smoke.log" 2>&1 &
  echo "$!" > "$RELEASE/smoke.pid"
  ready=0
  for attempt in {1..20}; do if curl --noproxy '*' -fsS http://127.0.0.1:4001/ -o /dev/null; then ready=1;break;fi;sleep 1;done
  test "$ready" = 1
  for node in M04 M87 M88 M89;do curl --noproxy '*' -fsS "http://127.0.0.1:4001/learn/molecule-monster-hunter/$node" -o /dev/null;done
  touch "$RELEASE/smoke.ok";echo 'Production build loopback smoke passed.'
  ;;
 switch)
  test -f "$RELEASE/build.ok";test -f "$RELEASE/smoke.ok";test -f "$RELEASE/types.ok"
  "$PY" "$CHECK" pre-switch "$RELEASE/student-web"
  test ! -e "$RELEASE/student-web-before"
  if test -f "$RELEASE/smoke.pid";then kill "$(cat "$RELEASE/smoke.pid")" || true;fi
  cp -an "$LIVE/.next/static/." "$RELEASE/student-web/.next/static/"
  systemctl stop systemedu-student-web
  mv "$LIVE" "$RELEASE/student-web-before";mv "$RELEASE/student-web" "$LIVE"
  systemctl start systemedu-student-web
  ready=0
  for attempt in {1..25};do if curl --noproxy '*' -fsS "http://127.0.0.1:$STUDENT_WEB_PORT/" -o /dev/null;then ready=1;break;fi;sleep 1;done
  if test "$ready" != 1;then
   systemctl stop systemedu-student-web;mv "$LIVE" "$RELEASE/student-web-failed";mv "$RELEASE/student-web-before" "$LIVE";systemctl start systemedu-student-web
   echo 'Frontend health failed; previous version restored.' >&2;exit 1
  fi
  touch "$RELEASE/web-live.ok";echo "Frontend live: $(cat "$LIVE/.next/BUILD_ID")"
  ;;
 verify)
  test -f "$RELEASE/web-live.ok"
  "$PY" "$CHECK" verify "$LIVE"
  systemctl is-active systemedu-student-web systemedu-student-backend systemedu-library
  curl --noproxy '*' -fsS "http://127.0.0.1:$STUDENT_BACKEND_PORT/api/health"
  ;;
 *) echo 'stage | build | smoke | switch | verify' >&2;exit 2;;
esac

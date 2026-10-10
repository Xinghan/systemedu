#!/usr/bin/env bash
set -euo pipefail
source /opt/systemedu/scripts/deploy.env
RELEASE="$REPO_ROOT/releases/slide-layout-20260909"
LIVE="$REPO_ROOT/packages/student-web"
PY="$REPO_ROOT/.venv/bin/python"
CHECK="$RELEASE/check.py"
case "${1:-}" in
 stage)
  test ! -e "$RELEASE/student-web"
  "$PY" "$CHECK" baseline
  mkdir "$RELEASE/student-web"
  tar -C "$LIVE" --exclude=node_modules --exclude=.next --exclude=.git --exclude=tsconfig.tsbuildinfo -cf - . | tar -C "$RELEASE/student-web" -xf -
  "$PY" "$CHECK" patch "$RELEASE/student-web"
  ;;
 build)
  cd "$RELEASE/student-web"
  npm ci --no-audit --no-fund > "$RELEASE/npm-ci.log" 2>&1
  STUDENT_WEB_ROOT="$PWD" READER_ROOT="$PWD" NODE_PATH="$PWD/node_modules" node --test "$RELEASE/test-diversity-layout.cjs" "$RELEASE/test-lesson-carousel.cjs" > "$RELEASE/tests.log" 2>&1
  tail -10 "$RELEASE/tests.log"
  "$PY" "$CHECK" pre-switch "$PWD"
  NEXT_PUBLIC_STUDENT_API_URL='' NEXT_PUBLIC_GATEWAY_URL='' npm run build > "$RELEASE/build.log" 2>&1
  test -s .next/BUILD_ID
  touch "$RELEASE/build.ok"
  echo "Candidate build complete: $(cat .next/BUILD_ID)"
  ;;
 smoke)
  test -f "$RELEASE/build.ok"
  cd "$RELEASE/student-web"
  nohup node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4001 > "$RELEASE/smoke.log" 2>&1 &
  echo "$!" > "$RELEASE/smoke.pid"
  ready=0
  for attempt in {1..20};do if curl --noproxy '*' -fsS http://127.0.0.1:4001/ -o /dev/null;then ready=1;break;fi;sleep 1;done
  test "$ready" = 1
  for node in M04 M88 M89;do curl --noproxy '*' -fsS "http://127.0.0.1:4001/learn/molecule-monster-hunter/$node" -o /dev/null;done
  touch "$RELEASE/smoke.ok"
  echo 'Candidate home and learning routes passed HTTP smoke checks.'
  ;;
 switch)
  test -f "$RELEASE/build.ok";test -f "$RELEASE/smoke.ok"
  "$PY" "$CHECK" pre-switch "$RELEASE/student-web"
  test ! -e "$RELEASE/student-web-before"
  kill "$(cat "$RELEASE/smoke.pid")" || true
  cp -an "$LIVE/.next/static/." "$RELEASE/student-web/.next/static/"
  rollback(){
   trap - ERR
   systemctl stop systemedu-student-web || true
   if test -e "$RELEASE/student-web-before";then
    test ! -e "$LIVE" || mv "$LIVE" "$RELEASE/student-web-failed"
    mv "$RELEASE/student-web-before" "$LIVE"
   fi
   systemctl start systemedu-student-web
   echo 'Release failed; prior frontend restored.' >&2
   exit 1
  }
  trap rollback ERR
  systemctl stop systemedu-student-web
  mv "$LIVE" "$RELEASE/student-web-before"
  mv "$RELEASE/student-web" "$LIVE"
  systemctl start systemedu-student-web
  ready=0
  for attempt in {1..25};do if curl --noproxy '*' -fsS "http://127.0.0.1:$STUDENT_WEB_PORT/" -o /dev/null;then ready=1;break;fi;sleep 1;done
  test "$ready" = 1
  "$PY" "$CHECK" verify "$LIVE"
  trap - ERR
  touch "$RELEASE/web-live.ok"
  ;;
 verify)
  test -f "$RELEASE/web-live.ok"
  "$PY" "$CHECK" verify "$LIVE"
  systemctl is-active systemedu-student-web systemedu-student-backend systemedu-library
  curl --noproxy '*' -fsS "http://127.0.0.1:$STUDENT_BACKEND_PORT/api/health"
  ;;
 *) echo 'stage | build | smoke | switch | verify' >&2;exit 2;;
esac

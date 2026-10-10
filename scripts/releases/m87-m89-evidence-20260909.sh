#!/usr/bin/env bash
# Server-side, one explicitly invoked step at a time. Secrets never printed.
set -euo pipefail
source /opt/systemedu/scripts/deploy.env
RELEASE="$REPO_ROOT/releases/m87-m89-evidence-20260909"
LIVE="$REPO_ROOT/packages/student-web"
COURSE=/root/.systemedu-library/media/projects/molecule-monster-hunter
PY="$REPO_ROOT/.venv/bin/python"
CHECK=/tmp/m8789-release.py
mkdir -p "$RELEASE"
case "${1:-}" in
 stage)
  test ! -e "$RELEASE/student-web"
  mkdir "$RELEASE/student-web"
  tar -C "$LIVE" --exclude=node_modules --exclude=.next --exclude=tsconfig.tsbuildinfo -cf - . | tar -C "$RELEASE/student-web" -xf -
  "$PY" "$CHECK" web-baseline "$LIVE"
  tar -xzf /tmp/m8789-web-delta.tar.gz -C "$RELEASE/student-web"
  "$PY" "$CHECK" web-patch "$RELEASE/student-web"
  ;;
 refresh)
  test ! -f "$RELEASE/web-live.ok"
  tar -xzf /tmp/m8789-web-delta.tar.gz -C "$RELEASE/student-web"
  "$PY" "$CHECK" web-delta-check "$RELEASE/student-web"
  ;;
 build)
  cd "$RELEASE/student-web"
  npm ci --no-audit --no-fund > "$RELEASE/npm-ci.log" 2>&1
  NEXT_PUBLIC_STUDENT_API_URL='' NEXT_PUBLIC_GATEWAY_URL='' npm run build > "$RELEASE/build.log" 2>&1
  test -s .next/BUILD_ID; touch "$RELEASE/build.ok"; tail -25 "$RELEASE/build.log"
  ;;
 smoke)
  test -f "$RELEASE/build.ok"; cd "$RELEASE/student-web"
  nohup node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4001 > "$RELEASE/smoke.log" 2>&1 &
  echo "$!" > "$RELEASE/smoke.pid"
  for attempt in {1..20}; do if curl --noproxy '*' -fsS http://127.0.0.1:4001/ -o "$RELEASE/smoke-home.html"; then break; fi; sleep 1; done
  test -s "$RELEASE/smoke-home.html"
  for node in M87 M88 M89; do curl --noproxy '*' -fsS "http://127.0.0.1:4001/learn/molecule-monster-hunter/$node" -o /dev/null; done
  echo 'Loopback production-build smoke passed.'
  ;;
 stage-course)
  test ! -e "$RELEASE/course"
  "$PY" "$CHECK" course-baseline "$COURSE"
  mkdir "$RELEASE/course"; cp -a "$COURSE" "$RELEASE/course/molecule-monster-hunter"
  tar -C /root/.systemedu-library/media/projects -czf "$RELEASE/course-before.tar.gz" molecule-monster-hunter
  tar -xzf /tmp/m8789-course-delta.tar.gz -C "$RELEASE/course/molecule-monster-hunter"
  "$PY" "$CHECK" manifest "$RELEASE/course/molecule-monster-hunter"
  tar --exclude='_archive' -C "$RELEASE/course" -czf "$RELEASE/molecule-monster-hunter.tar.gz" molecule-monster-hunter
  ;;
 repack-course)
  test ! -f "$RELEASE/course-live.ok"
  tar --exclude='_archive' -C "$RELEASE/course" -czf "$RELEASE/molecule-monster-hunter.tar.gz" molecule-monster-hunter
  ;;
 audit-package)
  "$PY" "$CHECK" audit-package
  ;;
 repair-package)
  test ! -f "$RELEASE/course-live.ok"
  "$PY" "$CHECK" check-course "$COURSE"
  "$PY" "$CHECK" repair-package "$RELEASE/course/molecule-monster-hunter"
  tar --exclude='_archive' -C "$RELEASE/course" -czf "$RELEASE/molecule-monster-hunter.tar.gz" molecule-monster-hunter
  "$PY" "$CHECK" audit-package
  ;;
 switch)
  test -f "$RELEASE/build.ok"; "$PY" "$CHECK" check-web "$LIVE"
  test ! -e "$RELEASE/student-web-before"
  if test -f "$RELEASE/smoke.pid"; then kill "$(cat "$RELEASE/smoke.pid")" || true; fi
  cp -an "$LIVE/.next/static/." "$RELEASE/student-web/.next/static/"
  systemctl stop systemedu-student-web
  mv "$LIVE" "$RELEASE/student-web-before"; mv "$RELEASE/student-web" "$LIVE"
  systemctl start systemedu-student-web
  healthy=0
  for attempt in {1..25}; do if curl --noproxy '*' -fsS "http://127.0.0.1:$STUDENT_WEB_PORT/" -o /dev/null; then healthy=1; break; fi; sleep 1; done
  if test "$healthy" != 1; then
   systemctl stop systemedu-student-web; mv "$LIVE" "$RELEASE/student-web-failed"; mv "$RELEASE/student-web-before" "$LIVE"; systemctl start systemedu-student-web; echo 'Health failed; previous frontend restored.' >&2; exit 1
  fi
  touch "$RELEASE/web-live.ok"; echo "Frontend live: $(cat "$LIVE/.next/BUILD_ID")"
  ;;
 publish-course)
  test -f "$RELEASE/web-live.ok"; "$PY" "$CHECK" check-course "$COURSE"
  if test ! -f "$RELEASE/library-before.sqlite"; then "$PY" "$CHECK" backup-db; fi
  "$PY" "$CHECK" audit-package
  cp "$RELEASE/molecule-monster-hunter.tar.gz" /tmp/molecule-monster-hunter.tar.gz
  LIBRARY_PORT="$LIBRARY_PORT" COURSE_SLUGS=molecule-monster-hunter bash /tmp/m8789-import-courses.sh
  touch "$RELEASE/course-live.ok"
  ;;
 verify)
  set -a; source /root/.systemedu-library-secrets; set +a
  "$PY" "$CHECK" verify "$COURSE"
  systemctl is-active systemedu-student-web systemedu-student-backend systemedu-library
  curl --noproxy '*' -fsS "http://127.0.0.1:$STUDENT_BACKEND_PORT/api/health"
  ;;
 *) echo 'stage | build | smoke | stage-course | switch | publish-course | verify' >&2; exit 2;;
esac

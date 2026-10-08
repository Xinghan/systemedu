#!/usr/bin/env bash
# Server-side, one explicitly invoked step at a time. Secrets never printed.
set -euo pipefail
source /opt/systemedu/scripts/deploy.env
RELEASE="$REPO_ROOT/releases/m0405-evidence-20260911"
LIVE="$REPO_ROOT/packages/student-web"
COURSE=/root/.systemedu-library/media/projects/molecule-monster-hunter
PY="$REPO_ROOT/.venv/bin/python"
CHECK=/tmp/m0405-release.py
mkdir -p "$RELEASE"
case "${1:-}" in
 stage)
  test ! -f "$RELEASE/web-baseline.json"
  test "$(df --output=avail -B1 "$REPO_ROOT" | tail -1)" -gt 1500000000
  mkdir -p "$RELEASE/student-web"
  tar -C "$LIVE" --exclude=node_modules --exclude=.next --exclude=tsconfig.tsbuildinfo -cf - . | tar -C "$RELEASE/student-web" -xf -
  "$PY" "$CHECK" web-baseline "$LIVE"
  tar -xzf /tmp/m0405-web-delta.tar.gz -C "$RELEASE/student-web"
  "$PY" "$CHECK" web-patch "$RELEASE/student-web"
  ;;
 refresh)
  test ! -f "$RELEASE/web-live.ok"
  tar -xzf /tmp/m0405-web-delta.tar.gz -C "$RELEASE/student-web"
  "$PY" "$CHECK" web-delta-check "$RELEASE/student-web"
  ;;
 build)
  cd "$RELEASE/student-web"
  cmp package-lock.json "$LIVE/package-lock.json"
  cmp package.json "$LIVE/package.json"
  test ! -e node_modules; cp -al "$LIVE/node_modules" node_modules
  NEXT_PUBLIC_STUDENT_API_URL='' NEXT_PUBLIC_GATEWAY_URL='' npm run build > "$RELEASE/build.log" 2>&1
  test -s .next/BUILD_ID; touch "$RELEASE/build.ok"; tail -25 "$RELEASE/build.log"
  ;;
 smoke)
  test -f "$RELEASE/build.ok"; cd "$RELEASE/student-web"
  nohup node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4001 > "$RELEASE/smoke.log" 2>&1 &
  echo "$!" > "$RELEASE/smoke.pid"
  for attempt in {1..20}; do if curl --noproxy '*' -fsS http://127.0.0.1:4001/ -o "$RELEASE/smoke-home.html"; then break; fi; sleep 1; done
  test -s "$RELEASE/smoke-home.html"
  for node in M04 M05; do curl --noproxy '*' -fsS "http://127.0.0.1:4001/learn/molecule-monster-hunter/$node" -o /dev/null; done
  echo 'Loopback production-build smoke passed.'
  ;;
 stage-course)
  test ! -e "$RELEASE/course"
  "$PY" "$CHECK" course-baseline "$COURSE"
  mkdir "$RELEASE/course"
  cp -al "$COURSE" "$RELEASE/course-before"
  cp -al "$COURSE" "$RELEASE/course/molecule-monster-hunter"
  for node in M04-w0-module M05-w0-module; do
   for file in slides.json lesson.md assignment.md theories.json sections.json audio_scripts.json; do unlink "$RELEASE/course/molecule-monster-hunter/knodes/$node/$file"; done
  done
  unlink "$RELEASE/course/molecule-monster-hunter/manifest.json"
  cp "$COURSE/manifest.json" "$RELEASE/course/molecule-monster-hunter/manifest.json"
  tar -xzf /tmp/m0405-course-delta.tar.gz -C "$RELEASE/course/molecule-monster-hunter"
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
  if test -e /tmp/molecule-monster-hunter.tar.gz; then mv /tmp/molecule-monster-hunter.tar.gz "$RELEASE/previous-upload.tar.gz"; fi
  ln "$RELEASE/molecule-monster-hunter.tar.gz" /tmp/molecule-monster-hunter.tar.gz
  LIBRARY_PORT="$LIBRARY_PORT" COURSE_SLUGS=molecule-monster-hunter bash /tmp/m0405-import-courses.sh
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

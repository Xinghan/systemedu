#!/usr/bin/env bash
# Scope: reviewed M81 visuals + required renderer, one step per invocation.
set -euo pipefail
source /opt/systemedu/scripts/deploy.env
RELEASE="$REPO_ROOT/releases/m81-evidence-20260908"
LIVE="$REPO_ROOT/packages/student-web"
COURSE=/root/.systemedu-library/media/projects/molecule-monster-hunter
mkdir -p "$RELEASE"
case "${1:-}" in
  stage)
    test ! -e "$RELEASE/student-web"
    mkdir "$RELEASE/student-web"
    tar -C "$LIVE" --exclude=node_modules --exclude=.next --exclude=tsconfig.tsbuildinfo -cf - . | tar -C "$RELEASE/student-web" -xf -
    (cd "$LIVE"; find src public -type f -print0 | sort -z | xargs -0 sha256sum; sha256sum package.json package-lock.json next.config.ts) > "$RELEASE/web-baseline.sha256"
    tar -xzf /tmp/m81-web-delta.tar.gz -C "$RELEASE/student-web"
    echo 'Scoped frontend staged. Production unchanged.'
    ;;
  build)
    cd "$RELEASE/student-web"
    npm ci --no-audit --no-fund > "$RELEASE/npm-ci.log" 2>&1
    NEXT_PUBLIC_STUDENT_API_URL='' NEXT_PUBLIC_GATEWAY_URL='' npm run build > "$RELEASE/build.log" 2>&1
    test -s .next/BUILD_ID
    touch "$RELEASE/build.ok"
    tail -35 "$RELEASE/build.log"
    ;;
  smoke)
    test -f "$RELEASE/build.ok"
    cd "$RELEASE/student-web"
    nohup node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4001 > "$RELEASE/smoke.log" 2>&1 &
    echo "$!" > "$RELEASE/smoke.pid"
    for attempt in {1..20}; do
      if curl --noproxy '*' -fsS http://127.0.0.1:4001/ -o "$RELEASE/smoke-home.html"; then break; fi
      sleep 1
    done
    test -s "$RELEASE/smoke-home.html"
    curl --noproxy '*' -fsS http://127.0.0.1:4001/learn/molecule-monster-hunter/M81 -o /dev/null
    curl --noproxy '*' -fsS http://127.0.0.1:4001/vendor/rdkit/RDKit_minimal.wasm -o /dev/null
    echo 'Production build loopback smoke passed.'
    ;;
  stage-course)
    test ! -e "$RELEASE/course"
    mkdir "$RELEASE/course"
    cp -a "$COURSE" "$RELEASE/course/molecule-monster-hunter"
    tar -C /root/.systemedu-library/media/projects -czf "$RELEASE/course-before.tar.gz" molecule-monster-hunter
    "$REPO_ROOT/.venv/bin/python" /tmp/m81-release-content.py baseline "$COURSE"
    tar -xzf /tmp/m81-course-delta.tar.gz -C "$RELEASE/course/molecule-monster-hunter"
    "$REPO_ROOT/.venv/bin/python" /tmp/m81-release-content.py manifest "$RELEASE/course/molecule-monster-hunter"
    tar -C "$RELEASE/course" -czf "$RELEASE/molecule-monster-hunter.tar.gz" molecule-monster-hunter
    echo 'M81 course delta staged and manifest verified.'
    ;;
  switch)
    test -f "$RELEASE/build.ok"
    (cd "$LIVE"; sha256sum --quiet --check "$RELEASE/web-baseline.sha256")
    test ! -e "$RELEASE/student-web-before"
    if test -f "$RELEASE/smoke.pid"; then kill "$(cat "$RELEASE/smoke.pid")" || true; fi
    cp -an "$LIVE/.next/static/." "$RELEASE/student-web/.next/static/"
    systemctl stop systemedu-student-web
    mv "$LIVE" "$RELEASE/student-web-before"
    mv "$RELEASE/student-web" "$LIVE"
    systemctl start systemedu-student-web
    healthy=0
    for attempt in {1..25}; do
      if curl --noproxy '*' -fsS "http://127.0.0.1:$STUDENT_WEB_PORT/" -o /dev/null; then healthy=1; break; fi
      sleep 1
    done
    if test "$healthy" != 1; then
      systemctl stop systemedu-student-web
      mv "$LIVE" "$RELEASE/student-web-failed"
      mv "$RELEASE/student-web-before" "$LIVE"
      systemctl start systemedu-student-web
      echo 'Failed health check, previous frontend restored.' >&2
      exit 1
    fi
    touch "$RELEASE/web-live.ok"
    echo "Frontend live: $(cat "$LIVE/.next/BUILD_ID")"
    ;;
  publish-course)
    test -f "$RELEASE/web-live.ok"
    "$REPO_ROOT/.venv/bin/python" /tmp/m81-release-content.py check-baseline "$COURSE"
    "$REPO_ROOT/.venv/bin/python" /tmp/m81-release-content.py backup-db
    cp "$RELEASE/molecule-monster-hunter.tar.gz" /tmp/molecule-monster-hunter.tar.gz
    LIBRARY_PORT="$LIBRARY_PORT" COURSE_SLUGS=molecule-monster-hunter bash /tmp/m81-import-courses.sh
    touch "$RELEASE/course-live.ok"
    ;;
  verify)
    set -a; source /root/.systemedu-library-secrets; set +a
    "$REPO_ROOT/.venv/bin/python" /tmp/m81-release-content.py verify "$COURSE"
    systemctl is-active systemedu-student-web systemedu-student-backend systemedu-library
    curl --noproxy '*' -fsS "http://127.0.0.1:$STUDENT_BACKEND_PORT/api/health"
    ;;
  *) echo 'stage | build | smoke | stage-course | switch | publish-course | verify' >&2; exit 2;;
esac

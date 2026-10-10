#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}";then source "$ROOT/scripts/deploy-secret.local";fi
DEST=/opt/systemedu/releases/slide-layout-20260909
remote(){ sshpass -e ssh $SSH_OPTS -o ConnectTimeout=12 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy(){ sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
case "${1:-}" in
 upload)
  remote "test ! -e '$DEST/student-web'; mkdir -p '$DEST'; df -h /opt/systemedu"
  copy "$ROOT/packages/student-web/src/components/learning/diversity-rejection.css" "$DEST/diversity-rejection.css"
  copy "$ROOT/packages/student-web/scripts/test-diversity-layout.cjs" "$DEST/test-diversity-layout.cjs"
  copy "$ROOT/artifacts/lesson-reader-20260909/test-lesson-carousel.cjs" "$DEST/test-lesson-carousel.cjs"
  copy "$DIR/slide-layout-release.py" "$DEST/check.py.next"
  copy "$DIR/slide-layout-20260909.sh" "$DEST/run.sh.next"
  remote "mv '$DEST/check.py.next' '$DEST/check.py'; mv '$DEST/run.sh.next' '$DEST/run.sh'"
  ;;
 upload-tests)
  remote "test ! -f '$DEST/web-live.ok'"
  copy "$ROOT/artifacts/lesson-reader-20260909/test-lesson-carousel.cjs" "$DEST/test-lesson-carousel.cjs.next"
  remote "mv '$DEST/test-lesson-carousel.cjs.next' '$DEST/test-lesson-carousel.cjs'"
  ;;
 stage|build|smoke|switch|verify) remote "bash '$DEST/run.sh' '$1'";;
 *) echo 'upload | stage | build | smoke | switch | verify' >&2;exit 2;;
esac

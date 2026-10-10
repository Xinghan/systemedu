#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}";then source "$ROOT/scripts/deploy-secret.local";fi
DEST=/opt/systemedu/releases/lesson-reader-20260909
remote(){ sshpass -e ssh $SSH_OPTS -o ConnectTimeout=12 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy(){ sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
case "${1:-}" in
 upload)
  remote "mkdir -p '$DEST'; df -h /opt/systemedu"
  copy "$ROOT/artifacts/lesson-reader-20260909/delta.json" "$DEST/delta.json"
  copy "$ROOT/artifacts/lesson-reader-20260909/test-lesson-carousel.cjs" "$DEST/test-lesson-carousel.cjs"
  copy "$DIR/lesson-reader-release.py" "$DEST/reader-release.py.next"
 copy "$DIR/lesson-reader-20260909.sh" "$DEST/run.sh.next"
  remote "mv '$DEST/reader-release.py.next' '$DEST/reader-release.py'; mv '$DEST/run.sh.next' '$DEST/run.sh'"
  ;;
 upload-controls)
  copy "$DIR/lesson-reader-release.py" "$DEST/reader-release.py.next"
  copy "$DIR/lesson-reader-20260909.sh" "$DEST/run.sh.next"
  remote "mv '$DEST/reader-release.py.next' '$DEST/reader-release.py'; mv '$DEST/run.sh.next' '$DEST/run.sh'"
  ;;
 prepare-retry|stage|build|smoke|switch|verify) remote "bash '$DEST/run.sh' '$1'";;
 status) remote "test ! -f '$DEST/player-tests.log' || tail -12 '$DEST/player-tests.log'; test ! -f '$DEST/build.log' || tail -25 '$DEST/build.log'";;
 *) echo 'upload | stage | build | smoke | switch | verify | status' >&2;exit 2;;
esac

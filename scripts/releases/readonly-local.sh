#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "$ROOT/scripts/deploy-secret.local"; fi
remote(){ sshpass -e ssh $SSH_OPTS -o ConnectTimeout=12 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy(){ sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
UP=/tmp/systemedu-readonly-20260914
case "${1:-}" in
 upload)
  remote "mkdir -m 700 -p $UP"
  for file in web-delta.tar.gz course-delta.tar.gz expected.json; do copy "$ROOT/artifacts/readonly-release-20260914/$file" "$UP/$file"; done
  copy "$DIR/readonly-release.py" "$UP/release.py"
  ;;
 browser-record)
  copy "$ROOT/artifacts/readonly-release-20260914/browser-verified.json" "$UP/browser-verified.json"
  ;;
 stage|build|pause|publish|verify|start|api-verify|resume|rollback)
  remote "cd '$REPO_ROOT' && set -a && source /root/.systemedu-library-secrets && set +a && TMPDIR=/dev/shm/systemedu-readonly-20260914 '$REPO_ROOT/.venv/bin/python' '$UP/release.py' '$1'"
  ;;
 *) echo 'upload | stage | build | browser-record | pause | publish | verify | start | api-verify | resume | rollback' >&2;exit 2;;
esac

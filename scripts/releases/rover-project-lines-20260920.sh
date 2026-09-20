#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "$ROOT/scripts/deploy-secret.local"; fi
remote() { sshpass -e ssh $SSH_OPTS -o ConnectTimeout=15 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy() { sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
UP=/tmp/rover-project-lines-20260920
case "${1:-}" in
 upload)
  remote "mkdir -m 700 -p $UP"
  copy /private/tmp/rover-release-20260920/delta.tar.gz "$UP/delta.tar.gz"
  copy /private/tmp/rover-release-20260920/expected.json "$UP/expected.json"
  copy "$ROOT/scripts/releases/rover-project-lines-20260920.py" "$UP/release.py"
  ;;
 evidence) copy /private/tmp/rover-release-20260920/preview-verified.json "$UP/preview-verified.json";;
 stage|refresh|build|migrate|preview|publish|rollback|finish)
  remote "cd /opt/systemedu && set -a && source /root/.systemedu-student-secrets && set +a && /opt/systemedu/.venv/bin/python $UP/release.py $1"
  ;;
 *) echo 'upload | stage | build | migrate | preview | evidence | publish | rollback | finish' >&2; exit 2;;
esac

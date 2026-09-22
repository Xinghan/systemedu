#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "$ROOT/scripts/deploy-secret.local"; fi
remote() { sshpass -e ssh $SSH_OPTS -o ConnectTimeout=15 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy() { sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
UP=/tmp/energy-project-lines-20260922
LOCAL=/private/tmp/energy-release-20260922
case "${1:-}" in
 inspect)
  remote "mkdir -m 700 -p $UP"
  copy "$LOCAL/request.json" "$UP/request.json"
  copy "$ROOT/scripts/releases/energy-project-lines-20260922.py" "$UP/release.py"
  remote "python3 $UP/release.py inspect"
  sshpass -e scp $SSH_OPTS "$SERVER_USER@$SERVER_HOST:$UP/baseline.json" "$LOCAL/baseline.json"
  sshpass -e scp $SSH_OPTS "$SERVER_USER@$SERVER_HOST:$UP/production.tar.gz" "$LOCAL/production.tar.gz"
  ;;
 upload)
  copy "$LOCAL/delta.tar.gz" "$UP/delta.tar.gz"
  copy "$LOCAL/expected.json" "$UP/expected.json"
  ;;
 evidence) copy "$LOCAL/preview-verified.json" "$UP/preview-verified.json";;
 refresh)
  copy "$ROOT/scripts/releases/energy-project-lines-20260922.py" "$UP/release.py"
  copy "$LOCAL/expected.json" "$UP/expected.json"
  copy "$LOCAL/candidate/packages/student-web/src/components/library/discovery-project-card.tsx" "$UP/discovery-project-card.tsx"
  remote "python3 $UP/release.py refresh"
  ;;
 stage|build|preview|publish|rollback|finish) remote "python3 $UP/release.py $1";;
 *) echo 'inspect | upload | stage | refresh | build | preview | evidence | publish | rollback | finish' >&2; exit 2;;
esac

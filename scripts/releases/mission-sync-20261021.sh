#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "${SYSTEMEDU_DEPLOY_SECRET:-/Users/xinghan/Dev/systemedu/scripts/deploy-secret.local}"; fi
UP=/tmp/mission-sync-20261021
LOCAL=/private/tmp/systemedu-sync-20261021
remote() { sshpass -e ssh $SSH_OPTS -o ConnectTimeout=15 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy() { sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
case "${1:-}" in
 upload)
  for name in request.json frontend.tar.gz; do copy "$LOCAL/$name" "$UP/$name"; done
  copy "$ROOT/scripts/releases/mission-sync-20261021.py" "$UP/release.py" ;;
 stage|build|preview|publish|verify|rollback) remote "python3 $UP/release.py $1" ;;
 evidence) copy "$ROOT/artifacts/mission-sync-release-20261021/candidate-verification.json" "$UP/browser-verified.json" ;;
 tunnel) exec sshpass -e ssh $SSH_OPTS -o ExitOnForwardFailure=yes -N -L 14921:127.0.0.1:14021 "$SERVER_USER@$SERVER_HOST" ;;
 *) echo 'upload | stage | build | preview | evidence | publish | verify | rollback | tunnel'; exit 2 ;;
esac

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "$ROOT/scripts/deploy-secret.local"; fi
UP=/tmp/space-journey-20261009
LOCAL=/private/tmp/space-journey-20261009
remote() { sshpass -e ssh $SSH_OPTS -o ConnectTimeout=15 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy() { sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
case "${1:-}" in
  upload)
    remote "mkdir -m 700 -p $UP"
    for name in request.json frontend.tar.gz; do copy "$LOCAL/$name" "$UP/$name"; done
    copy "$ROOT/scripts/releases/space-journey-20261009.py" "$UP/release.py" ;;
  verification-evidence) copy "$ROOT/artifacts/space-journey-release-20261009/candidate/verification.json" "$UP/browser-verified.json" ;;
  update-script) copy "$ROOT/scripts/releases/space-journey-20261009.py" "$UP/release.py" ;;
  stage|resume-stage|restage|build|preview|publish|verify|rollback) remote "python3 $UP/release.py $1" ;;
  reports)
    mkdir -p "$ROOT/artifacts/space-journey-release-20261009/server"
    for name in verified.json type-comparison.json baseline.json changed-files.json; do
      sshpass -e scp $SSH_OPTS "$SERVER_USER@$SERVER_HOST:/opt/systemedu/releases/space-journey-20261009/$name" "$ROOT/artifacts/space-journey-release-20261009/server/$name"
    done ;;
  tunnel) exec sshpass -e ssh $SSH_OPTS -o ExitOnForwardFailure=yes -N -L 14909:127.0.0.1:14009 "$SERVER_USER@$SERVER_HOST" ;;
  *) echo 'upload | stage | build | preview | verification-evidence | publish | verify | rollback | tunnel' >&2; exit 2 ;;
esac

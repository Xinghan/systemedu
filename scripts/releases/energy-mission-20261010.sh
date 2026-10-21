#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "${SYSTEMEDU_DEPLOY_SECRET:-$ROOT/scripts/deploy-secret.local}"; fi
UP=/tmp/energy-mission-20261010
LOCAL=/private/tmp/energy-mission-20261010
remote() { sshpass -e ssh $SSH_OPTS -o ConnectTimeout=15 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy() { sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
case "${1:-}" in
  upload)
    remote "mkdir -m 700 -p $UP"
    for name in request.json frontend.tar.gz; do copy "$LOCAL/$name" "$UP/$name"; done
    copy "$ROOT/scripts/releases/energy-mission-20261010.py" "$UP/release.py" ;;
  verification-evidence) copy "$ROOT/artifacts/energy-mission-release-20261010/candidate/verification.json" "$UP/browser-verified.json" ;;
  update-script) copy "$ROOT/scripts/releases/energy-mission-20261010.py" "$UP/release.py" ;;
  stage|resume-stage|restage|build|preview|publish|verify|rollback) remote "python3 $UP/release.py $1" ;;
  reports)
    mkdir -p "$ROOT/artifacts/energy-mission-release-20261010/server"
    for name in verified.json type-comparison.json baseline.json changed-files.json; do
      sshpass -e scp $SSH_OPTS "$SERVER_USER@$SERVER_HOST:/opt/systemedu/releases/energy-mission-20261010/$name" "$ROOT/artifacts/energy-mission-release-20261010/server/$name"
    done ;;
  tunnel) exec sshpass -e ssh $SSH_OPTS -o ExitOnForwardFailure=yes -N -L 14910:127.0.0.1:14010 "$SERVER_USER@$SERVER_HOST" ;;
  *) echo 'upload | stage | build | preview | verification-evidence | publish | verify | rollback | tunnel' >&2; exit 2 ;;
esac

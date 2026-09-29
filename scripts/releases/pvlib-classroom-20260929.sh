#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "$ROOT/scripts/deploy-secret.local"; fi
UP=/tmp/pvlib-classroom-20260929
LOCAL=/private/tmp/pvlib-classroom-20260929
remote() { sshpass -e ssh $SSH_OPTS -o ConnectTimeout=15 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy() { sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
case "${1:-}" in
  upload)
    remote "mkdir -m 700 -p $UP"
    for name in request.json frontend.tar.gz; do copy "$LOCAL/$name" "$UP/$name"; done
    copy "$ROOT/scripts/releases/pvlib-classroom-20260929.py" "$UP/release.py" ;;
  verification-evidence) copy "$ROOT/artifacts/pvlib-classroom-release-20260929/candidate/verification.json" "$UP/browser-verified.json" ;;
  update-script) copy "$ROOT/scripts/releases/pvlib-classroom-20260929.py" "$UP/release.py" ;;
  stage|resume-stage|build|preview|publish|verify|rollback) remote "python3 $UP/release.py $1" ;;
  tunnel) exec sshpass -e ssh $SSH_OPTS -o ExitOnForwardFailure=yes -N -L 14902:127.0.0.1:14002 "$SERVER_USER@$SERVER_HOST" ;;
  *) echo 'upload | stage | build | preview | verification-evidence | publish | verify | rollback | tunnel' >&2; exit 2 ;;
esac

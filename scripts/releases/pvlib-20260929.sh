#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "$ROOT/scripts/deploy-secret.local"; fi
UP=/tmp/pvlib-release-20260929
LOCAL=/private/tmp/pvlib-release-20260929
remote() { sshpass -e ssh $SSH_OPTS -o ConnectTimeout=15 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy() { sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
case "${1:-}" in
  upload)
    remote "mkdir -m 700 -p $UP"
    for name in request.json frontend.tar.gz pvlib-solar-forecast-station.tar.gz; do copy "$LOCAL/$name" "$UP/$name"; done
    copy "$ROOT/scripts/releases/pvlib-20260929.py" "$UP/release.py.next"
    remote "mv $UP/release.py.next $UP/release.py"
    ;;
  update-script)
    copy "$ROOT/scripts/releases/pvlib-20260929.py" "$UP/release.py.next"
    remote "mv $UP/release.py.next $UP/release.py"
    ;;
  stage|build|preview|publish|verify|rollback|summary)
    remote "python3 $UP/release.py $1"
    ;;
  *) echo 'upload | stage | build | preview | publish | verify | rollback | summary' >&2; exit 2;;
esac

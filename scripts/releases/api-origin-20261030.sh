#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "${SYSTEMEDU_DEPLOY_SECRET:-$ROOT/scripts/deploy-secret.local}"; fi
UP=/tmp/api-origin-20261030
LOCAL=/private/tmp/systemedu-api-origin-20261030
SSH_ARGS=(-o StrictHostKeyChecking=yes -o PreferredAuthentications=password -o PubkeyAuthentication=no -o ConnectTimeout=15)
remote() { sshpass -e ssh "${SSH_ARGS[@]}" "$SERVER_USER@$SERVER_HOST" "$@"; }
copy() { sshpass -e scp "${SSH_ARGS[@]}" "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
case "${1:-}" in
 snapshot)
  mkdir -p "$LOCAL"
  remote "umask 077; mkdir -p $UP"
  copy "$ROOT/scripts/releases/api-origin-20261030.py" "$UP/release.py"
  remote "python3 $UP/release.py snapshot" > "$LOCAL/production-baseline.json" ;;
 upload)
  for name in request.json frontend.tar.gz; do copy "$LOCAL/$name" "$UP/$name"; done
  copy "$LOCAL/production-baseline.json" "$UP/baseline.json"
  copy "$ROOT/scripts/releases/api-origin-20261030.py" "$UP/release.py"
  copy "$ROOT/scripts/releases/reuse-transit-fonts-20261030.py" "$UP/cache-fonts.py" ;;
 stage|build|preview|publish) remote "python3 $UP/release.py $1" ;;
 verify|rollback) remote "python3 /opt/systemedu/releases/api-origin-20261030/release.py $1" ;;
 evidence) copy "$ROOT/artifacts/api-origin-20261030/candidate-verification.json" "$UP/browser-verified.json" ;;
 tunnel) exec sshpass -e ssh "${SSH_ARGS[@]}" -o ExitOnForwardFailure=yes -N -L 14932:127.0.0.1:14032 "$SERVER_USER@$SERVER_HOST" ;;
 *) echo 'snapshot | upload | stage | build | preview | evidence | publish | verify | rollback | tunnel'; exit 2 ;;
esac

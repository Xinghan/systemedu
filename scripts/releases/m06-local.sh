#!/usr/bin/env bash
# Local deployment transport. Stage/build/etc remain separate invocations.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
source "$ROOT/scripts/deploy.env"
if test -z "${SSHPASS:-}"; then source "$ROOT/scripts/deploy-secret.local"; fi
remote(){ sshpass -e ssh $SSH_OPTS -o ConnectTimeout=12 "$SERVER_USER@$SERVER_HOST" "$@"; }
copy(){ sshpass -e scp $SSH_OPTS "$1" "$SERVER_USER@$SERVER_HOST:$2"; }
controls(){
 copy "$DIR/m06-release.py" /tmp/m06-release.py.next
 copy "$DIR/m06-evidence-20260911.sh" /tmp/m06-release.sh.next
 remote 'mv /tmp/m06-release.py.next /tmp/m06-release.py && mv /tmp/m06-release.sh.next /tmp/m06-release.sh'
}
if test "${1:-}" = upload; then
 copy /tmp/m06-web-delta.tar.gz /tmp/m06-web-delta.tar.gz
 copy /tmp/m06-course-delta.tar.gz /tmp/m06-course-delta.tar.gz
 copy "$ROOT/artifacts/molecule-m06-20260911/expected-source.json" /tmp/m06-expected-source.json
 copy "$ROOT/artifacts/molecule-m06-20260911/types.txt" /tmp/m06-types.txt
 controls
 copy "$ROOT/scripts/_import_courses.sh" /tmp/m06-import-courses.sh
 echo 'Only local release artifacts uploaded; no production files downloaded.'
elif test "${1:-}" = upload-controls; then
 controls
else
 case "${1:-}" in stage|refresh|build|smoke|stage-course|repack-course|audit-package|repair-package|switch|publish-course|verify) remote "bash /tmp/m06-release.sh $1";; *) echo 'Invalid step' >&2;exit 2;;esac
fi


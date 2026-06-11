#!/bin/bash
# 服务器侧执行: admin 登录 → import 两门课 tarball → publish。
# 由 deploy-student.sh do_library 上传到 /tmp 后调用。
# 依赖: /root/.systemedu-library-secrets (含 LIBRARY_BOOTSTRAP_ADMIN=admin:pw),
#       /tmp/{eeg-minecraft-bci-0.1.0,purpleair-airquality-node-0.14.1}.tar.gz
set -euo pipefail
PORT="${LIBRARY_PORT:-18821}"
BASE="http://127.0.0.1:${PORT}"

# admin 账号 (LIBRARY_BOOTSTRAP_ADMIN=admin:密码)
source /root/.systemedu-library-secrets
ADMIN_USER="${LIBRARY_BOOTSTRAP_ADMIN%%:*}"
ADMIN_PASS="${LIBRARY_BOOTSTRAP_ADMIN##*:}"

echo "[import] admin login..."
TOKEN=$(curl -s --noproxy '*' -X POST "$BASE/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
[ -z "$TOKEN" ] && { echo "login failed"; exit 1; }

import_publish() {
  local tarball="$1"
  echo "[import] $tarball ..."
  local slug
  slug=$(curl -s --noproxy '*' -X POST "$BASE/admin/projects/import" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@${tarball}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug',''))")
  [ -z "$slug" ] && { echo "  import failed for $tarball"; return 1; }
  echo "[publish] $slug ..."
  curl -s --noproxy '*' -X POST "$BASE/admin/projects/$slug/publish" \
    -H "Authorization: Bearer $TOKEN" -o /dev/null -w "  publish:%{http_code}\n"
}

import_publish /tmp/eeg-minecraft-bci-0.1.0.tar.gz
import_publish /tmp/purpleair-airquality-node-0.14.1.tar.gz
# spec 040: mars 带开篇连环画 (story/)
import_publish /tmp/mars-analog-rover-1.0.1.tar.gz

echo "[import] 验证 published projects:"
curl -s --noproxy '*' "$BASE/v1/projects" | python3 -c "import sys,json; print('  count:', len(json.load(sys.stdin)))" 2>/dev/null || echo "  (v1/projects 查询失败)"

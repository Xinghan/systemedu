#!/bin/bash
# 服务器侧执行: admin 登录 → import 每门课 tarball → publish。
# 由 deploy-student.sh do_library 调用 (上传 /tmp/<slug>.tar.gz + 传 COURSE_SLUGS)。
# 依赖: /root/.systemedu-library-secrets (含 LIBRARY_BOOTSTRAP_ADMIN=admin:pw,
#       LIBRARY_LICENSE_TOKEN), /tmp/<slug>.tar.gz (deploy 从最新源现打包)。
set -uo pipefail
PORT="${LIBRARY_PORT:-18821}"
BASE="http://127.0.0.1:${PORT}"
# 课程清单经 deploy-student.sh 传入 (deploy.env 的 COURSE_SLUGS)
SLUGS="${COURSE_SLUGS:-}"
[ -z "$SLUGS" ] && { echo "COURSE_SLUGS 为空, 无课程可导入"; exit 1; }

# admin 账号 + license token
source /root/.systemedu-library-secrets
ADMIN_USER="${LIBRARY_BOOTSTRAP_ADMIN%%:*}"
ADMIN_PASS="${LIBRARY_BOOTSTRAP_ADMIN##*:}"

echo "[import] admin login..."
TOKEN=$(curl -s --noproxy '*' -X POST "$BASE/admin/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
[ -z "$TOKEN" ] && { echo "login failed"; exit 1; }

fail=0
import_publish() {
  local slug="$1"
  local tarball="/tmp/${slug}.tar.gz"
  [ -f "$tarball" ] || { echo "  ERROR: $tarball 不存在"; fail=1; return 1; }
  echo "[import] $slug ..."
  local got_slug
  got_slug=$(curl -s --noproxy '*' -X POST "$BASE/admin/projects/import" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@${tarball}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('slug',''))" 2>/dev/null)
  [ -z "$got_slug" ] && { echo "  import failed for $slug"; fail=1; return 1; }
  echo "[publish] $got_slug ..."
  local code
  code=$(curl -s --noproxy '*' -X POST "$BASE/admin/projects/$got_slug/publish" \
    -H "Authorization: Bearer $TOKEN" -o /dev/null -w "%{http_code}")
  echo "  publish:$code"
  [ "$code" = "200" ] || fail=1
}

for slug in $SLUGS; do
  import_publish "$slug"
done

echo "[import] 验证 published projects (带 license token):"
curl -s --noproxy '*' -H "Authorization: Bearer $LIBRARY_LICENSE_TOKEN" "$BASE/v1/projects" \
  | python3 -c "
import sys,json
ps=json.load(sys.stdin)
print('  count:', len(ps))
for p in ps:
    print('   ', p['slug'], '| cover:', p.get('cover_image_path'), '| story:', len(p.get('story',[])))
" 2>/dev/null || echo "  (v1/projects 查询失败)"

[ "$fail" = "0" ] || { echo "[import] 有课程导入/发布失败"; exit 1; }
echo "[import] 全部课程 import+publish 成功"

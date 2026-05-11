#!/bin/bash
# SystemEdu 生产服务器部署脚本
# 服务器: 47.92.200.21 (阿里云 Ubuntu 24.04)
# 用途: 将本地最新代码 + 数据增量同步到生产服务器

set -e

SERVER="root@47.92.200.21"
REMOTE_DIR="/opt/systemedu"

echo "[1/5] 打包本地代码..."
tar --exclude='.venv' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='__pycache__' \
    --exclude='.pytest_cache' \
    --exclude='.ruff_cache' \
    --exclude='.git' \
    --exclude='adminsite' \
    --exclude='adminsite-fe' \
    --exclude='frontend' \
    --exclude='knowledge-tree-researcher' \
    --exclude='*.pyc' \
    -czf /tmp/systemedu_code.tar.gz .
echo "   代码包: $(du -sh /tmp/systemedu_code.tar.gz | cut -f1)"

echo "[2/5] 上传代码到服务器..."
scp -o StrictHostKeyChecking=no /tmp/systemedu_code.tar.gz ${SERVER}:/tmp/

echo "[3/5] 服务器端解压并安装依赖..."
ssh -o StrictHostKeyChecking=no ${SERVER} "bash -s" << 'ENDSSH'
set -euo pipefail
# 停止服务
systemctl stop systemedu-backend systemedu-frontend 2>/dev/null || true

# 解压代码（保留 .venv）
cd /opt/systemedu
tar -xzf /tmp/systemedu_code.tar.gz 2>/dev/null || true

# 安装 Linux 系统依赖（Python/Node/Manim/TeX/ffmpeg 等）
# 默认跳过 (大部分情况下系统依赖已就绪); 首次部署或依赖更新时取消注释下两行
# source scripts/linux_system_deps.sh
# systemedu_install_linux_system_deps && systemedu_verify_linux_runtime
echo "[skip] system deps (取消注释 deploy.sh 里 systemedu_install_linux_system_deps 强制装)"

# 准备 Python 虚拟环境
if [ ! -x .venv/bin/python ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel >/tmp/systemedu_pip_bootstrap.log 2>&1

# 重新安装 Python 依赖（spec 022 monorepo: 显式装每个 package）
python -m pip install -e packages/core >/tmp/systemedu_pip_install.log 2>&1
python -m pip install -e packages/cloud-app >>/tmp/systemedu_pip_install.log 2>&1
python -m pip install -e packages/library-app >>/tmp/systemedu_pip_install.log 2>&1
python -m pip install -e tools/content-pipeline >>/tmp/systemedu_pip_install.log 2>&1
python -m pip install dashscope manim >/tmp/systemedu_pip_media.log 2>&1 || true
tail -n 5 /tmp/systemedu_pip_install.log || true
tail -n 3 /tmp/systemedu_pip_media.log || true

# 验证媒体运行时 (manim agent 不是 spec 023 必需, warn but not fail)
python - <<'PY' || echo "[warn] manim runtime check failed (non-fatal)"
from systemedu.agents.builtin.manim_gen_agent import ManimGenAgent
profile = ManimGenAgent().runtime_profile()
required = {
    "manim_available": profile.get("manim_available"),
    "ffmpeg_available": profile.get("ffmpeg_available"),
    "latex_available": profile.get("latex_available"),
}
missing = [key for key, value in required.items() if not value]
if missing:
    print(f"WARN: Manim runtime incomplete: {missing} profile={profile}")
else:
    print("Manim runtime OK:", required)
PY

# 重新构建前端
cd web
NEXT_PUBLIC_GATEWAY_URL=http://47.92.200.21 npm install --legacy-peer-deps --quiet 2>&1 | tail -3
NEXT_PUBLIC_GATEWAY_URL=http://47.92.200.21 npm run build 2>&1 | tail -5

# --- spec 023: 编译 library-admin-ui ---
cd /opt/systemedu/packages/library-admin-ui
NEXT_PUBLIC_BASE_PATH=/library-admin NEXT_PUBLIC_LIBRARY_BASE_URL=http://47.92.200.21/library-api \
    npm install --quiet 2>&1 | tail -3
NEXT_PUBLIC_BASE_PATH=/library-admin NEXT_PUBLIC_LIBRARY_BASE_URL=http://47.92.200.21/library-api \
    npm run build 2>&1 | tail -5
ENDSSH

echo "[4/6] 更新 cloud-app systemd unit + 重启..."
ssh -o StrictHostKeyChecking=no ${SERVER} "
set -e
cd /opt/systemedu
export REPO_ROOT=/opt/systemedu HOST=47.92.200.21
# 复用 library secrets (P7 [5/6] 生成); 同时 cloud-app 需要 JWT secret
CLOUD_SECRETS=/root/.systemedu-cloud-secrets
if [ -f \"\$CLOUD_SECRETS\" ]; then
    source \"\$CLOUD_SECRETS\"
else
    CLOUD_JWT_SECRET=\$(openssl rand -hex 32)
    cat > \"\$CLOUD_SECRETS\" <<EOF
CLOUD_JWT_SECRET=\$CLOUD_JWT_SECRET
EOF
    chmod 600 \"\$CLOUD_SECRETS\"
fi
LIB_SECRETS=/root/.systemedu-library-secrets
if [ -f \"\$LIB_SECRETS\" ]; then
    source \"\$LIB_SECRETS\"
fi
export CLOUD_JWT_SECRET LIBRARY_LICENSE_TOKEN
bash scripts/install/write_systemd_nginx.sh
"

echo "[5/6] 部署 library-app + library-admin-ui systemd + nginx..."
ssh -o StrictHostKeyChecking=no ${SERVER} "
set -euo pipefail
cd /opt/systemedu
export REPO_ROOT=/opt/systemedu
export HOST=47.92.200.21
# library 鉴权 token: 优先复用已存在文件, 否则首次生成
SECRETS_FILE=/root/.systemedu-library-secrets
if [ -f \"\$SECRETS_FILE\" ]; then
    source \"\$SECRETS_FILE\"
else
    LIBRARY_JWT_SECRET=\$(openssl rand -hex 32)
    LIBRARY_LICENSE_TOKEN=\$(openssl rand -hex 32)
    LIBRARY_BOOTSTRAP_ADMIN='admin:changeme-on-first-login'
    cat > \"\$SECRETS_FILE\" <<EOF
LIBRARY_JWT_SECRET=\$LIBRARY_JWT_SECRET
LIBRARY_LICENSE_TOKEN=\$LIBRARY_LICENSE_TOKEN
LIBRARY_BOOTSTRAP_ADMIN=\$LIBRARY_BOOTSTRAP_ADMIN
EOF
    chmod 600 \"\$SECRETS_FILE\"
    echo '生成 library secrets: /root/.systemedu-library-secrets'
fi
export LIBRARY_JWT_SECRET LIBRARY_LICENSE_TOKEN LIBRARY_BOOTSTRAP_ADMIN
bash scripts/install/write_library_systemd_nginx.sh
"

echo "[6/6] 验证..."
sleep 5
STATUS=$(curl --noproxy '*' -s http://47.92.200.21/api/status | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK v' + d['version'])" 2>/dev/null || echo "FAILED")
echo "   cloud-app /api/status: $STATUS"
HTTP=$(curl --noproxy '*' -s -o /dev/null -w "%{http_code}" -L http://47.92.200.21/login)
echo "   cloud-app /login: $HTTP"
LIB_HTTP=$(curl --noproxy '*' -s -o /dev/null -w "%{http_code}" http://47.92.200.21/library-api/health)
echo "   library /health:   $LIB_HTTP"
UI_HTTP=$(curl --noproxy '*' -s -o /dev/null -w "%{http_code}" -L http://47.92.200.21/library/login)
echo "   library-ui /login: $UI_HTTP"

echo ""
echo "部署完成!"
echo "  cloud-app:        http://47.92.200.21/login   (自助注册 → /library)"
echo "  cloud-app library: http://47.92.200.21/library (学生学习入口)"
echo "  library admin:    http://47.92.200.21/library-admin/login (admin / changeme-on-first-login)"
echo "  library API:      http://47.92.200.21/library-api/v1/  (license token in /root/.systemedu-library-secrets)"

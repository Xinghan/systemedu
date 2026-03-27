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
source scripts/linux_system_deps.sh
systemedu_install_linux_system_deps
systemedu_verify_linux_runtime

# 准备 Python 虚拟环境
if [ ! -x .venv/bin/python ]; then
    python3 -m venv .venv
fi
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel >/tmp/systemedu_pip_bootstrap.log 2>&1

# 重新安装 Python 依赖（如有变更）
python -m pip install -e . >/tmp/systemedu_pip_install.log 2>&1
python -m pip install dashscope manim >/tmp/systemedu_pip_media.log 2>&1
tail -n 3 /tmp/systemedu_pip_install.log || true
tail -n 3 /tmp/systemedu_pip_media.log || true

# 验证媒体运行时
python - <<'PY'
from systemedu.agents.builtin.manim_gen_agent import ManimGenAgent
profile = ManimGenAgent().runtime_profile()
required = {
    "manim_available": profile.get("manim_available"),
    "ffmpeg_available": profile.get("ffmpeg_available"),
    "latex_available": profile.get("latex_available"),
}
missing = [key for key, value in required.items() if not value]
if missing:
    raise SystemExit(f"Manim runtime incomplete: {missing} profile={profile}")
print("Manim runtime OK:", required)
PY

# 重新构建前端
cd web
NEXT_PUBLIC_GATEWAY_URL=http://47.92.200.21 npm install --legacy-peer-deps --quiet 2>&1 | tail -3
NEXT_PUBLIC_GATEWAY_URL=http://47.92.200.21 npm run build 2>&1 | tail -5
ENDSSH

echo "[4/5] 重启服务..."
ssh -o StrictHostKeyChecking=no ${SERVER} "
systemctl start systemedu-backend
sleep 2
systemctl start systemedu-frontend
systemctl reload nginx
"

echo "[5/5] 验证..."
sleep 5
STATUS=$(curl --noproxy '*' -s http://47.92.200.21/api/status | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK v' + d['version'])" 2>/dev/null || echo "FAILED")
echo "   Backend: $STATUS"
HTTP=$(curl --noproxy '*' -s -o /dev/null -w "%{http_code}" -L http://47.92.200.21/login)
echo "   Frontend /login: $HTTP"

echo ""
echo "部署完成! 访问: http://47.92.200.21"
echo "账号: root / 123systemedu"

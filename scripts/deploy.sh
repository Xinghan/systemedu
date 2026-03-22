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
set -e
# 停止服务
systemctl stop systemedu-backend systemedu-frontend 2>/dev/null || true

# 解压代码（保留 .venv）
cd /opt/systemedu
tar -xzf /tmp/systemedu_code.tar.gz 2>/dev/null || true

# 重新安装 Python 依赖（如有变更）
source .venv/bin/activate
pip install -e . --quiet 2>&1 | tail -3
pip install dashscope --quiet 2>&1 | tail -1

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

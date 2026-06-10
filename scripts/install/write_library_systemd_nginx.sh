#!/usr/bin/env bash
# spec 023 P7: 服务器端装 library-app + library-admin-ui 的 systemd unit
# 并把 nginx 路由扩到 /library/ + /library-api/
#
# 依赖环境变量 (从 deploy.sh 传):
#   REPO_ROOT  - /opt/systemedu (仓库根)
#   HOST       - 对外 IP/域名 (见 deploy.env SERVER_HOST)
#   LIBRARY_JWT_SECRET    - JWT 签名密钥 (生产必须设)
#   LIBRARY_LICENSE_TOKEN - 公开 API 服务间共享 token
#   LIBRARY_BOOTSTRAP_ADMIN - 首次部署 admin bootstrap, 形如 user:pass (可空)

set -euo pipefail

: "${REPO_ROOT:?REPO_ROOT must be set}"
: "${HOST:?HOST must be set}"
: "${LIBRARY_JWT_SECRET:?LIBRARY_JWT_SECRET must be set}"
: "${LIBRARY_LICENSE_TOKEN:?LIBRARY_LICENSE_TOKEN must be set}"
LIBRARY_BOOTSTRAP_ADMIN="${LIBRARY_BOOTSTRAP_ADMIN:-}"

say()  { echo -e "  \033[0;34m[library]\033[0m $*"; }
warn() { echo -e "  \033[1;33m[library warn]\033[0m $*"; }

# ---------------------------------------------------------------------------
# 1. library-app (FastAPI) systemd unit, port 18821
# ---------------------------------------------------------------------------
say "写 /etc/systemd/system/systemedu-library.service"
cat > /etc/systemd/system/systemedu-library.service <<UNIT
[Unit]
Description=SystemEdu Library Content Service (FastAPI)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REPO_ROOT
ExecStart=$REPO_ROOT/.venv/bin/python -m uvicorn library.main:app --host 127.0.0.1 --port 18821
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=HOME=/root
Environment=LIBRARY_HOME=/root/.systemedu-library
Environment=LIBRARY_HOST=127.0.0.1
Environment=LIBRARY_PORT=18821
Environment=LIBRARY_JWT_SECRET=$LIBRARY_JWT_SECRET
Environment=LIBRARY_LICENSE_TOKEN=$LIBRARY_LICENSE_TOKEN
Environment=LIBRARY_JWT_EXPIRE_HOURS=720
Environment="LIBRARY_CORS_ORIGINS=http://$HOST,http://localhost:3001"
UNIT

if [ -n "$LIBRARY_BOOTSTRAP_ADMIN" ]; then
    say "Bootstrap admin will be created on first run: ${LIBRARY_BOOTSTRAP_ADMIN%%:*}"
    echo "Environment=LIBRARY_BOOTSTRAP_ADMIN=$LIBRARY_BOOTSTRAP_ADMIN" \
        >> /etc/systemd/system/systemedu-library.service
fi

cat >> /etc/systemd/system/systemedu-library.service <<'UNIT2'

[Install]
WantedBy=multi-user.target
UNIT2

# ---------------------------------------------------------------------------
# 2. library-admin-ui (Next.js) systemd unit, port 3001
# ---------------------------------------------------------------------------
say "写 /etc/systemd/system/systemedu-library-ui.service"
cat > /etc/systemd/system/systemedu-library-ui.service <<UNIT
[Unit]
Description=SystemEdu Library Admin UI (Next.js)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REPO_ROOT/packages/library-admin-ui
ExecStart=/usr/bin/npm start -- -p 3001
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=PORT=3001
Environment=NEXT_PUBLIC_BASE_PATH=/library-admin
Environment=NEXT_PUBLIC_LIBRARY_BASE_URL=http://$HOST/library-api

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable systemedu-library systemedu-library-ui >/dev/null 2>&1

# ---------------------------------------------------------------------------
# 3. nginx: 把 /library/* 给 admin UI, /library-api/* 给 FastAPI
#    现有 / 和 /api/ 路由保持给 cloud-app
# ---------------------------------------------------------------------------
say "更新 /etc/nginx/sites-available/systemedu (加 /library + /library-api)"

# 用 sed 找到 cloud-app server { ... } 结尾的最后一个 } 之前插入新 location
# 安全起见, 重写整个 sites-available/systemedu, 包含 4 个 location:
#   /            → cloud-app web (3000)
#   /api/        → cloud-app gateway (18820)
#   /api/chat/stream → SSE
#   /library/    → library-admin-ui (3001)
#   /library-api/ → library-app (18821), 去掉前缀
cat > /etc/nginx/sites-available/systemedu <<NGINX
server {
    listen 80;
    server_name $HOST;
    client_max_body_size 500M;

    # --- cloud-app (主站学习系统) ---
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:18820;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    location /api/chat/stream {
        proxy_pass http://127.0.0.1:18820;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600s;
    }

    # --- library admin UI (spec 023, 路径 /library-admin/ 避免跟
    #     cloud-app web 学习路径 /library 冲突 - spec 024-A 后) ---
    location /library-admin/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # /library-api/v1/*  → library FastAPI /v1/*   (公开 API)
    # /library-api/admin/* → library FastAPI /admin/* (admin API)
    location /library-api/ {
        rewrite ^/library-api/(.*)\$ /\$1 break;
        proxy_pass http://127.0.0.1:18821;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        # 大 tarball 上传需要
        client_max_body_size 500M;
    }
}
NGINX

if ! nginx -t >/dev/null 2>&1; then
    warn "nginx 配置语法有误"
    nginx -t || true
    exit 1
fi

# ---------------------------------------------------------------------------
# 4. 启动
# ---------------------------------------------------------------------------
say "启动 systemedu-library + systemedu-library-ui"
systemctl restart systemedu-library
sleep 2
systemctl restart systemedu-library-ui
sleep 3
systemctl reload nginx

say "状态:"
echo "  library:     $(systemctl is-active systemedu-library)"
echo "  library-ui:  $(systemctl is-active systemedu-library-ui)"

# 5. 健康检查
if curl -fsS --connect-timeout 5 "http://127.0.0.1:18821/health" >/dev/null 2>&1; then
    say "library /health (内部 18821) → OK"
else
    warn "library /health 未通, 检查 journalctl -u systemedu-library -n 50"
fi
if curl -fsS --connect-timeout 5 "http://127.0.0.1:3001/login" -o /dev/null 2>&1; then
    say "library-ui /login (内部 3001) → OK"
else
    warn "library-ui 未通, 检查 journalctl -u systemedu-library-ui -n 50"
fi

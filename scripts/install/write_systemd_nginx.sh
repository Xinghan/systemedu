#!/usr/bin/env bash
# spec 018: server 模式下装 systemd unit + nginx site
#
# 由 install.sh 调起，仅在 MODE=server 时执行。
# 依赖以下已 export 的环境变量：
#   REPO_ROOT - 仓库根目录
#   HOST      - 对外 IP/域名

set -euo pipefail

: "${REPO_ROOT:?REPO_ROOT must be set}"
: "${HOST:?HOST must be set}"

say()  { echo -e "  \033[0;34m[server]\033[0m $*"; }
warn() { echo -e "  \033[1;33m[server warn]\033[0m $*"; }

# --- systemd backend unit ---
say "写 /etc/systemd/system/systemedu-backend.service"
cat > /etc/systemd/system/systemedu-backend.service <<UNIT
[Unit]
Description=SystemEdu Gateway Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REPO_ROOT
ExecStart=$REPO_ROOT/.venv/bin/python -m systemedu.cloud.gateway.server
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=HOME=/root
# spec 024-A: cloud-app 连 library + JWT secret
Environment=LIBRARY_URL=http://127.0.0.1:18821
Environment=LIBRARY_LICENSE_TOKEN=${LIBRARY_LICENSE_TOKEN:-dev-only-license-token-change-me}
Environment=CLOUD_JWT_SECRET=${CLOUD_JWT_SECRET:-dev-only-cloud-jwt-secret-change-me}

[Install]
WantedBy=multi-user.target
UNIT

# --- systemd frontend unit ---
say "写 /etc/systemd/system/systemedu-frontend.service"
cat > /etc/systemd/system/systemedu-frontend.service <<UNIT
[Unit]
Description=SystemEdu Next.js Frontend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REPO_ROOT/web
ExecStart=/usr/bin/npm start -- -p 3000
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=PORT=3000
Environment=NEXT_PUBLIC_GATEWAY_URL=http://$HOST

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable systemedu-backend systemedu-frontend >/dev/null 2>&1

# --- nginx ---
say "写 /etc/nginx/sites-available/systemedu"
cat > /etc/nginx/sites-available/systemedu <<NGINX
server {
    listen 80;
    server_name $HOST;
    client_max_body_size 50M;

    # 前端
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:18820;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        # 知识树生成 / 课程内容生成等 LLM 调用偶尔慢, 给到 10 分钟
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    # WebSocket / SSE
    location /api/chat/stream {
        proxy_pass http://127.0.0.1:18820;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600s;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/systemedu /etc/nginx/sites-enabled/systemedu
rm -f /etc/nginx/sites-enabled/default

if ! nginx -t >/dev/null 2>&1; then
    warn "nginx 配置语法可能有误："
    nginx -t || true
    exit 1
fi
say "nginx 配置 OK"

# --- 启动 ---
say "重启服务"
systemctl restart systemedu-backend
sleep 3
systemctl restart systemedu-frontend
sleep 2
systemctl restart nginx
sleep 2

# --- 健康检查 ---
say "状态: backend=$(systemctl is-active systemedu-backend) frontend=$(systemctl is-active systemedu-frontend) nginx=$(systemctl is-active nginx)"

if curl -fsS --connect-timeout 5 "http://127.0.0.1:18820/api/status" >/dev/null 2>&1; then
    say "/api/status (内部) → OK"
else
    warn "/api/status (内部) 暂不可达，可能 startup 还未完成；用 journalctl -u systemedu-backend -n 50 查看"
fi

#!/bin/bash
# 部署 student-app 新架构到生产 (读 scripts/deploy.env)。
# 替代废弃的 deploy.sh (那个部署 cloud-app)。
#
# 用法 (密码经 SSHPASS env, 不进命令行历史):
#   export SSHPASS='密码'
#   ./scripts/deploy-student.sh <step>
# steps: pack | code | infra | library | student | web | nginx | verify | all
#
# 动生产: 建议逐 step 跑 + 每步看结果, 别直接 all。
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DIR")"
source "$DIR/deploy.env"
[ -z "${SSHPASS:-}" ] && { echo "need: export SSHPASS='...'"; exit 1; }

remote() { sshpass -e ssh $SSH_OPTS "${SERVER_USER}@${SERVER_HOST}" "$@"; }
copy()   { sshpass -e scp $SSH_OPTS "$1" "${SERVER_USER}@${SERVER_HOST}:$2"; }

do_pack() {
  echo "[pack] 打包 main 代码..."
  cd "$ROOT"
  git rev-parse --abbrev-ref HEAD | grep -qx 'main' || echo "  (警告: 当前不在 main, 确认这是你要部署的代码)"
  # 排除: venv/git/所有 node_modules/构建产物/本地数据/废弃老前端 web/数字人/设计稿/课程工作区
  # COPYFILE_DISABLE=1: 防止 macOS tar 带 AppleDouble ._* 文件 (会被 alembic 当 .py 误读 → null bytes)
  COPYFILE_DISABLE=1 tar \
      --exclude='._*' \
      --exclude='.venv' --exclude='.git' --exclude='.run' --exclude='.data' \
      --exclude='node_modules' --exclude='*/node_modules' --exclude='*/*/node_modules' \
      --exclude='.next' --exclude='*/.next' --exclude='*/*/.next' \
      --exclude='content-workspace' --exclude='web' --exclude='dighuman' \
      --exclude='stitch_systemedu_dashboard' --exclude='*.tar.gz' \
      --exclude='packages/cloud-app' \
      -czf /tmp/systemedu_student.tar.gz .
  echo "[pack] 包大小: $(du -sh /tmp/systemedu_student.tar.gz | cut -f1)"
}

do_code() {
  echo "[code] 上传 + 解压..."
  copy /tmp/systemedu_student.tar.gz /tmp/
  remote "mkdir -p $REPO_ROOT && tar -xzf /tmp/systemedu_student.tar.gz -C $REPO_ROOT"
  echo "[code] venv + 依赖..."
  remote "cd $REPO_ROOT && python3 -m venv .venv && \
    .venv/bin/pip install -q --upgrade pip && \
    .venv/bin/pip install -q -e packages/core -e packages/library-app -e packages/student-app 2>&1 | tail -3"
  echo "[code] 验证 import..."
  remote "cd $REPO_ROOT && .venv/bin/python -c 'import systemedu.student.server, library.main; print(\"import OK\")'"
}

do_infra() {
  echo "[infra] 装 Docker (若无)..."
  remote "which docker >/dev/null 2>&1 || (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-v2)"
  # 国内服务器 docker.io 直连超时, 配可用镜像加速 (daocloud/1panel)
  remote "mkdir -p /etc/docker && cat > /etc/docker/daemon.json <<EOF
{
  \"registry-mirrors\": [\"https://docker.m.daocloud.io\", \"https://docker.1panel.live\"]
}
EOF"
  remote "systemctl enable docker && systemctl restart docker && sleep 3"
  echo "[infra] 起 PG + Redis (不起 qdrant)..."
  remote "cd $REPO_ROOT && docker compose up -d postgres redis"
  sleep 8
  remote "cd $REPO_ROOT && docker compose ps"
}

do_library() {
  echo "[library] secrets..."
  remote "test -f /root/.systemedu-library-secrets || { \
    echo \"LIBRARY_LICENSE_TOKEN=\$(openssl rand -hex 24)\" > /root/.systemedu-library-secrets; \
    echo \"LIBRARY_JWT_SECRET=\$(openssl rand -hex 24)\" >> /root/.systemedu-library-secrets; \
    echo \"LIBRARY_BOOTSTRAP_ADMIN=admin:\$(openssl rand -hex 8)\" >> /root/.systemedu-library-secrets; }"
  echo "[library] systemd unit..."
  remote "cat > /etc/systemd/system/systemedu-library.service <<EOF
[Unit]
Description=SystemEdu Library
After=network.target
[Service]
WorkingDirectory=$REPO_ROOT
EnvironmentFile=/root/.systemedu-library-secrets
Environment=LIBRARY_HOME=/root/.systemedu-library
ExecStart=$REPO_ROOT/.venv/bin/uvicorn library.main:app --host 127.0.0.1 --port $LIBRARY_PORT --app-dir packages/library-app/src
Restart=always
[Install]
WantedBy=multi-user.target
EOF"
  remote "systemctl daemon-reload && systemctl enable systemedu-library && systemctl restart systemedu-library && sleep 3 && systemctl is-active systemedu-library"
  echo "[library] 从最新源现打包课程 tarball..."
  # 根因 (2026-06-12): 旧版从 _archive/<slug>-<写死版本>.tar.gz 上传, 是导入时的
  # 旧快照, 跟项目最新源脱节 — 封面/story 等后续更新会丢 (purpleair/eeg 封面消失即此)。
  # 改为部署时从 COURSE_SRC 最新源现打包: 部署什么 = 源目录里有什么, 永不丢更新。
  : "${COURSE_SRC:=$HOME/Dev/systemeduidea/projects_data}"
  for slug in $COURSE_SLUGS; do
    src="$COURSE_SRC/$slug"
    [ -d "$src" ] || { echo "  ERROR: 源目录不存在 $src"; exit 1; }
    [ -f "$src/manifest.json" ] || { echo "  ERROR: $src 无 manifest.json"; exit 1; }
    echo "  打包 $slug (从 $src)..."
    COPYFILE_DISABLE=1 tar --exclude='._*' --exclude='_archive' \
        -czf "/tmp/$slug.tar.gz" -C "$(dirname "$src")" "$slug"
    copy "/tmp/$slug.tar.gz" /tmp/
  done
  echo "[library] import + publish (服务器侧)..."
  copy "$DIR/_import_courses.sh" /tmp/_import_courses.sh
  remote "LIBRARY_PORT=$LIBRARY_PORT COURSE_SLUGS='$COURSE_SLUGS' bash /tmp/_import_courses.sh"
}

do_student() {
  echo "[student] secrets..."
  remote "test -f /root/.systemedu-student-secrets || echo \"STUDENT_JWT_SECRET=\$(openssl rand -hex 24)\" > /root/.systemedu-student-secrets"
  remote "grep -q STUDENT_DB_URL /root/.systemedu-student-secrets || cat >> /root/.systemedu-student-secrets <<EOF
STUDENT_DB_URL=postgresql+psycopg2://systemedu:systemedu@127.0.0.1:5432/student
STUDENT_REDIS_URL=redis://127.0.0.1:6379/0
LIBRARY_BASE_URL=http://127.0.0.1:$LIBRARY_PORT
EOF"
  remote "grep -q LIBRARY_LICENSE_TOKEN /root/.systemedu-student-secrets || grep LIBRARY_LICENSE_TOKEN /root/.systemedu-library-secrets >> /root/.systemedu-student-secrets"
  # 阿里云短信 ALIYUN_SMS_* (KEY/SECRET/ENDPOINT/SIGN/TEMPLATE/DEBUG) 不在此脚本管理:
  # 含 AccessKey, 由人工一次性手动写进服务器 /root/.systemedu-student-secrets (不进 git)。
  # 缺失时 send_sms_code 在 DEBUG=false 下会失败; 部署后用 verify 步骤确认登录可用。
  echo "[student] 复制本地 config.yaml (LLM key) + 关 memory..."
  # 本地 config 含可用 LLM key; 复制到生产, memory.enabled 改 false (无 Qdrant)
  remote "mkdir -p /root/.systemedu"
  tmpcfg=$(mktemp)
  # memory.enabled: true -> false (sed 在 memory: 段; 简单做法: 全局把 'enabled: true' 在 memory 段下改)
  python3 - "$HOME/.systemedu/config.yaml" "$tmpcfg" <<'PY'
import sys, re
src, dst = sys.argv[1], sys.argv[2]
lines = open(src, encoding="utf-8").read().splitlines(keepends=True)
out, in_mem = [], False
for ln in lines:
    if re.match(r'^memory:', ln): in_mem = True
    elif re.match(r'^\S', ln): in_mem = False
    if in_mem and re.match(r'^\s+enabled:\s*true', ln):
        ln = re.sub(r'enabled:\s*true', 'enabled: false', ln)
    out.append(ln)
open(dst, "w", encoding="utf-8").write("".join(out))
PY
  copy "$tmpcfg" /root/.systemedu/config.yaml
  rm -f "$tmpcfg"
  echo "[student] alembic 迁移..."
  remote "cd $REPO_ROOT/packages/student-app && set -a; source /root/.systemedu-student-secrets; set +a; $REPO_ROOT/.venv/bin/alembic upgrade head 2>&1 | tail -3"
  echo "[student] systemd backend + worker..."
  remote "cat > /etc/systemd/system/systemedu-student-backend.service <<EOF
[Unit]
Description=SystemEdu Student Backend
After=network.target docker.service
[Service]
WorkingDirectory=$REPO_ROOT
EnvironmentFile=/root/.systemedu-student-secrets
Environment=STUDENT_PORT=$STUDENT_BACKEND_PORT
Environment=STUDENT_BIND_HOST=127.0.0.1
ExecStart=$REPO_ROOT/.venv/bin/python -m systemedu.student.server
Restart=always
[Install]
WantedBy=multi-user.target
EOF"
  remote "cat > /etc/systemd/system/systemedu-student-worker.service <<EOF
[Unit]
Description=SystemEdu Fact Extractor Worker
After=network.target
[Service]
WorkingDirectory=$REPO_ROOT
EnvironmentFile=/root/.systemedu-student-secrets
ExecStart=$REPO_ROOT/.venv/bin/python -m systemedu.student.workers.fact_extractor_worker
Restart=always
[Install]
WantedBy=multi-user.target
EOF"
  remote "systemctl daemon-reload && systemctl enable systemedu-student-backend systemedu-student-worker && systemctl restart systemedu-student-backend systemedu-student-worker && sleep 5 && systemctl is-active systemedu-student-backend"
}

do_web() {
  echo "[web] npm ci + build (API 走相对路径 /api, 同源经 nginx)..."
  remote "cd $REPO_ROOT/packages/student-web && npm ci --silent 2>&1 | tail -2"
  # NEXT_PUBLIC_STUDENT_API_URL="" (空) → 前端用相对路径 /api/..., 自动跟随访问页面的
  # 协议+域名 (HTTP/HTTPS、IP/域名都对), 不再写死绝对地址 (修协议错配/跨域/ICP 拦截)。
  remote "cd $REPO_ROOT/packages/student-web && NEXT_PUBLIC_STUDENT_API_URL='' NEXT_PUBLIC_GATEWAY_URL='' npm run build 2>&1 | tail -6"
  echo "[web] systemd unit..."
  remote "cat > /etc/systemd/system/systemedu-student-web.service <<EOF
[Unit]
Description=SystemEdu Student Web
After=network.target
[Service]
WorkingDirectory=$REPO_ROOT/packages/student-web
Environment=PORT=$STUDENT_WEB_PORT
Environment=NEXT_PUBLIC_STUDENT_API_URL=
Environment=NEXT_PUBLIC_GATEWAY_URL=
ExecStart=/usr/bin/npm run start
Restart=always
[Install]
WantedBy=multi-user.target
EOF"
  # enable (开机自启) + restart (强制用新 build; --now 在已 active 时不会重启, 会跑旧产物)
  remote "systemctl daemon-reload && systemctl enable systemedu-student-web && systemctl restart systemedu-student-web && sleep 6 && systemctl is-active systemedu-student-web"
}

do_nginx() {
  echo "[nginx] 停老 cloud-app + 切 nginx (这步起对外生效)..."
  remote "systemctl disable --now systemedu-backend systemedu-frontend 2>/dev/null || true"
  # 证书齐全 (SSL_DOMAIN 非空 + pem/key 都在 SSL_CERT_DIR) -> 生成 HTTPS 配置, 否则纯 HTTP。
  # 在服务器侧判断证书是否存在, 据此写两种配置之一。证书需人工上传 (不进 git)。
  remote "
    PEM='$SSL_CERT_DIR/$SSL_DOMAIN.pem'; KEY='$SSL_CERT_DIR/$SSL_DOMAIN.key'
    if [ -n '$SSL_DOMAIN' ] && [ -f \"\$PEM\" ] && [ -f \"\$KEY\" ]; then
      echo '[nginx] 检测到证书 -> 写 HTTPS 配置 (+ IP 直连开放, 域名未备案期间暂用)'
      cat > /etc/nginx/sites-available/systemedu <<EOF
# 域名 80 -> 跳 HTTPS (ICP 备案通过后生效)
server {
  listen 80;
  server_name $SSL_DOMAIN $SSL_DOMAIN_ALT;
  return 301 https://\\\$host\\\$request_uri;
}
# IP / 其它 80 -> 直接反代 (域名未备案被阿里云 SNI 阻断期间, 用 http://IP 直连)
server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 50m;
  location /api/ {
    proxy_pass http://127.0.0.1:$STUDENT_BACKEND_PORT;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \\\$http_upgrade;
    proxy_set_header Connection \"upgrade\";
    proxy_read_timeout 300s;
  }
  location / {
    proxy_pass http://127.0.0.1:$STUDENT_WEB_PORT;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
  }
}
server {
  listen 443 ssl http2 default_server;
  server_name $SSL_DOMAIN $SSL_DOMAIN_ALT;
  ssl_certificate     $SSL_CERT_DIR/$SSL_DOMAIN.pem;
  ssl_certificate_key $SSL_CERT_DIR/$SSL_DOMAIN.key;
  ssl_protocols       TLSv1.2 TLSv1.3;
  ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
  ssl_prefer_server_ciphers off;
  ssl_session_cache   shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_session_tickets off;
  add_header Strict-Transport-Security \"max-age=15768000; includeSubDomains\" always;
  client_max_body_size 50m;
  location /api/ {
    proxy_pass http://127.0.0.1:$STUDENT_BACKEND_PORT;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \\\$http_upgrade;
    proxy_set_header Connection \"upgrade\";
    proxy_read_timeout 300s;
  }
  location / {
    proxy_pass http://127.0.0.1:$STUDENT_WEB_PORT;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
  }
}
EOF
    else
      echo '[nginx] 无证书 -> 写纯 HTTP 配置 (上传证书到 $SSL_CERT_DIR 后重跑 nginx 步骤启 HTTPS)'
      cat > /etc/nginx/sites-available/systemedu <<EOF
server {
  listen 80 default_server;
  server_name _;
  client_max_body_size 50m;
  location /api/ {
    proxy_pass http://127.0.0.1:$STUDENT_BACKEND_PORT;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \\\$http_upgrade;
    proxy_set_header Connection \"upgrade\";
    proxy_read_timeout 300s;
  }
  location / {
    proxy_pass http://127.0.0.1:$STUDENT_WEB_PORT;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
  }
}
EOF
    fi
  "
  remote "ln -sf /etc/nginx/sites-available/systemedu /etc/nginx/sites-enabled/systemedu && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx"
}

do_verify() {
  echo "[verify] backend health:"; remote "curl -s --noproxy '*' http://127.0.0.1:$STUDENT_BACKEND_PORT/api/health; echo"
  echo "[verify] web:"; remote "curl -s --noproxy '*' -o /dev/null -w 'web:%{http_code}\n' http://127.0.0.1:$STUDENT_WEB_PORT/"
  echo "[verify] library projects (经反代):"; remote "curl -s --noproxy '*' http://127.0.0.1:$STUDENT_BACKEND_PORT/api/library/projects | head -c 200; echo"
  echo "[verify] 对外 nginx:"; remote "curl -s --noproxy '*' -o /dev/null -w 'public:%{http_code}\n' http://127.0.0.1/api/health"
}

case "${1:-}" in
  pack) do_pack;;
  code) do_code;;
  infra) do_infra;;
  library) do_library;;
  student) do_student;;
  web) do_web;;
  nginx) do_nginx;;
  verify) do_verify;;
  all) do_pack; do_code; do_infra; do_library; do_student; do_web; do_nginx; do_verify;;
  *) echo "usage: SSHPASS=... $0 {pack|code|infra|library|student|web|nginx|verify|all}"; exit 1;;
esac

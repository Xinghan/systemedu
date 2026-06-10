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
  tar \
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
  remote "which docker >/dev/null 2>&1 || (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io docker-compose-plugin)"
  remote "systemctl enable --now docker"
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
  remote "systemctl daemon-reload && systemctl enable --now systemedu-library && sleep 3 && systemctl is-active systemedu-library"
  echo "[library] 上传两门课 tarball..."
  copy "$HOME/.systemedu-library/media/projects/eeg-minecraft-bci/_archive/eeg-minecraft-bci-0.1.0.tar.gz" /tmp/
  copy "$HOME/.systemedu-library/media/projects/purpleair-airquality-node/_archive/purpleair-airquality-node-0.14.1.tar.gz" /tmp/
  echo "[library] import + publish (服务器侧)..."
  copy "$DIR/_import_courses.sh" /tmp/_import_courses.sh
  remote "LIBRARY_PORT=$LIBRARY_PORT bash /tmp/_import_courses.sh"
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
  remote "systemctl daemon-reload && systemctl enable --now systemedu-student-backend systemedu-student-worker && sleep 5 && systemctl is-active systemedu-student-backend"
}

do_web() {
  echo "[web] npm ci + build (API 指向生产)..."
  remote "cd $REPO_ROOT/packages/student-web && npm ci --silent 2>&1 | tail -2"
  remote "cd $REPO_ROOT/packages/student-web && NEXT_PUBLIC_STUDENT_API_URL=$PUBLIC_URL npm run build 2>&1 | tail -6"
  echo "[web] systemd unit..."
  remote "cat > /etc/systemd/system/systemedu-student-web.service <<EOF
[Unit]
Description=SystemEdu Student Web
After=network.target
[Service]
WorkingDirectory=$REPO_ROOT/packages/student-web
Environment=PORT=$STUDENT_WEB_PORT
Environment=NEXT_PUBLIC_STUDENT_API_URL=$PUBLIC_URL
ExecStart=/usr/bin/npm run start
Restart=always
[Install]
WantedBy=multi-user.target
EOF"
  remote "systemctl daemon-reload && systemctl enable --now systemedu-student-web && sleep 6 && systemctl is-active systemedu-student-web"
}

do_nginx() {
  echo "[nginx] 停老 cloud-app + 切 nginx (这步起对外生效)..."
  remote "systemctl disable --now systemedu-backend systemedu-frontend 2>/dev/null || true"
  remote "cat > /etc/nginx/sites-available/systemedu <<EOF
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
EOF"
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

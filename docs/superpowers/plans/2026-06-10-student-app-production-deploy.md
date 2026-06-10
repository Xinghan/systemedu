# student-app 新架构生产部署 + 配置集中 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (本计划含动生产、不可逆步骤, 逐步执行 + 每步人工 checkpoint, 不要一口气跑完)。Steps use checkbox (`- [ ]`).

**Goal:** 把 student-app 新架构 (student-app + student-web + library-app + PG/Redis) 部署到新生产服务器 47.106.220.119, 替换废弃 cloud-app; 同时把散落的部署 IP 集中到 scripts/deploy.env。

**Architecture:** 三阶段。A 本地: 建 deploy.env 单一配置源, 活跃脚本改读它, 更新 CLAUDE/docker README 新 IP (历史 spec 不动)。B 本地: 写 deploy-student.sh 全新部署脚本 (读 deploy.env)。C 生产 (逐步, 不可逆, 每步验证+回滚点): 装 Docker → 起 PG/Redis → 部署 library+导两门课 → 部署 student-app(alembic) → 部署 student-web(build) → nginx 切换 → 端到端验收。

**Tech Stack:** bash, ssh (密码, sshpass), Docker compose, alembic, nginx, systemd, Next.js build。

**关联 spec:** docs/superpowers/specs/2026-06-08-student-app-production-deploy-design.md (已更新新服务器)。

**服务器:** 47.106.220.119, root, 密码登录。SSH 必须加 `-o PreferredAuthentications=password -o PubkeyAuthentication=no` (否则先试 publickey 失败)。密码经 SSHPASS env 传 (不进命令行)。

---

## File Structure
- `scripts/deploy.env` (Create) — 部署信息单一配置源 (SERVER_HOST/USER/端口/路径/license)。
- `scripts/server-ssh.sh` (Modify) — source deploy.env, 用 $SERVER_HOST + 密码 SSH 选项。
- `scripts/deploy-student.sh` (Create) — 全新 student-app 部署脚本 (替代废弃 deploy.sh 的角色)。
- `scripts/install/write_library_systemd_nginx.sh` (Modify) — HOST 注释更新 (实际 IP 走 env)。
- `CLAUDE.md` (Modify) — 生产服务器章节更新新 IP。
- `docker/README.md` (Modify) — IP 更新。
- `scripts/deploy.sh` (保留不动) — 废弃 cloud-app 部署, 留作历史/回滚参考。

---

## 阶段 A: 配置集中 (本地, 可验证, 无副作用)

### Task A1: 建 deploy.env 单一配置源

**Files:** Create `scripts/deploy.env`

- [ ] **Step 1: 写 deploy.env**

```bash
# scripts/deploy.env — 部署信息单一来源 (所有部署脚本 source 它)
# 换服务器只改这里。

# 生产服务器
SERVER_HOST=47.106.220.119
SERVER_USER=root
# SSH: 该服务器走密码登录, 需强制密码认证 (否则先试 publickey 失败)
SSH_OPTS="-o StrictHostKeyChecking=no -o PreferredAuthentications=password -o PubkeyAuthentication=no"
# 密码不写进文件 — 运行时经 SSHPASS 环境变量传入: export SSHPASS='...'; sshpass -e ssh ...

# 服务器路径
REPO_ROOT=/opt/systemedu

# 服务端口
STUDENT_BACKEND_PORT=18820
STUDENT_WEB_PORT=4000
LIBRARY_PORT=18821

# 对外访问 (nginx :80)
PUBLIC_URL=http://47.106.220.119
```

- [ ] **Step 2: 验证可 source + 变量齐全**

Run: `cd /Users/xinghan/Dev/systemedu && bash -c 'source scripts/deploy.env && echo "host=$SERVER_HOST port=$STUDENT_BACKEND_PORT repo=$REPO_ROOT url=$PUBLIC_URL"'`
Expected: `host=47.106.220.119 port=18820 repo=/opt/systemedu url=http://47.106.220.119`

- [ ] **Step 3: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add scripts/deploy.env
git commit -m "chore: deploy.env 部署信息单一配置源 (新服务器 47.106.220.119)"
```

### Task A2: server-ssh.sh 改读 deploy.env + 密码 SSH

**Files:** Modify `scripts/server-ssh.sh`

- [ ] **Step 1: 看现有 server-ssh.sh**

Run: `cat /Users/xinghan/Dev/systemedu/scripts/server-ssh.sh`
记下结构 (现在写死 `SERVER="root@47.92.200.21"` + `ssh -o StrictHostKeyChecking=no`)。

- [ ] **Step 2: 改为 source deploy.env + 密码 SSH**

整体替换 server-ssh.sh 为:
```bash
#!/bin/bash
# SSH 到生产服务器 (配置读 scripts/deploy.env)。
# 用法:
#   SSHPASS='密码' ./scripts/server-ssh.sh                  # 交互式 (需 sshpass)
#   SSHPASS='密码' ./scripts/server-ssh.sh "systemctl status systemedu-student-backend"
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/deploy.env"

if [ -z "$SSHPASS" ]; then
  echo "需要密码: export SSHPASS='...' 再运行 (该服务器走密码登录)" >&2
  exit 1
fi

if [ -z "$1" ]; then
  sshpass -e ssh $SSH_OPTS "${SERVER_USER}@${SERVER_HOST}"
else
  sshpass -e ssh $SSH_OPTS "${SERVER_USER}@${SERVER_HOST}" "$@"
fi
```

- [ ] **Step 3: 验证 (真连新服务器跑一条只读命令)**

Run: `cd /Users/xinghan/Dev/systemedu && SSHPASS='c1x2h3419850208!' ./scripts/server-ssh.sh "hostname; uptime" 2>&1 | tail -3`
Expected: 返回服务器 hostname + uptime (证明 server-ssh.sh 通过 deploy.env 成功连新服务器)。

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add scripts/server-ssh.sh
git commit -m "chore: server-ssh.sh 读 deploy.env + 密码 SSH (新服务器)"
```

### Task A3: 更新 CLAUDE.md + docker README + install 脚本注释

**Files:** Modify `CLAUDE.md`, `docker/README.md`, `scripts/install/write_library_systemd_nginx.sh`

- [ ] **Step 1: CLAUDE.md 生产服务器章节更新**

`CLAUDE.md` 里 5 处 47.92.200.21 → 47.106.220.119。注意:
- "生产服务器" 章节 (约 172 行): 地址/访问 URL 改新 IP。
- SSH 登录说明改为提示走 deploy.env + sshpass (密码登录)。
- 两处 deprecated 说明 (52/67 行 "生产 47.92.200.21 仍跑这个"): 改为 "旧生产 47.92.200.21 已弃用; 新生产 47.106.220.119 跑 student-app 新架构 (见 deploy.env)"。

实现前 `grep -n "47.92.200.21" CLAUDE.md` 看 5 处上下文, 逐处按语义改 (不是无脑替换)。

- [ ] **Step 2: docker/README.md + install 脚本注释**

- `docker/README.md` 1 处 IP → 新 IP。
- `scripts/install/write_library_systemd_nginx.sh` 第 7 行注释 `(47.92.200.21)` → `(见 deploy.env SERVER_HOST)`。

- [ ] **Step 3: 确认历史 spec 未被动**

Run: `cd /Users/xinghan/Dev/systemedu && git status --short specs/ | head` — 应为空 (specs/0xx 不动)。

- [ ] **Step 4: Commit**

```bash
cd /Users/xinghan/Dev/systemedu
git add CLAUDE.md docker/README.md scripts/install/write_library_systemd_nginx.sh
git commit -m "docs: 更新活跃配置/说明到新生产 IP (历史 spec 不动)"
```

---

## 阶段 B: 部署脚本 (本地编写, 真跑在阶段 C)

### Task B1: 写 deploy-student.sh

**Files:** Create `scripts/deploy-student.sh`

**说明:** 全新部署脚本, 读 deploy.env。打包本地 main 代码 → scp → 服务器解压 → 装依赖 → 起 docker PG/Redis → 部署 library/student-app/student-web → systemd → nginx。脚本设计为**可重入分步** (支持 `--step <name>` 只跑某步, 便于逐步执行 + 失败重试)。

- [ ] **Step 1: 写脚本骨架 (分步函数)**

```bash
# scripts/deploy-student.sh
#!/bin/bash
# 部署 student-app 新架构到生产 (读 scripts/deploy.env)。
# 用法:
#   SSHPASS='密码' ./scripts/deploy-student.sh <step>
# steps: pack | infra | code | library | student | web | nginx | verify | all
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$DIR")"
source "$DIR/deploy.env"
[ -z "${SSHPASS:-}" ] && { echo "need SSHPASS env"; exit 1; }

remote() { sshpass -e ssh $SSH_OPTS "${SERVER_USER}@${SERVER_HOST}" "$@"; }
copy()   { sshpass -e scp $SSH_OPTS "$1" "${SERVER_USER}@${SERVER_HOST}:$2"; }

step="${1:-}"
# ... 各 step 函数 (Step 2-8 填充) ...
case "$step" in
  pack)    do_pack;;
  infra)   do_infra;;
  code)    do_code;;
  library) do_library;;
  student) do_student;;
  web)     do_web;;
  nginx)   do_nginx;;
  verify)  do_verify;;
  all)     do_pack; do_code; do_infra; do_library; do_student; do_web; do_nginx; do_verify;;
  *) echo "usage: SSHPASS=... $0 {pack|infra|code|library|student|web|nginx|verify|all}"; exit 1;;
esac
```

> 各 step 函数的具体实现在 Step 2-8 给出; 实现时填进骨架。脚本在阶段 C **逐 step 真跑**, 本 Task 只写脚本 (不执行)。

- [ ] **Step 2: do_pack — 打包本地 main 代码**

```bash
do_pack() {
  echo "[pack] 打包 main 代码..."
  cd "$ROOT"
  git rev-parse --abbrev-ref HEAD | grep -q '^main$' || { echo "请切到 main 再打包"; exit 1; }
  tar --exclude='.venv' --exclude='.git' --exclude='node_modules' \
      --exclude='content-workspace' --exclude='.data' --exclude='.run' \
      --exclude='packages/student-web/.next' \
      -czf /tmp/systemedu_student.tar.gz .
  echo "[pack] 包大小: $(du -sh /tmp/systemedu_student.tar.gz | cut -f1)"
}
```

- [ ] **Step 3: do_code — 上传 + 解压 + pip install**

```bash
do_code() {
  echo "[code] 上传代码..."
  copy /tmp/systemedu_student.tar.gz /tmp/
  remote "mkdir -p $REPO_ROOT && tar -xzf /tmp/systemedu_student.tar.gz -C $REPO_ROOT"
  echo "[code] 建 venv + 装依赖..."
  remote "cd $REPO_ROOT && python3 -m venv .venv && \
    .venv/bin/pip install -q -e packages/core -e packages/library-app -e packages/student-app 2>&1 | tail -3"
}
```

- [ ] **Step 4: do_infra — 装 Docker + 起 PG/Redis**

```bash
do_infra() {
  echo "[infra] 装 Docker (若无)..."
  remote "which docker >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq docker.io docker-compose-plugin)"
  remote "systemctl enable --now docker"
  echo "[infra] 起 PG + Redis (不起 qdrant)..."
  remote "cd $REPO_ROOT && docker compose up -d postgres redis"
  sleep 6
  remote "cd $REPO_ROOT && docker compose ps"
}
```
> 只起 postgres redis (不含 qdrant), 与 spec 决策 3 一致。docker-compose.yml 已在仓库 (随代码上传)。

- [ ] **Step 5: do_library — 部署 library + systemd + 导两门课**

```bash
do_library() {
  echo "[library] secrets..."
  remote "test -f /root/.systemedu-library-secrets || (echo \"LIBRARY_LICENSE_TOKEN=$(openssl rand -hex 24)\" > /root/.systemedu-library-secrets; echo \"LIBRARY_JWT_SECRET=$(openssl rand -hex 24)\" >> /root/.systemedu-library-secrets; echo \"LIBRARY_BOOTSTRAP_ADMIN=admin:$(openssl rand -hex 8)\" >> /root/.systemedu-library-secrets)"
  echo "[library] systemd unit..."
  remote "cat > /etc/systemd/system/systemedu-library.service <<'EOF'
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
  echo "[library] 上传 + 导入两门课 tarball..."
  copy ~/.systemedu-library/media/projects/eeg-minecraft-bci/_archive/eeg-minecraft-bci-0.1.0.tar.gz /tmp/
  copy ~/.systemedu-library/media/projects/purpleair-airquality-node/_archive/purpleair-airquality-node-0.14.1.tar.gz /tmp/
  # admin 登录 + import + publish (用 library admin API, token 从 secrets)
  remote "bash $REPO_ROOT/scripts/_import_courses.sh"  # 见 Step 5b
}
```
> Step 5b: 另写 `scripts/_import_courses.sh` (服务器侧执行): admin login → import 两个 tarball → publish。实现时按 library admin API (POST /admin/auth/login, POST /admin/projects/import, POST /admin/projects/{slug}/publish) 写, token/admin 密码从 /root/.systemedu-library-secrets 读。**实现前 grep library admin 路由确认真实端点**: `grep -rn "admin/auth/login\|projects/import\|publish" packages/library-app/src/library/routes/admin.py`。

- [ ] **Step 6: do_student — 部署 student-app + alembic + systemd (backend+worker)**

```bash
do_student() {
  echo "[student] secrets..."
  remote "test -f /root/.systemedu-student-secrets || (echo \"STUDENT_JWT_SECRET=$(openssl rand -hex 24)\" > /root/.systemedu-student-secrets)"
  # PG 连接串 (docker compose 的 systemedu/systemedu@localhost:5432/student) + redis + library
  remote "cat >> /root/.systemedu-student-secrets <<EOF
STUDENT_DB_URL=postgresql+psycopg2://systemedu:systemedu@127.0.0.1:5432/student
STUDENT_REDIS_URL=redis://127.0.0.1:6379/0
LIBRARY_BASE_URL=http://127.0.0.1:$LIBRARY_PORT
EOF"
  remote "grep LIBRARY_LICENSE_TOKEN /root/.systemedu-library-secrets >> /root/.systemedu-student-secrets"
  echo "[student] alembic 迁移 (建表含 037/038)..."
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
  remote "systemctl daemon-reload && systemctl enable --now systemedu-student-backend systemedu-student-worker && sleep 4 && systemctl is-active systemedu-student-backend"
}
```
> memory.enabled=false: student-app 默认无 Mem0 配置即降级; 确认 config 默认 memory.enabled 是否 false (实现前 grep config.py MemoryConfig 默认值; 若默认 true 需在 secrets 或 config 显式关)。

- [ ] **Step 7: do_web — build + 起 student-web systemd**

```bash
do_web() {
  echo "[web] npm ci + build (API 指向生产)..."
  remote "cd $REPO_ROOT/packages/student-web && npm ci --silent 2>&1 | tail -2 && \
    NEXT_PUBLIC_STUDENT_API_URL=$PUBLIC_URL npm run build 2>&1 | tail -5"
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
  remote "systemctl daemon-reload && systemctl enable --now systemedu-student-web && sleep 5 && systemctl is-active systemedu-student-web"
}
```
> build 吃内存; 14G 足够。NEXT_PUBLIC 在 build 时注入。

- [ ] **Step 8: do_nginx + do_verify — 切换 + 验收**

```bash
do_nginx() {
  echo "[nginx] 停老 cloud-app + 切 nginx..."
  remote "systemctl disable --now systemedu-backend systemedu-frontend 2>/dev/null || true"
  remote "cat > /etc/nginx/sites-available/systemedu <<EOF
server {
  listen 80 default_server;
  server_name _;
  location /api/ { proxy_pass http://127.0.0.1:$STUDENT_BACKEND_PORT; proxy_set_header Host \\\$host; proxy_set_header Upgrade \\\$http_upgrade; proxy_set_header Connection \"upgrade\"; }
  location / { proxy_pass http://127.0.0.1:$STUDENT_WEB_PORT; proxy_set_header Host \\\$host; }
}
EOF"
  remote "ln -sf /etc/nginx/sites-available/systemedu /etc/nginx/sites-enabled/systemedu && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx"
}
do_verify() {
  echo "[verify]..."
  remote "curl -s --noproxy '*' http://127.0.0.1:$STUDENT_BACKEND_PORT/api/health"
  remote "curl -s --noproxy '*' -o /dev/null -w 'web:%{http_code}\n' http://127.0.0.1:$STUDENT_WEB_PORT/"
  remote "curl -s --noproxy '*' http://127.0.0.1:$STUDENT_BACKEND_PORT/api/library/projects | head -c 200"
}
```
> nginx WS: /api/ 带 Upgrade header 让 chat WS (/api/chat/stream) 工作。

- [ ] **Step 9: 脚本本地语法检查 (不执行)**

Run: `cd /Users/xinghan/Dev/systemedu && bash -n scripts/deploy-student.sh && echo "syntax OK"`
Expected: `syntax OK` (bash -n 只检查语法, 不运行)。

- [ ] **Step 10: Commit (脚本, 未执行)**

```bash
cd /Users/xinghan/Dev/systemedu
git add scripts/deploy-student.sh scripts/_import_courses.sh
git commit -m "feat(deploy): student-app 新架构部署脚本 (分步, 读 deploy.env)"
```

---

## 阶段 C: 生产部署 (逐步真跑, 不可逆, 每步 checkpoint)

> 每步执行后停下给用户看结果, 失败即按回滚处理, 不自动继续。全程 `export SSHPASS='c1x2h3419850208!'`。

- [ ] **C1 备份现状 (回滚基线)**: `./scripts/server-ssh.sh "cp -r /opt/systemedu /opt/systemedu.bak-$(date +%s) 2>/dev/null; systemctl list-units | grep systemedu"` — 记录老服务状态 + 备份老代码。
- [ ] **C2 pack + code**: `./scripts/deploy-student.sh pack && ./scripts/deploy-student.sh code` — 上传+装依赖。验证: 服务器 `.venv` 存在 + import systemedu.student 成功。
- [ ] **C3 infra**: `./scripts/deploy-student.sh infra` — 装 Docker + 起 PG/Redis。验证: `docker compose ps` 两容器 healthy。
- [ ] **C4 library + 导课**: `./scripts/deploy-student.sh library` — 验证: `curl :18821/v1/projects` 返回两门课 + slides 非空。
- [ ] **C5 student**: `./scripts/deploy-student.sh student` — alembic + backend/worker。验证: `curl :18820/api/health` ok; alembic 到 038。
- [ ] **C6 web**: `./scripts/deploy-student.sh web` — build + 起。验证: `curl :4000/` 200。
- [ ] **C7 nginx 切换**: `./scripts/deploy-student.sh nginx` — 停老 cloud-app + 切 nginx。**这步起对外生效**。验证: `curl http://47.106.220.119/api/health`。
- [ ] **C8 端到端验收**: 浏览器开 http://47.106.220.119 → 注册 → pull eeg → 学习页 → 老师讲课 slides / 高亮深入学习 / 知识钻取 / chat 苏格拉底。
- [ ] **C9 更新 spec/CLAUDE shipped + commit**: spec Status: shipped, 记录验收。

### 回滚预案 (任一步失败)
- C2-C6 失败 (老服务还在跑, 没切 nginx): 不影响线上, 修了重跑该 step。
- C7 后失败: nginx 切回 + 重启老服务:
  `./scripts/server-ssh.sh "systemctl enable --now systemedu-backend systemedu-frontend; rm /etc/nginx/sites-enabled/systemedu; ln -sf /etc/nginx/sites-available/<老配置> /etc/nginx/sites-enabled/default 2>/dev/null; systemctl reload nginx"`
  (老 nginx 配置名在 C1 记录)。
- 数据在 docker volume (.data) + /root/.systemedu-library, 回滚不动。

---

## 验收标准
- deploy.env 单一配置源; server-ssh.sh/deploy-student.sh 读它; 换服务器只改 deploy.env。
- CLAUDE/docker README 新 IP; 历史 spec 未动 (git status specs/ 空)。
- 新服务器: PG/Redis 容器 healthy; library 两门课 (slides 非空); student-app health ok + alembic 038; student-web 200; nginx 80 → 新栈。
- http://47.106.220.119 端到端: 注册→学习→slides/高亮/钻取/chat 全可用。
- 老 cloud-app systemd disable 保留可回滚。

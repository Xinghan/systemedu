# student-app 新架构生产部署 设计文档

- Status: approved (2026-06-08)
- Date: 2026-06-08
- 关联: spec 027/031/032 (student-app/web), spec 023 (library), 替代废弃 cloud-app (deploy.sh)
- 服务器: 47.92.200.21 (Ubuntu 24.04, 7.1G RAM, 64G 空闲, Docker 29, Python 3.12)

## 1. 背景与问题

生产当前跑的是**废弃架构**: `systemedu-backend`=cloud-app (:18820)、`systemedu-frontend`=老 web (:3000)，
均 deprecated (CLAUDE.md 2026-05-19)。这几周的新特性 (slides 老师讲课 / 苏格拉底改进 / 高亮深入学习)
全在 **student-app + student-web + library-app**，生产一个都没有。

本特性: 把整套新架构部署到生产，替换废弃 cloud-app，让两门正式课 (eeg/purpleair) 上线可学。

## 2. 决策 (已与用户确认)

1. **数据**: 全新开始，不迁老 cloud-app 数据 (老数据是测试数据，schema 不同，迁移不值)。
2. **切换**: 直接替换。停老 cloud-app + 老 web，nginx 80 指向新栈。老 systemd unit + 代码保留不删 (回滚用)。
3. **内存**: 不上 Qdrant/Mem0 (省 1-2G; L4 因 embedding 配置未就绪本就不生效)。
   student-app 配 `memory.enabled=false`，L4 优雅降级返回空 (代码已支持)。L1/L2/L3/L5 正常。
4. **内容**: 导入 eeg-minecraft-bci + purpleair-airquality-node 两门。tarball 已含 slides.json
   (eeg 65 / purpleair 48)，生产全新 import 自动有 slides，**无需回填脚本**。
5. **代码**: 部署 main 分支代码。故 feat/highlight-ask 先合并 main 再部署。

## 3. 目标架构 (生产)

```
Internet → nginx:80
  ├─ /                → student-web (Next.js :4000, npm start)
  ├─ /api/*           → student-app (:18820, uvicorn)
  └─ (student-app 内部反代 library /v1/*)

docker compose (生产):
  ├─ PostgreSQL :5432   (student-app 数据)
  └─ Redis :6379        (跨实例缓存)
  (不起 Qdrant)

systemd:
  ├─ systemedu-student-backend   (student-app :18820 + 内部调 library)
  ├─ systemedu-student-worker    (fact_extractor_worker)
  ├─ systemedu-student-web       (student-web :4000)
  └─ systemedu-library           (library-app :18821, 本机, student-app 反代它)

保留停用 (回滚): systemedu-backend (cloud-app), systemedu-frontend (老 web)
```

library-app 仍跑 SQLite (它本就是内容服务，轻量，不必上 PG)。

## 4. 部署步骤 (高层，细节见 plan)

### A. 准备 (本地)
- A1 feat/highlight-ask 合并 main + 推送。
- A2 确认两门课 tarball (含 slides): eeg-minecraft-bci-0.1.0.tar.gz, purpleair-airquality-node-0.14.1.tar.gz。
- A3 打包 main 代码 (排除 .venv/.git/node_modules/content-workspace)。

### B. 生产基础设施
- B1 docker compose 起 PostgreSQL + Redis (复用仓库 docker-compose.yml 的 pg/redis 部分，不起 qdrant)。
- B2 生成/复用 secrets: STUDENT_JWT_SECRET, LIBRARY_LICENSE_TOKEN, PG 密码, LLM key (DASHSCOPE)。
  存 /root/.systemedu-student-secrets (与现有 library secrets 风格一致)。

### C. library-app 部署
- C1 上传代码 + pip install -e packages/library-app + core。
- C2 LIBRARY_HOME=/root/.systemedu-library (生产)，systemd unit systemedu-library (:18821)。
- C3 admin 登录 → import eeg + purpleair tarball → publish。验证 /v1/projects 返回两门 + slides 非空。

### D. student-app 部署
- D1 pip install -e packages/student-app。
- D2 env: STUDENT_DB_URL=postgresql://... (PG), REDIS_URL, STUDENT_JWT_SECRET,
  LIBRARY_BASE_URL=http://127.0.0.1:18821, LIBRARY_LICENSE_TOKEN, memory.enabled=false。
- D3 alembic upgrade head (建表含 037 source 列)。
- D4 systemd unit systemedu-student-backend (:18820) + systemedu-student-worker。

### E. student-web 部署
- E1 cd packages/student-web && npm ci && (NEXT_PUBLIC_API_BASE 指向生产) npm run build。
- E2 systemd unit systemedu-student-web (PORT=4000 npm start)。

### F. nginx 切换
- F1 停 systemedu-backend (cloud-app) + systemedu-frontend (老 web)，disable (不删)。
- F2 nginx systemedu site: / → :4000, /api/ → :18820。reload。
- F3 验证 http://47.92.200.21 → student-web landing。

### G. 端到端验收 (生产)
- G1 注册新账号 → pull eeg → 进 M01 学习页。
- G2 老师讲课 → slides 翻页。
- G3 高亮课文 → 深入学习 → tutor 解释 (source=highlight_ask)。
- G4 chatbot 苏格拉底引导 (问误区句)。

## 5. 回滚预案
- 老 cloud-app/web 的 systemd unit (systemedu-backend/frontend) + /opt/systemedu 老代码保留 (仅 disable)。
- 出问题: nginx 切回老 site + systemctl start systemedu-backend systemedu-frontend。
- 新栈数据在 PG (docker volume) + /root/.systemedu-library，回滚不动它们。

## 6. 风险
- 内存 7.1G: PG (~300M) + Redis (~50M) + student-app (~400M) + library (~200M) + Next.js (~300M)
  + 系统 ~2.3G ≈ 3.5G，留有余量 (不起 Qdrant 是关键)。监控首次启动内存。
- LLM key: 生产 student-app 需真实 DASHSCOPE key (tutor chat)。从本地 config 取或用户提供。
- alembic 在生产 PG 首次 upgrade: 全新库，037 链从 baseline 跑通。
- npm build 在 7G 机器: Next.js build 吃内存，build 时其它服务可能要临时停 (build 完再起)。
- HTTPS: 当前生产是 http (无证书)。本特性维持 http (与现状一致)，HTTPS 另议。
- 部署是不可逆动生产操作: 每步验证，失败即按回滚预案。

## 7. 非目标
- 不迁老数据。不上 Qdrant/Mem0。不上 HTTPS。不动 library-admin-ui (内容管理 UI，可选后补)。
- 不重构代码 (部署现有 main 代码)。

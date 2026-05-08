# 018-install-script

**Status**: shipped (2026-05-08)
**Owner**: xinghan
**Created**: 2026-05-08

## 背景 / 问题

SystemEdu 当前部署只有针对 47.92.200.21 老服务器写死的 `scripts/deploy.sh`
（增量同步到已经初始化好的环境），新机器从零起步没有可复用的脚本。
spec 017 部署到 47.106.220.119 时手工跑了 bootstrap，过程在对话历史里，
未沉淀。

下次换台 Mac 写 demo、新建一台云服务器拷贝 / 教学使用，都需要手动
ssh + 装一堆依赖。需要一个一键脚本。

## 目标（WHAT）

写一个 `scripts/install.sh`，从仓库根目录一键完成：

1. **平台自动检测**：macOS / Ubuntu 24.04 自动选择安装路径，其他平台
   报错并提示
2. **运行模式自动检测**：
   - `server` 模式：Linux + root + 检测到 systemd → 装 systemd unit +
     nginx，监听 80
   - `local` 模式：macOS 或非 root Linux → 不装 systemd/nginx，
     最后提示用户跑 `./scripts/restart.sh`
3. **系统依赖**：默认装齐 (manim/ffmpeg/cairo/pango/texlive/playwright)，
   `--minimal` 跳过这些大依赖（占磁盘 ~3GB / 装机时间 5-10 分钟）
4. **Python 环境**：在 repo 根创建 `.venv/`，`pip install -e .` + 媒体
   依赖（dashscope manim playwright）
5. **前端**：`cd web && npm install --legacy-peer-deps` + 仅在 server
   模式 `npm run build`（local 模式 dev 起服务不需要 build）
6. **`~/.systemedu/config.yaml`**：幂等创建（已存在不动），第一次写
   一个空 `creative.api_key` 占位 + 系统侧 `qwen` 占位（提示用户去
   web `/config` 填）
7. **--host=<ip-or-domain>**：server 模式必需；缺省时自动 `curl ifconfig.me`
   探测公网 IP
8. **完成提示**：脚本最后打印关键状态（venv 位置、config 位置、
   下一步——server 模式给 systemctl status / web 入口；local 模式
   给 `./scripts/restart.sh`）

## 非目标（不做什么）

- 不支持其他 Linux 发行版（CentOS / Debian / Arch 等）—— 探测到报错
- 不支持 Windows
- 不做"卸载"功能，用户自己 `rm -rf .venv ~/.systemedu /etc/systemd/...`
- 不拷贝任何已有的 `projects/` 数据
- 不自动配置 SSL / Let's Encrypt
- 不装 mem0 / qdrant / redis 等可选 backend（仅 SQLite）
- 不重写 spec 017 的 bootstrap 逻辑细节为 spec 018 的子文档；
  本脚本沉淀的就是 spec 017 部署中跑通的步骤

## 用户故事 / 场景

**场景 A（新 Mac 写 demo）**：开发者 clone 仓库，cd 进去跑
`./scripts/install.sh`。脚本自动检测到 macOS + 非 root → local 模式，
brew 装 node@20 / ffmpeg / cairo / pango / texlive / python@3.12，
建 venv，npm install，写空 config，结束打印
"现在跑 ./scripts/restart.sh，然后访问 http://localhost:3000"。

**场景 B（新云服务器）**：scp 仓库到服务器，ssh 进去跑
`./scripts/install.sh --host=47.106.220.119`。脚本自动检测到 root +
systemd → server 模式，apt 装 NodeSource node 20 + 系统依赖，
建 venv，npm install + build，装 systemd unit、nginx，启动服务。
最后打印 "访问 http://47.106.220.119"。

**场景 C（minimal 重测）**：开发者用 `--minimal` 跑只测 idea/tree，
跳过 manim/texlive/playwright，节省时间。

**场景 D（重跑幂等）**：用户已经装过一次，再跑一次 `install.sh`
（比如 pull 了新代码想刷新）。脚本应该幂等：venv 已存在不重建，
但仍会跑 `pip install -e .` 同步依赖；npm install 会跑；config.yaml
不动；systemd unit / nginx 会覆盖刷新。

## 验收标准

- [ ] `./scripts/install.sh --help` 显示用法
- [ ] macOS 上跑能成功完成（重跑幂等，不破坏现有 venv 和 config）
- [ ] Ubuntu 24.04 root + 干净环境上跑能完成 server 模式部署，
      访问 `http://<host>/api/status` 返回 200
- [ ] `--minimal` 跳过 manim/texlive/playwright
- [ ] `--host` 自定义传值正确写入 systemd unit + nginx
- [ ] 缺 `--host` 时 server 模式自动 curl ifconfig.me 探测
- [ ] 脚本结束打印明确的下一步指引
- [ ] 不支持的平台立即报错退出
- [ ] 已存在的 `~/.systemedu/config.yaml` 不被覆盖
- [ ] docs/prd.md 加一节 "## 一键安装 (`./scripts/install.sh`)"

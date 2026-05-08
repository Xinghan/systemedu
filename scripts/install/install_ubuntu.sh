#!/usr/bin/env bash
# spec 018: Ubuntu 24.04 安装路径
#
# 由 install.sh 调起，依赖以下已 export 的环境变量：
#   REPO_ROOT  - 仓库根目录
#   MODE       - "server" 或 "local"
#   HOST       - server 模式的对外 IP/域名
#   WITH_MEDIA - 1=装 manim/texlive/playwright; 0=skip

set -euo pipefail

: "${REPO_ROOT:?REPO_ROOT must be set}"
: "${MODE:?MODE must be set}"
: "${HOST:?HOST must be set}"
: "${WITH_MEDIA:?WITH_MEDIA must be set}"

say()  { echo -e "  \033[0;34m[ubuntu]\033[0m $*"; }
warn() { echo -e "  \033[1;33m[ubuntu warn]\033[0m $*"; }
fail() { echo -e "  \033[0;31m[ubuntu fail]\033[0m $*" >&2; }

# --- 必须 root 才能 apt install (server 模式) ---
if [ "$MODE" = "server" ] && [ "$(id -u)" != "0" ]; then
    fail "server 模式需要 root 权限运行"
    exit 1
fi
SUDO=""
[ "$(id -u)" != "0" ] && SUDO="sudo"

# --- apt update + 基础包 ---
say "apt update"
$SUDO apt-get update >/dev/null

say "装系统依赖 (build/python/cairo/pango/nginx)"
DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y \
    build-essential \
    pkg-config \
    python3 \
    python3-dev \
    python3-venv \
    python3-pip \
    libcairo2-dev \
    libpango1.0-dev \
    nginx \
    ca-certificates \
    curl \
    >/dev/null

if [ "$WITH_MEDIA" = "1" ]; then
    say "装媒体依赖 (ffmpeg/ghostscript/dvisvgm/texlive) — 几分钟"
    DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y \
        ffmpeg \
        ghostscript \
        dvisvgm \
        texlive \
        texlive-latex-extra \
        texlive-fonts-recommended \
        texlive-plain-generic \
        >/dev/null
else
    say "跳过媒体依赖 (--minimal)"
fi

# --- Node 20 (NodeSource) ---
NEED_NODE_INSTALL=1
if command -v node >/dev/null 2>&1; then
    CURRENT_MAJOR=$(node --version | sed 's/^v//' | cut -d. -f1)
    if [ "$CURRENT_MAJOR" -ge 20 ] 2>/dev/null; then
        say "Node $(node --version) 已满足 >=20"
        NEED_NODE_INSTALL=0
    else
        warn "当前 Node $(node --version) < 20，升级中..."
        DEBIAN_FRONTEND=noninteractive $SUDO apt-get remove -y nodejs npm >/dev/null 2>&1 || true
    fi
fi

if [ "$NEED_NODE_INSTALL" = "1" ]; then
    say "装 NodeSource node 20"
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - >/dev/null
    DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y nodejs >/dev/null
fi
say "node: $(node --version)  npm: $(npm --version)"

# --- Python venv ---
cd "$REPO_ROOT"

if [ ! -x .venv/bin/python ]; then
    say "创建 Python venv (.venv/)"
    python3 -m venv .venv
else
    say ".venv/ 已存在"
fi

# shellcheck disable=SC1091
source .venv/bin/activate
say "venv python: $(python --version 2>&1)"

say "升级 pip"
python -m pip install --upgrade pip setuptools wheel >/tmp/sysedu_pip_bootstrap.log 2>&1

say "pip install -e . (项目依赖)"
python -m pip install -e . >/tmp/sysedu_pip_install.log 2>&1
tail -n 1 /tmp/sysedu_pip_install.log

say "pip install aiohttp"
python -m pip install aiohttp >/dev/null 2>&1

if [ "$WITH_MEDIA" = "1" ]; then
    say "pip install dashscope manim playwright"
    python -m pip install dashscope manim playwright >/tmp/sysedu_pip_media.log 2>&1
    tail -n 1 /tmp/sysedu_pip_media.log
    say "playwright install chromium"
    python -m playwright install chromium >/tmp/sysedu_playwright.log 2>&1 || warn "playwright install 失败"
else
    say "pip install dashscope (--minimal)"
    python -m pip install dashscope >/dev/null 2>&1
fi

# --- 前端 ---
cd "$REPO_ROOT/web"
say "npm install --legacy-peer-deps"
NEXT_PUBLIC_GATEWAY_URL="http://$HOST" npm install --legacy-peer-deps --quiet 2>&1 | tail -3

if [ "$MODE" = "server" ]; then
    say "npm run build (server 模式预构建)"
    NEXT_PUBLIC_GATEWAY_URL="http://$HOST" npm run build 2>&1 | tail -8
else
    say "local 模式跳过 npm build (用 npm run dev)"
fi

echo ""
say "Ubuntu 依赖安装完成"
say "  venv:         $REPO_ROOT/.venv"
say "  node_modules: $REPO_ROOT/web/node_modules"

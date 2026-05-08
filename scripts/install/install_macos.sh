#!/usr/bin/env bash
# spec 018: macOS 安装路径 (brew + python -m venv + npm install)
#
# 由 install.sh 调起，依赖以下已 export 的环境变量：
#   REPO_ROOT  - 仓库根目录
#   MODE       - "local" (macOS 只走 local)
#   WITH_MEDIA - 1=装 manim/texlive/playwright; 0=skip

set -euo pipefail

: "${REPO_ROOT:?REPO_ROOT must be set}"
: "${WITH_MEDIA:?WITH_MEDIA must be set}"

say()  { echo -e "  \033[0;34m[macos]\033[0m $*"; }
warn() { echo -e "  \033[1;33m[macos warn]\033[0m $*"; }
fail() { echo -e "  \033[0;31m[macos fail]\033[0m $*" >&2; }

# --- brew ---
if ! command -v brew >/dev/null 2>&1; then
    fail "未检测到 Homebrew。请先安装: https://brew.sh"
    fail '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
fi
say "brew 已安装: $(brew --version | head -1)"

# --- 系统级依赖 ---
brew_install_if_missing() {
    local pkg="$1"
    if brew list --versions "$pkg" >/dev/null 2>&1; then
        say "$pkg 已存在 (brew)"
    else
        say "brew install $pkg"
        brew install "$pkg"
    fi
}

# 必需依赖
brew_install_if_missing python@3.12

# Node 20+: 先看现有 node 是否满足
NODE_OK=0
if command -v node >/dev/null 2>&1; then
    NODE_MAJOR=$(node --version 2>/dev/null | sed 's/^v//' | cut -d. -f1)
    if [ "${NODE_MAJOR:-0}" -ge 20 ] 2>/dev/null; then
        NODE_OK=1
        say "Node $(node --version) 已满足 >=20 (跳过 node@20)"
    fi
fi
if [ "$NODE_OK" = "0" ]; then
    brew_install_if_missing node@20
    NODE_PREFIX="$(brew --prefix node@20)"
    export PATH="$NODE_PREFIX/bin:$PATH"
    say "Node 20 加入 PATH: $NODE_PREFIX/bin"
    warn "请把这一行加到你的 ~/.zshrc:"
    warn "  export PATH=\"$NODE_PREFIX/bin:\$PATH\""
fi
say "node: $(node --version 2>&1)  npm: $(npm --version 2>&1)"

# 媒体相关 (manim/playwright/cairo/pango/ffmpeg/texlive)
if [ "$WITH_MEDIA" = "1" ]; then
    say "装媒体依赖 (ffmpeg / cairo / pango / texlive)..."
    brew_install_if_missing ffmpeg
    brew_install_if_missing cairo
    brew_install_if_missing pango
    brew_install_if_missing pkg-config
    # MacTeX 体积大 (4GB+)，给用户提示
    if ! command -v latex >/dev/null 2>&1; then
        warn "未检测到 LaTeX。manim 渲染数学公式需要它。"
        warn "如果你要做 anim/game pipeline，运行: brew install --cask mactex-no-gui"
        warn "(本脚本不自动装 mactex；它有 4GB+，让你自己决定)"
    fi
else
    say "跳过媒体依赖 (--minimal)"
fi

# --- Python venv ---
PY=python3.12
if ! command -v $PY >/dev/null 2>&1; then
    PY=python3
fi

cd "$REPO_ROOT"

if [ ! -x .venv/bin/python ]; then
    say "创建 Python venv (.venv/)"
    $PY -m venv .venv
else
    say ".venv/ 已存在"
fi

# shellcheck disable=SC1091
source .venv/bin/activate
say "venv python: $(python --version 2>&1)"

say "升级 pip / setuptools / wheel"
python -m pip install --upgrade pip setuptools wheel >/tmp/sysedu_pip_bootstrap.log 2>&1

say "pip install -e . (项目依赖)"
python -m pip install -e . >/tmp/sysedu_pip_install.log 2>&1
tail -n 1 /tmp/sysedu_pip_install.log

# 测试用 aiohttp
say "pip install aiohttp (E2E 测试需要)"
python -m pip install aiohttp >/dev/null 2>&1

# 媒体 Python 包
if [ "$WITH_MEDIA" = "1" ]; then
    say "pip install dashscope manim playwright"
    python -m pip install dashscope manim playwright >/tmp/sysedu_pip_media.log 2>&1
    tail -n 1 /tmp/sysedu_pip_media.log
    say "playwright install chromium"
    python -m playwright install chromium >/tmp/sysedu_playwright.log 2>&1 || warn "playwright install 失败 (非致命)"
else
    say "pip install dashscope (基础, --minimal)"
    python -m pip install dashscope >/dev/null 2>&1
fi

# --- 前端依赖 ---
cd "$REPO_ROOT/web"
if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ]; then
    say "npm install (首次)"
    npm install --legacy-peer-deps --quiet 2>&1 | tail -3
else
    say "npm install (已有 node_modules，刷新依赖)"
    npm install --legacy-peer-deps --quiet 2>&1 | tail -3
fi
say "node_modules: $(ls "$REPO_ROOT/web/node_modules" | wc -l | tr -d ' ') packages"

# --- 收尾 ---
echo ""
say "macOS 安装完成"
say "  venv:        $REPO_ROOT/.venv"
say "  node_modules: $REPO_ROOT/web/node_modules"

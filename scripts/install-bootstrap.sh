#!/usr/bin/env bash
# SystemEdu 一键远程安装脚本 (spec 018 + 019)
#
# 用法 (一行命令安装到任意机器):
#
#   curl -fsSL https://raw.githubusercontent.com/Xinghan/systemedu/main/scripts/install-bootstrap.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/Xinghan/systemedu/main/scripts/install-bootstrap.sh | bash -s -- --host=1.2.3.4
#   curl -fsSL https://raw.githubusercontent.com/Xinghan/systemedu/main/scripts/install-bootstrap.sh | bash -s -- --minimal
#
# 流程:
#   1. 检测 git, 没有就 apt/brew 装
#   2. git clone https://github.com/Xinghan/systemedu 到 /opt/systemedu (Linux server) 或 ~/systemedu (其他)
#      已存在则 git pull
#   3. cd 进去, 跑 ./scripts/install.sh, 把所有参数 (--host / --minimal 等) 转发过去
#
# 可用环境变量:
#   SYSEDU_REPO_URL   - 默认 https://github.com/Xinghan/systemedu.git
#   SYSEDU_BRANCH     - 默认 main
#   SYSEDU_INSTALL_DIR - 默认 /opt/systemedu (root) 或 ~/systemedu (非 root)

set -euo pipefail

REPO_URL="${SYSEDU_REPO_URL:-https://github.com/Xinghan/systemedu.git}"
BRANCH="${SYSEDU_BRANCH:-main}"

# --- 颜色 ---
if [ -t 1 ]; then
    BLUE='\033[0;34m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
else
    BLUE=''; GREEN=''; RED=''; NC=''
fi
say() { echo -e "${BLUE}[bootstrap]${NC} $*"; }
ok()  { echo -e "${GREEN}[ ok       ]${NC} $*"; }
fail(){ echo -e "${RED}[ fail     ]${NC} $*" >&2; }

# --- 默认安装目录 ---
if [ -z "${SYSEDU_INSTALL_DIR:-}" ]; then
    if [ "$(id -u)" = "0" ]; then
        SYSEDU_INSTALL_DIR="/opt/systemedu"
    else
        SYSEDU_INSTALL_DIR="$HOME/systemedu"
    fi
fi

say "仓库:    $REPO_URL"
say "分支:    $BRANCH"
say "安装到:  $SYSEDU_INSTALL_DIR"

# --- 1) 装 git (如果没有) ---
if ! command -v git >/dev/null 2>&1; then
    say "安装 git..."
    if [ "$(uname -s)" = "Darwin" ]; then
        if command -v brew >/dev/null 2>&1; then
            brew install git
        else
            fail "macOS 需要先装 Homebrew (https://brew.sh) 或手动装 git"
            exit 1
        fi
    elif [ -f /etc/os-release ] && grep -q "ubuntu" /etc/os-release; then
        SUDO=""
        [ "$(id -u)" != "0" ] && SUDO="sudo"
        DEBIAN_FRONTEND=noninteractive $SUDO apt-get update >/dev/null
        DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y git >/dev/null
    else
        fail "不支持的平台，请先手动装 git"
        exit 1
    fi
fi
ok "git: $(git --version)"

# --- 2) clone or pull ---
if [ -d "$SYSEDU_INSTALL_DIR/.git" ]; then
    say "已有仓库，git pull"
    cd "$SYSEDU_INSTALL_DIR"
    git fetch origin "$BRANCH" 2>&1 | tail -3
    git checkout "$BRANCH"
    git reset --hard "origin/$BRANCH"
elif [ -e "$SYSEDU_INSTALL_DIR" ] && [ ! -d "$SYSEDU_INSTALL_DIR/.git" ]; then
    fail "$SYSEDU_INSTALL_DIR 已存在且不是 git 仓库，请手动清理或换个目录"
    fail "  例: SYSEDU_INSTALL_DIR=/opt/systemedu-new bash install-bootstrap.sh"
    exit 1
else
    say "git clone $REPO_URL → $SYSEDU_INSTALL_DIR"
    mkdir -p "$(dirname "$SYSEDU_INSTALL_DIR")"
    git clone --depth 1 -b "$BRANCH" "$REPO_URL" "$SYSEDU_INSTALL_DIR"
    cd "$SYSEDU_INSTALL_DIR"
fi

ok "代码已就位: $(git -C "$SYSEDU_INSTALL_DIR" rev-parse --short HEAD) ($(git -C "$SYSEDU_INSTALL_DIR" log -1 --format=%s | head -c 60))"

# --- 3) 调 install.sh ---
INSTALL_SCRIPT="$SYSEDU_INSTALL_DIR/scripts/install.sh"
if [ ! -x "$INSTALL_SCRIPT" ]; then
    chmod +x "$INSTALL_SCRIPT" "$SYSEDU_INSTALL_DIR/scripts/install"/*.sh 2>/dev/null || true
fi

say "调 install.sh $*"
exec "$INSTALL_SCRIPT" "$@"

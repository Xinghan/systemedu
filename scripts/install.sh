#!/usr/bin/env bash
# SystemEdu 一键安装脚本 (spec 018)
#
# 用法:
#   ./scripts/install.sh                    # 自动检测平台 + 模式
#   ./scripts/install.sh --minimal          # 跳过 manim/texlive/playwright
#   ./scripts/install.sh --host=1.2.3.4     # server 模式指定对外 IP/域名
#   ./scripts/install.sh --help
#
# 平台:
#   - macOS (brew)         → local 模式: 装依赖, 不装 systemd/nginx
#   - Ubuntu 24.04 (apt)   → root+systemd 时 server 模式; 否则 local 模式
#   - 其他平台立即报错
#
# 幂等: 重跑安全, 已存在的 venv / config.yaml 不会被破坏

set -euo pipefail

# --- 路径常量 ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INSTALL_DIR="$SCRIPT_DIR/install"

# --- 颜色输出 ---
if [ -t 1 ]; then
    BLUE='\033[0;34m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
else
    BLUE=''; GREEN=''; YELLOW=''; RED=''; NC=''
fi
say() { echo -e "${BLUE}[install]${NC} $*"; }
ok()  { echo -e "${GREEN}[ ok   ]${NC} $*"; }
warn(){ echo -e "${YELLOW}[ warn ]${NC} $*"; }
fail(){ echo -e "${RED}[ fail ]${NC} $*" >&2; }

# --- 默认参数 ---
WITH_MEDIA=1
HOST=""
SHOW_HELP=0

# --- 参数解析 ---
for arg in "$@"; do
    case "$arg" in
        --minimal)    WITH_MEDIA=0 ;;
        --host=*)     HOST="${arg#*=}" ;;
        --help|-h)    SHOW_HELP=1 ;;
        *)            fail "未知参数: $arg"; SHOW_HELP=1 ;;
    esac
done

if [ "$SHOW_HELP" = "1" ]; then
    sed -n '2,17p' "$0"
    exit 0
fi

# --- 平台检测 ---
detect_platform() {
    case "$(uname -s)" in
        Darwin) echo "macos" ;;
        Linux)
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                if [ "${ID:-}" = "ubuntu" ]; then
                    echo "ubuntu"
                    return
                fi
            fi
            echo "unsupported-linux"
            ;;
        *) echo "unsupported" ;;
    esac
}

PLATFORM="$(detect_platform)"
case "$PLATFORM" in
    macos)
        ok "检测到 macOS"
        ;;
    ubuntu)
        ok "检测到 Ubuntu"
        ;;
    *)
        fail "不支持的平台: $(uname -s) ($PLATFORM)"
        fail "本脚本目前仅支持 macOS 和 Ubuntu 24.04"
        exit 1
        ;;
esac

# --- 模式检测 (server vs local) ---
detect_mode() {
    if [ "$PLATFORM" = "ubuntu" ] && [ "$(id -u)" = "0" ] && command -v systemctl >/dev/null 2>&1; then
        echo "server"
    else
        echo "local"
    fi
}

MODE="$(detect_mode)"
ok "运行模式: $MODE"

# --- server 模式必需 host ---
if [ "$MODE" = "server" ] && [ -z "$HOST" ]; then
    say "server 模式需要 --host=<ip-or-domain>"
    say "尝试自动探测公网 IP..."
    HOST="$(curl -fsS --connect-timeout 5 https://ifconfig.me 2>/dev/null || true)"
    if [ -z "$HOST" ]; then
        HOST="$(curl -fsS --connect-timeout 5 https://api.ipify.org 2>/dev/null || true)"
    fi
    if [ -z "$HOST" ]; then
        fail "无法探测公网 IP，请显式传 --host=<your-ip-or-domain>"
        exit 1
    fi
    ok "探测到 host: $HOST"
elif [ "$MODE" = "local" ]; then
    HOST="${HOST:-127.0.0.1}"
fi

# --- 输出参数摘要 ---
echo ""
say "安装参数"
echo "  REPO_ROOT   = $REPO_ROOT"
echo "  PLATFORM    = $PLATFORM"
echo "  MODE        = $MODE"
echo "  HOST        = $HOST"
echo "  WITH_MEDIA  = $WITH_MEDIA"
echo ""

export REPO_ROOT PLATFORM MODE HOST WITH_MEDIA

# --- 1) 系统依赖 + venv + 前端依赖 ---
say "[1/3] 装系统依赖 + Python venv + 前端依赖"
if [ "$PLATFORM" = "macos" ]; then
    bash "$INSTALL_DIR/install_macos.sh"
else
    bash "$INSTALL_DIR/install_ubuntu.sh"
fi

# --- 2) ~/.systemedu/config.yaml ---
say "[2/3] 写 ~/.systemedu/config.yaml (幂等)"
bash "$INSTALL_DIR/write_config.sh"

# --- 3) systemd + nginx (仅 server 模式) ---
if [ "$MODE" = "server" ]; then
    say "[3/3] 装 systemd unit + nginx + 启动服务"
    bash "$INSTALL_DIR/write_systemd_nginx.sh"
else
    say "[3/3] local 模式，跳过 systemd / nginx"
fi

# --- 完成提示 ---
echo ""
ok "安装完成"
echo ""
if [ "$MODE" = "server" ]; then
    say "下一步:"
    echo "  访问 http://$HOST"
    echo "  默认登录: root / 123systemedu"
    echo "  在 /config 填 creative LLM 的 API Key"
    echo ""
    echo "  服务管理:"
    echo "    systemctl status systemedu-backend systemedu-frontend nginx"
    echo "    journalctl -u systemedu-backend -n 100 -f"
else
    say "下一步:"
    echo "  cd $REPO_ROOT"
    echo "  ./scripts/restart.sh        # 启动 backend (18820) + frontend (3000)"
    echo "  浏览器打开 http://localhost:3000"
    echo "  默认登录: root / 123systemedu"
    echo "  在 /config 填 creative LLM 的 API Key"
fi
echo ""

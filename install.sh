#!/bin/bash
# SystemEdu - One-click installation script
# Usage: curl -fsSL https://systemedu.com/install.sh | bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       SystemEdu Installer            ║"
echo "  ║  AI Agent-driven Learning Platform   ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Step 1: Check Python 3.12+
info "Checking Python version..."

PYTHON=""
for cmd in python3.12 python3.13 python3.14 python3; do
    if command -v "$cmd" &>/dev/null; then
        version=$("$cmd" --version 2>&1 | grep -oP '\d+\.\d+')
        major=$(echo "$version" | cut -d. -f1)
        minor=$(echo "$version" | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 12 ]; then
            PYTHON="$cmd"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    error "Python 3.12+ is required but not found.

Install Python 3.12+:
  macOS:   brew install python@3.12
  Ubuntu:  sudo apt install python3.12
  Other:   https://www.python.org/downloads/"
fi

info "Found $($PYTHON --version)"

# Step 2: Install systemedu
info "Installing systemedu..."

if command -v pipx &>/dev/null; then
    info "Using pipx for isolated install..."
    pipx install systemedu 2>/dev/null || pipx install --force systemedu
elif command -v uv &>/dev/null; then
    info "Using uv for install..."
    uv tool install systemedu
else
    info "Using pip..."
    $PYTHON -m pip install --user systemedu
fi

# Step 3: Verify installation
if ! command -v systemedu &>/dev/null; then
    # Try common locations
    for dir in "$HOME/.local/bin" "$HOME/.local/pipx/venvs/systemedu/bin"; do
        if [ -x "$dir/systemedu" ]; then
            export PATH="$dir:$PATH"
            warn "Added $dir to PATH. Add this to your shell profile:"
            echo "  export PATH=\"$dir:\$PATH\""
            break
        fi
    done
fi

if ! command -v systemedu &>/dev/null; then
    error "systemedu command not found after install. Check your PATH."
fi

info "systemedu $(systemedu --version 2>/dev/null || echo 'installed') successfully!"

# Step 4: Run onboard
echo ""
info "Starting onboarding..."
echo ""
systemedu onboard

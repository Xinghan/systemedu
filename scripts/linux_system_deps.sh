#!/bin/bash
# SystemEdu Linux system dependency installer

set -euo pipefail

log() {
  echo "[system-deps] $*"
}

have_cmd() {
  command -v "$1" >/dev/null 2>&1
}

install_with_apt() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y \
    build-essential \
    pkg-config \
    python3 \
    python3-dev \
    python3-venv \
    python3-pip \
    ffmpeg \
    libcairo2-dev \
    libpango1.0-dev \
    ghostscript \
    dvisvgm \
    texlive \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-plain-generic \
    nodejs \
    npm
}

install_with_dnf() {
  dnf install -y \
    gcc \
    gcc-c++ \
    make \
    pkgconf-pkg-config \
    python3 \
    python3-devel \
    ffmpeg \
    cairo-devel \
    pango-devel \
    ghostscript \
    dvisvgm \
    texlive \
    texlive-collection-latex \
    texlive-collection-latexrecommended \
    texlive-collection-fontsrecommended \
    nodejs \
    npm
}

install_with_yum() {
  yum install -y epel-release || true
  yum install -y \
    gcc \
    gcc-c++ \
    make \
    pkgconfig \
    python3 \
    python3-devel \
    ffmpeg \
    cairo-devel \
    pango-devel \
    ghostscript \
    dvisvgm \
    texlive \
    texlive-collection-latex \
    texlive-collection-latexrecommended \
    texlive-collection-fontsrecommended \
    nodejs \
    npm
}

install_with_apk() {
  apk add --no-cache \
    build-base \
    pkgconf \
    python3 \
    python3-dev \
    py3-pip \
    py3-virtualenv \
    ffmpeg \
    cairo-dev \
    pango-dev \
    ghostscript \
    dvisvgm \
    texlive-full \
    nodejs \
    npm
}

systemedu_install_linux_system_deps() {
  if [[ "$(uname -s)" != "Linux" ]]; then
    log "skip: current OS is not Linux"
    return 0
  fi

  if have_cmd apt-get; then
    log "installing Linux dependencies via apt-get"
    install_with_apt
  elif have_cmd dnf; then
    log "installing Linux dependencies via dnf"
    install_with_dnf
  elif have_cmd yum; then
    log "installing Linux dependencies via yum"
    install_with_yum
  elif have_cmd apk; then
    log "installing Linux dependencies via apk"
    install_with_apk
  else
    log "unsupported package manager; install Python 3.12+, Node.js/npm, ffmpeg, cairo/pango dev libs, ghostscript, dvisvgm, and TeX Live manually"
    return 1
  fi
}

systemedu_verify_linux_runtime() {
  local missing=0

  for cmd in python3 npm ffmpeg latex dvisvgm; do
    if ! have_cmd "$cmd"; then
      log "missing command: $cmd"
      missing=1
    fi
  done

  return "$missing"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  systemedu_install_linux_system_deps
  systemedu_verify_linux_runtime
fi

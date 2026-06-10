#!/bin/bash
# SSH 到生产服务器 (配置读 scripts/deploy.env)。
# 该服务器走密码登录, 需 sshpass + 强制密码认证 (SSH_OPTS 在 deploy.env)。
#
# 用法:
#   SSHPASS='密码' ./scripts/server-ssh.sh                   # 交互式
#   SSHPASS='密码' ./scripts/server-ssh.sh "systemctl status systemedu-student-backend"
#   SSHPASS='密码' ./scripts/server-ssh.sh "journalctl -u systemedu-student-backend -n 50"
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

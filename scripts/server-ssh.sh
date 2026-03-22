#!/bin/bash
# 登录生产服务器
# 用法: ./scripts/server-ssh.sh [可选命令]
#
# 示例:
#   ./scripts/server-ssh.sh                    # 交互式登录
#   ./scripts/server-ssh.sh "systemctl status systemedu-backend"
#   ./scripts/server-ssh.sh "journalctl -u systemedu-backend -n 50"

SERVER="root@47.92.200.21"

if [ -z "$1" ]; then
    ssh -o StrictHostKeyChecking=no ${SERVER}
else
    ssh -o StrictHostKeyChecking=no ${SERVER} "$@"
fi

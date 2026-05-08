#!/usr/bin/env bash
# spec 018: 幂等创建 ~/.systemedu/config.yaml
#
# 由 install.sh 调起。
# 已存在的 config.yaml 不被覆盖。

set -euo pipefail

say()  { echo -e "  \033[0;34m[config]\033[0m $*"; }

SYSTEMEDU_HOME="${SYSTEMEDU_HOME:-$HOME/.systemedu}"
CFG="$SYSTEMEDU_HOME/config.yaml"

mkdir -p "$SYSTEMEDU_HOME"
mkdir -p "$SYSTEMEDU_HOME/logs"

if [ -f "$CFG" ]; then
    say "$CFG 已存在，跳过 (重跑 install.sh 不会覆盖)"
    exit 0
fi

say "首次安装 → 写 $CFG (空 key, 待用户在 web /config 填)"
cat > "$CFG" <<'YAMLEOF'
channels:
  cli:
    enabled: true
  web:
    enabled: false
gateway:
  host: 127.0.0.1
  port: 18820
hub:
  url: https://hub.systemedu.com
llm:
  default: creative
  providers:
    creative:
      base_url: https://open.bigmodel.cn/api/paas/v4
      api_key: ""
      model: glm-5.1
      temperature: 1.0
      max_tokens: 65536
mcp:
  servers: {}
memory:
  backend: mem0
  enabled: false
search:
  enabled: true
  tavily_api_key: ""
  max_results_per_source: 10
sandbox:
  allowed_dirs:
    - $HOME/projects
  blocked_commands:
    - "rm -rf /"
    - "format"
  enabled: true
  max_execution_time: 300
  network: true
tts:
  enabled: true
  api_key: ""
  model: qwen3-tts-flash
  voice: Cherry
YAMLEOF

# 替换 $HOME 占位
sed -i.bak "s|\$HOME|$HOME|g" "$CFG" && rm -f "${CFG}.bak"

say "已写入 $CFG"
say "  llm.creative.api_key = 空 (在 web /config 填)"
say "  tts.api_key          = 空 (在 web /config 填)"

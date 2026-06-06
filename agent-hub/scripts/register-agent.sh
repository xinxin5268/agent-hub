#!/bin/bash
# ============================================================
# register-agent.sh — Agent 自注册脚本
# 在 Agent 启动时调用，自动向注册中心报到
# 支持 opencode serve --mdns 自动注册 + HTTP 手动注册
# ============================================================

set -e

REGISTRY_URL="${REGISTRY_URL:-http://127.0.0.1:3210}"
AGENT_NAME="${AGENT_NAME:-$(hostname)}"
AGENT_TYPE="${AGENT_TYPE:-opencode}"
AGENT_PORT="${AGENT_PORT:-0}"
PLATFORM="${PLATFORM:-linux}"

# 检测平台
if grep -qi microsoft /proc/version 2>/dev/null; then
  PLATFORM="wsl"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
  PLATFORM="windows"
fi

echo "🔌 Agent Registration Script"
echo "══════════════════════════════"
echo "  Registry: $REGISTRY_URL"
echo "  Name:     $AGENT_NAME"
echo "  Type:     $AGENT_TYPE"
echo "  Platform: $PLATFORM"
echo ""

# 方式1: 启动 opencode serve（带 mDNS 自动注册）
start_opencode_serve() {
  local PORT="${1:-0}"
  local CWD="${2:-$PWD}"

  echo "🚀 Starting opencode serve on port ${PORT}..."
  
  # 确定 opencode 路径
  local OPENCODE_CMD="opencode"
  if [[ "$PLATFORM" == "windows" ]]; then
    # Windows 的 opencode.exe
    OPENCODE_CMD="$HOME/AppData/Roaming/npm/opencode.cmd"
    if [[ ! -f "$OPENCODE_CMD" ]]; then
      OPENCODE_CMD="/mnt/c/Users/Administrator/AppData/Roaming/npm/opencode.cmd"
    fi
  fi

  # 启动 opencode server（后台）
  nohup "$OPENCODE_CMD" serve \
    --port "$PORT" \
    --hostname "0.0.0.0" \
    --mdns \
    --mdns-domain "opencode.local" \
    --cwd "$CWD" \
    > /tmp/opencode-serve.log 2>&1 &
  
  local PID=$!
  echo "  PID: $PID"
  echo "  Log: /tmp/opencode-serve.log"
  
  # 等待服务启动
  sleep 2
  
  # 获取实际端口
  if [[ "$PORT" == "0" ]]; then
    PORT=$(grep -oP 'listening on \K[0-9]+' /tmp/opencode-serve.log 2>/dev/null || echo "3000")
  fi
  
  echo "  Port: $PORT"
  echo "  mDNS: enabled (_opencode._tcp)"
  
  # 通过 HTTP 向注册中心报到
  register_to_registry "$PORT" "$CWD"
}

# 方式2: HTTP 注册到注册中心
register_to_registry() {
  local PORT="${1:-3000}"
  local CWD="${2:-$PWD}"
  local WS_URL="ws://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT"
  
  # WSL 特殊处理
  if [[ "$PLATFORM" == "wsl" ]]; then
    # WSL 的 IP 从 Windows 侧看是 eth0 的 IP
    WS_URL="ws://$(ip route | grep default | awk '{print $3}'):$PORT"
  fi

  echo ""
  echo "📡 Registering to registry at $REGISTRY_URL..."
  
  local PAYLOAD=$(cat <<EOF
{
  "action": "register",
  "agent": {
    "id": "${AGENT_TYPE}-${HOSTNAME}-${PORT}",
    "name": "${AGENT_NAME}",
    "type": "${AGENT_TYPE}",
    "platform": "${PLATFORM}",
    "host": "$(hostname)",
    "port": ${PORT},
    "wsUrl": "${WS_URL}",
    "httpUrl": "http://$(hostname):${PORT}",
    "status": "online",
    "cwd": "${CWD}",
    "version": "$(opencode --version 2>/dev/null || echo 'unknown')",
    "lastHeartbeat": $(date +%s%3N),
    "registeredAt": $(date +%s%3N)
  }
}
EOF
)

  # 发送注册请求
  local RESPONSE
  RESPONSE=$(curl -s -X POST "$REGISTRY_URL/api/register" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" 2>/dev/null)
  
  if echo "$RESPONSE" | grep -q '"ok":true'; then
    echo "  ✅ Registered successfully!"
  else
    echo "  ⚠️  Registration response: $RESPONSE"
  fi
}

# 方式3: 直接启动 opencode 并通过 mDNS 广播
start_opencode_mdns_only() {
  local PORT="${1:-0}"
  local CWD="${2:-$PWD}"
  
  echo "🚀 Starting opencode serve (mDNS only)..."
  
  local OPENCODE_CMD="opencode"
  if [[ "$PLATFORM" == "windows" ]]; then
    OPENCODE_CMD="$HOME/AppData/Roaming/npm/opencode.cmd"
  fi

  nohup "$OPENCODE_CMD" serve \
    --port "$PORT" \
    --hostname "0.0.0.0" \
    --mdns \
    --cwd "$CWD" \
    > /tmp/opencode-serve.log 2>&1 &
  
  echo "  PID: $!"
  echo "  mDNS will auto-discover by registry"
}

# Main
case "${1:-serve}" in
  serve)
    start_opencode_serve "${2:-0}" "${3:-$PWD}"
    ;;
  register)
    register_to_registry "${2:-3000}"
    ;;
  mdns)
    start_opencode_mdns_only "${2:-0}" "${3:-$PWD}"
    ;;
  *)
    echo "Usage: $0 {serve|register|mdns} [port] [cwd]"
    echo ""
    echo "  serve    启动 opencode serve + 注册到注册中心（推荐）"
    echo "  register 仅向注册中心注册（opencode 已在运行）"
    echo "  mdns     仅启动 mDNS 广播（注册中心自动发现）"
    exit 1
    ;;
esac
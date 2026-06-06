#!/bin/bash
# ============================================================
# opencode-register.sh — OpenCode 一键注册到 Agent Hub
#
# 功能:
#   1. 启动 opencode serve (headless server mode)
#   2. 自动注册到 Agent Hub 注册中心
#   3. 建立 WS 长连接
#   4. 断线自动重连
#   5. 接收 Agent Hub 发来的指令
#
# 用法:
#   ./opencode-register.sh start      启动 opencode + 注册
#   ./opencode-register.sh stop       停止
#   ./opencode-register.sh status     查看状态
#
# 环境变量:
#   REGISTRY_URL  注册中心地址 (默认: http://127.0.0.1:3210)
#   OPENCODE_PORT opencode serve 端口 (默认: 0 = 随机分配)
#   AGENT_NAME    Agent 显示名称
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGISTRY_HTTP="${REGISTRY_URL:-http://127.0.0.1:3210}"
REGISTRY_WS="ws://${REGISTRY_HTTP#http://}/ws"
OPENCODE_PORT="${OPENCODE_PORT:-0}"
PLATFORM="linux"
PID_DIR="/tmp/agent-hub-pids"
LOG_DIR="/tmp/agent-hub-logs"
mkdir -p "$PID_DIR" "$LOG_DIR"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

die() { echo -e "${RED}❌ $*${NC}" >&2; exit 1; }
ok()  { echo -e "${GREEN}✅ $*${NC}"; }
warn(){ echo -e "${YELLOW}⚠️  $*${NC}"; }
info(){ echo -e "${BLUE}ℹ️  $*${NC}"; }

# ─── 检测平台 ─────────────────────────────────────────────
detect_platform() {
  if grep -qi microsoft /proc/version 2>/dev/null; then
    PLATFORM="wsl"
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    PLATFORM="windows"
  fi
  echo "$PLATFORM"
}

get_ip() {
  if [[ "$PLATFORM" == "windows" ]]; then
    # Windows 用主机名或 WSL gateway IP
    ip route | grep default | awk '{print $3}' 2>/dev/null || echo "127.0.0.1"
  else
    hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
  fi
}

# ─── 启动 opencode serve ────────────────────────────────
start_opencode() {
  local port="$OPENCODE_PORT"
  local hostname="0.0.0.0"
  
  info "启动 OpenCode serve (port: $port)..."

  # Windows 用 opencode.cmd
  local opencode_cmd="opencode"
  if [[ "$PLATFORM" == "windows" ]]; then
    if command -v opencode.cmd &>/dev/null; then
      opencode_cmd="opencode.cmd"
    elif [ -f "$HOME/AppData/Roaming/npm/opencode.cmd" ]; then
      opencode_cmd="$HOME/AppData/Roaming/npm/opencode.cmd"
    fi
  fi

  # 检查 opencode 是否已安装
  if ! command -v "$opencode_cmd" &>/dev/null; then
    die "opencode 未安装，请先安装: npm install -g opencode-ai"
  fi

  local version=$("$opencode_cmd" --version 2>/dev/null || echo "unknown")
  info "  OpenCode 版本: $version"

  # 启动 opencode server（后台）
  nohup "$opencode_cmd" serve \
    --port "$port" \
    --hostname "$hostname" \
    --mdns \
    --mdns-domain "opencode.local" \
    > "$LOG_DIR/opencode-serve.log" 2>&1 &
  
  local pid=$!
  echo "$pid" > "$PID_DIR/opencode-serve.pid"
  
  info "  等待服务启动..."
  
  # 等待服务启动并获取实际端口
  local actual_port=""
  for i in $(seq 1 15); do
    sleep 1
    # 从日志中提取端口
    actual_port=$(grep -oP 'listening on http://[^:]+:\K\d+' "$LOG_DIR/opencode-serve.log" 2>/dev/null || true)
    if [ -n "$actual_port" ]; then
      break
    fi
    # 用 lsof 查端口
    actual_port=$(lsof -i -P -n 2>/dev/null | grep "opencode" | grep LISTEN | awk '{print $9}' | grep -oP '\d+$' | head -1 || true)
    if [ -n "$actual_port" ]; then
      break
    fi
  done

  if [ -z "$actual_port" ]; then
    # fallback: 用传入端口或默认
    actual_port="${port:-3000}"
  fi

  OPENCODE_PORT="$actual_port"
  ok "OpenCode serve 已启动 (PID: $pid, Port: $actual_port)"
  
  # 返回端口信息
  echo "$actual_port"
}

# ─── 注册到 Agent Hub ──────────────────────────────────
register_to_hub() {
  local port="$1"
  local agent_id="${2:-opencode-$PLATFORM}"
  local agent_name="${AGENT_NAME:-OpenCode ($(echo $PLATFORM | tr 'a-z' 'A-Z'))}"
  local ip=$(get_ip)
  local ws_url="ws://$ip:$port"
  local http_url="http://$ip:$port"
  local now=$(date +%s%3N)

  info "注册到 Agent Hub ($REGISTRY_HTTP)..."
  
  # 1. HTTP 注册
  local payload
  payload=$(cat <<EOF
{
  "action": "register",
  "agent": {
    "id": "$agent_id",
    "name": "$agent_name",
    "type": "opencode",
    "platform": "$PLATFORM",
    "host": "$ip",
    "port": $port,
    "wsUrl": "$ws_url",
    "httpUrl": "$http_url",
    "status": "online",
    "tags": {"role": "coder", "auto-registered": "true"},
    "version": "$(opencode --version 2>/dev/null || echo 'unknown')",
    "lastHeartbeat": $now,
    "registeredAt": $now
  }
}
EOF
)

  local result
  result=$(curl -s -X POST "$REGISTRY_HTTP/api/register" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)

  if echo "$result" | grep -q '"ok":true'; then
    ok "HTTP 注册成功 ($agent_id)"
  else
    warn "HTTP 注册失败: $result"
  fi

  # 2. 启动 WS 客户端（长连接）
  info "启动 WS 长连接..."
  
  AGENT_ID="$agent_id" \
  AGENT_NAME="$agent_name" \
  AGENT_TYPE="opencode" \
  AGENT_PLATFORM="$PLATFORM" \
  AGENT_HOST="$ip" \
  AGENT_PORT="$port" \
  AGENT_WS_URL="$ws_url" \
  AGENT_HTTP_URL="$http_url" \
  REGISTRY_WS="$REGISTRY_WS" \
  AGENT_TAGS='{"role":"coder","auto-registered":"true"}' \
  nohup node "$SCRIPT_DIR/agent-ws-client.cjs" \
    --id="$agent_id" \
    --name="$agent_name" \
    --type="opencode" \
    --platform="$PLATFORM" \
    --host="$ip" \
    --port="$port" \
    --agent-ws="$ws_url" \
    --ws="$REGISTRY_WS" \
    > "$LOG_DIR/ws-opencode-$PLATFORM.log" 2>&1 &
  
  local ws_pid=$!
  echo "$ws_pid" > "$PID_DIR/ws-opencode-$PLATFORM.pid"
  ok "WS 客户端已启动 (PID: $ws_pid)"

  echo ""
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo -e "${BOLD}  ✅ $agent_name 注册完成！${NC}"
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo ""
  echo "  Agent ID:     $agent_id"
  echo "  WS URL:       $ws_url"
  echo "  HTTP URL:     $http_url"
  echo "  注册中心:     $REGISTRY_HTTP"
  echo ""
  echo "  在其他终端运行:"
  echo "    agent list                    # 查看所有 Agent"
  echo "    agent send $agent_id '帮我xxx'  # 发送指令"
  echo ""
}

# ─── 命令实现 ─────────────────────────────────────────────
cmd_start() {
  detect_platform
  
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo -e "${BOLD}  🚀 OpenCode 自动注册${NC}"
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo ""

  # 检查注册中心
  if ! curl -sf "$REGISTRY_HTTP/api/stats" >/dev/null 2>&1; then
    warn "注册中心未运行，尝试自动启动..."
    bash "$SCRIPT_DIR/agent-ctl.sh" start 2>/dev/null || {
      die "无法启动注册中心，请先手动启动: bash agent-ctl.sh start"
    }
  fi
  ok "注册中心可用"

  # 启动 opencode serve
  local port
  port=$(start_opencode)
  
  # 注册到 Hub
  register_to_hub "$port"
}

cmd_stop() {
  echo -e "${YELLOW}⏹  停止 OpenCode 注册...${NC}"
  
  # 停止 WS 客户端
  local ws_pid=$(cat "$PID_DIR/ws-opencode-$PLATFORM.pid" 2>/dev/null || true)
  if [ -n "$ws_pid" ]; then
    kill "$ws_pid" 2>/dev/null && ok "WS 客户端已停止" || true
    rm -f "$PID_DIR/ws-opencode-$PLATFORM.pid"
  fi

  # 停止 opencode serve
  local oc_pid=$(cat "$PID_DIR/opencode-serve.pid" 2>/dev/null || true)
  if [ -n "$oc_pid" ]; then
    kill "$oc_pid" 2>/dev/null && ok "OpenCode serve 已停止" || true
    rm -f "$PID_DIR/opencode-serve.pid"
  fi

  ok "已停止"
}

cmd_status() {
  echo -e "${BOLD}📊 OpenCode 注册状态${NC}"
  echo "$(printf '═%.0s' $(seq 1 50))"
  
  # opencode serve
  local oc_pid=$(cat "$PID_DIR/opencode-serve.pid" 2>/dev/null || true)
  if [ -n "$oc_pid" ] && kill -0 "$oc_pid" 2>/dev/null; then
    echo -e "  🟢 OpenCode serve (PID: $oc_pid)"
  else
    echo -e "  🔴 OpenCode serve"
  fi

  # WS 客户端
  local ws_pid=$(cat "$PID_DIR/ws-opencode-$PLATFORM.pid" 2>/dev/null || true)
  if [ -n "$ws_pid" ] && kill -0 "$ws_pid" 2>/dev/null; then
    echo -e "  🟢 WS 客户端 (PID: $ws_pid)"
  else
    echo -e "  🔴 WS 客户端"
  fi

  # 注册中心状态
  echo ""
  local stats=$(curl -s "$REGISTRY_HTTP/api/stats" 2>/dev/null || true)
  if [ -n "$stats" ]; then
    echo "$stats" | python3 -c "
import json,sys
s=json.load(sys.stdin)
print(f'  Agent 总数: {s[\"total\"]}  |  🟢在线: {s[\"online\"]}')
" 2>/dev/null || echo "  (无法获取统计)"
  fi
}

cmd_help() {
  cat <<EOF
${BOLD}OpenCode 自动注册到 Agent Hub${NC}

${BOLD}用法:${NC} ./opencode-register.sh <command>

${BOLD}命令:${NC}
  start     启动 opencode serve + 注册到 Agent Hub
  stop      停止所有
  status    查看状态
  help      帮助

${BOLD}环境变量:${NC}
  REGISTRY_URL  注册中心地址 (默认: http://127.0.0.1:3210)
  OPENCODE_PORT opencode serve 端口 (默认: 随机)
  AGENT_NAME    Agent 显示名称

${BOLD}示例:${NC}
  ./opencode-register.sh start
  REGISTRY_URL=http://192.168.1.100:3210 ./opencode-register.sh start
  AGENT_NAME="OpenCode (我的Windows)" ./opencode-register.sh start

EOF
}

# ─── Main ─────────────────────────────────────────────────
main() {
  local cmd="${1:-help}"
  shift 2>/dev/null || true

  case "$cmd" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    status)  cmd_status ;;
    help|--help|-h) cmd_help ;;
    *)       die "未知命令: $cmd\n可用: start, stop, status, help" ;;
  esac
}

main "$@"
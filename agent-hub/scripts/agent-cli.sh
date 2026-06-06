#!/bin/bash
# ============================================================
# agent — Agent Hub CLI 工具
# 通过命令行调用已注册的跨系统 Agent
# 用法: agent <command> [options]
# 
# 安装: echo 'alias agent="bash /path/to/agent-cli.sh"' >> ~/.bashrc
# ============================================================

set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-http://127.0.0.1:3210}"
VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

# ─── Helpers ─────────────────────────────────────────────
api() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$REGISTRY_URL$path" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -s -X "$method" "$REGISTRY_URL$path"
  fi
}

die() { echo -e "${RED}❌ $*${NC}" >&2; exit 1; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
ok()   { echo -e "${GREEN}✅ $*${NC}"; }

check_registry() {
  if ! curl -sf "$REGISTRY_URL/api/stats" >/dev/null 2>&1; then
    die "注册中心未运行\n  启动: cd agent-hub && npx tsx src/registry/server.ts"
  fi
}

# 把数据处理委托给一个 Python 辅助脚本
py() {
  python3 "$SCRIPT_DIR/agent-cli-py.py" "$@"
}

# ─── Commands ─────────────────────────────────────────────

cmd_list() {
  check_registry
  local data
  data=$(api GET "/api/agents") || die "获取 Agent 列表失败"
  echo "$data" | py list
}

cmd_status() {
  check_registry
  local data
  data=$(api GET "/api/stats") || die "获取统计失败"
  echo "$data" | py status
}

cmd_info() {
  local agent_id="${1:-}"
  [ -z "$agent_id" ] && die "用法: agent info <agent-id>"
  check_registry
  local data
  data=$(api GET "/api/agents/$agent_id") || die "Agent '$agent_id' 未找到"
  echo "$data" | py info
}

cmd_send() {
  local agent_id="${1:-}"
  shift 2>/dev/null || true
  local message="$*"
  [ -z "$agent_id" ] && die "用法: agent send <agent-id> <消息内容>"
  [ -z "$message" ] && die "请输入消息内容"
  check_registry
  
  local payload
  payload=$(cat <<EOF
{
  "id": "cli-$(date +%s)-$$",
  "agentId": "$agent_id",
  "command": "inject",
  "payload": "$message",
  "from": "agent-cli",
  "timestamp": $(date +%s%3N)
}
EOF
)
  warn "📨 发送指令到 $agent_id..."
  local result
  result=$(api POST "/api/command" "$payload") || die "发送失败"
  echo "$result" | py send
}

cmd_broadcast() {
  local message="$*"
  [ -z "$message" ] && die "用法: agent broadcast <消息内容>"
  check_registry
  
  local data
  data=$(api GET "/api/agents") || die "获取 Agent 列表失败"
  
  # 获取在线 Agent 列表
  local online_ids
  online_ids=$(echo "$data" | python3 -c "
import json,sys
data = json.load(sys.stdin)
agents = [a for a in data.get('agents', []) if a.get('status') == 'online']
for a in agents:
    print(a['id'])
")
  
  local count=0
  for aid in $online_ids; do
    local payload
    payload=$(cat <<EOF
{
  "id": "bc-$(date +%s)-$$",
  "agentId": "$aid",
  "command": "inject",
  "payload": "[广播] $message",
  "from": "agent-cli-broadcast",
  "timestamp": $(date +%s%3N)
}
EOF
)
    api POST "/api/command" "$payload" >/dev/null 2>&1 && ((count++)) || true
  done
  
  warn "📢 已广播到 $count 个在线 Agent"
}

cmd_exec() {
  local agent_id="${1:-}"
  shift 2>/dev/null || true
  local command="$*"
  [ -z "$agent_id" ] && die "用法: agent exec <agent-id> <shell命令>"
  [ -z "$command" ] && die "请输入要执行的命令"
  check_registry
  
  local payload
  payload=$(cat <<EOF
{
  "id": "cli-$(date +%s)-$$",
  "agentId": "$agent_id",
  "command": "exec",
  "payload": "$command",
  "from": "agent-cli",
  "timestamp": $(date +%s%3N)
}
EOF
)
  warn "⚡ 远程执行: $agent_id → $command"
  local result
  result=$(api POST "/api/command" "$payload") || die "执行失败"
  echo "$result" | py exec
}

cmd_register() {
  local agent_id="${1:-}"
  local agent_name="${2:-$agent_id}"
  local agent_type="${3:-custom}"
  [ -z "$agent_id" ] && die "用法: agent register <agent-id> [name] [type]"
  
  local hostname ip platform="linux"
  hostname=$(hostname)
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
  grep -qi microsoft /proc/version 2>/dev/null && platform="wsl"
  
  local payload
  payload=$(cat <<EOF
{
  "action": "register",
  "agent": {
    "id": "$agent_id",
    "name": "$agent_name",
    "type": "$agent_type",
    "platform": "$platform",
    "host": "$ip",
    "port": 0,
    "wsUrl": "ws://$ip:0",
    "httpUrl": "http://$ip:0",
    "status": "online",
    "tags": {"registered_by": "agent-cli"},
    "lastHeartbeat": $(date +%s%3N),
    "registeredAt": $(date +%s%3N)
  }
}
EOF
)
  warn "📡 注册 $agent_name ($agent_id) ..."
  local result
  result=$(api POST "/api/register" "$payload") || die "注册失败"
  echo "$result" | py register
}

cmd_unregister() {
  local agent_id="${1:-}"
  [ -z "$agent_id" ] && die "用法: agent unregister <agent-id>"
  local payload
  payload=$(cat <<EOF
{
  "action": "register",
  "agent": {
    "id": "$agent_id", "name": "$agent_id", "type": "custom",
    "platform": "linux", "host": "", "port": 0,
    "wsUrl": "", "httpUrl": "", "status": "offline",
    "tags": {}, "lastHeartbeat": 0, "registeredAt": 0
  }
}
EOF
)
  api POST "/api/register" "$payload" >/dev/null 2>&1 && ok "已注销 $agent_id" || die "注销失败"
}

cmd_watch() {
  check_registry
  echo -e "${BOLD}👁️  Agent Hub 实时监控 (Ctrl+C 退出)${NC}"
  echo "$(printf '═%.0s' $(seq 1 50))"
  
  while true; do
    clear 2>/dev/null || true
    echo -e "${BOLD}👁️  Agent Hub 实时监控  |  $(date '+%H:%M:%S')${NC}"
    echo "$(printf '═%.0s' $(seq 1 50))"
    
    local data
    data=$(api GET "/api/agents" 2>/dev/null) || { echo -e "${RED}连接丢失...${NC}"; sleep 3; continue; }
    echo "$data" | py watch
    sleep 5
  done
}

cmd_help() {
  cat <<EOF
${BOLD}Agent Hub CLI v$VERSION${NC}
跨系统多 Agent 调用工具

${BOLD}用法:${NC} agent <command> [options]

${BOLD}管理命令:${NC}
  ${GREEN}list${NC}                         列出所有已注册 Agent
  ${GREEN}status${NC}                       查看注册中心统计
  ${GREEN}info${NC} <agent-id>               查看 Agent 详情
  ${GREEN}watch${NC}                         实时监控 (5s 刷新)

${BOLD}操作命令:${NC}
  ${GREEN}send${NC} <agent-id> <message>     发送指令到 Agent
  ${GREEN}broadcast${NC} <message>           广播到所有在线 Agent
  ${GREEN}exec${NC} <agent-id> <command>     远程执行 shell 命令

${BOLD}注册命令:${NC}
  ${GREEN}register${NC} <id> [name] [type]   注册本机
  ${GREEN}unregister${NC} <agent-id>         注销 Agent

${BOLD}环境变量:${NC}
  REGISTRY_URL   注册中心地址 (默认: http://127.0.0.1:3210)
  AGENT_HUB_HOST 远程注册中心主机

${BOLD}示例:${NC}
  agent list
  agent info xiaobao
  agent send xiaobao '帮我查一下系统'
  agent exec opencode-wsl 'ls -la /tmp'
  agent broadcast '维护通知'
  agent watch

EOF
}

# ─── Main ─────────────────────────────────────────────────
main() {
  local cmd="${1:-help}"
  shift 2>/dev/null || true

  if [ -n "${AGENT_HUB_HOST:-}" ]; then
    REGISTRY_URL="http://$AGENT_HUB_HOST:3210"
  fi

  case "$cmd" in
    list|ls)       cmd_list ;;
    status|st)     cmd_status ;;
    info|get)      cmd_info "$@" ;;
    send|msg)      cmd_send "$@" ;;
    broadcast|bc)  cmd_broadcast "$@" ;;
    exec|run)      cmd_exec "$@" ;;
    register|reg)  cmd_register "$@" ;;
    unregister|rm) cmd_unregister "$@" ;;
    watch|top)     cmd_watch ;;
    help|--help|-h) cmd_help ;;
    *)             die "未知命令: $cmd\n可用: list, status, info, send, broadcast, exec, register, unregister, watch, help" ;;
  esac
}

main "$@"
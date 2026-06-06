#!/bin/bash
# ============================================================
# agent-ctl — Agent Hub 一键启动/停止/状态管理
# 
# 自动化完成:
#   1. 启动注册中心 (WebSocket + HTTP)
#   2. 注册所有已知 Agent
#   3. 为每个 Agent 启动 WS 长连接客户端
#   4. 启动 Agent Hub Web UI
#   5. 安装 CLI 工具
#   6. 配置开机自启
#
# 用法:
#   ./agent-ctl.sh start      一键启动所有服务
#   ./agent-ctl.sh stop       停止所有服务
#   ./agent-ctl.sh status     查看服务状态
#   ./agent-ctl.sh restart    重启所有服务
#   ./agent-ctl.sh install    安装到系统（alias + 开机自启）
#   ./agent-ctl.sh log        查看日志
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REGISTRY_PORT=3210
HUB_PORT=5173
REGISTRY_HTTP="http://127.0.0.1:$REGISTRY_PORT"
REGISTRY_WS="ws://127.0.0.1:$REGISTRY_PORT/ws"
PID_DIR="/tmp/agent-hub-pids"
LOG_DIR="/tmp/agent-hub-logs"
VERSION="2.0.0"

# ─── Colors ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

die() { echo -e "${RED}❌ $*${NC}" >&2; exit 1; }
ok()  { echo -e "${GREEN}✅ $*${NC}"; }
warn(){ echo -e "${YELLOW}⚠️  $*${NC}"; }
info(){ echo -e "${BLUE}ℹ️  $*${NC}"; }

mkdir -p "$PID_DIR" "$LOG_DIR"

# ─── 工具函数 ─────────────────────────────────────────────
api() {
  curl -sf -X "$1" "$REGISTRY_HTTP$2" -H "Content-Type: application/json" -d "${3:-}" 2>/dev/null || true
}

get_ip() {
  ip route get 1 2>/dev/null | awk '{print $7; exit}' || hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1"
}

get_platform() {
  if grep -qi microsoft /proc/version 2>/dev/null; then echo "wsl"; 
  elif [[ "$OSTYPE" == "darwin"* ]]; then echo "macos";
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then echo "windows";
  else echo "linux"; fi
}

save_pid() { echo "$!" > "$PID_DIR/$1.pid"; }
get_pid() { cat "$PID_DIR/$1.pid" 2>/dev/null || echo ""; }
is_running() { local pid=$(get_pid "$1"); [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; }

kill_pid() {
  local name="$1" sig="${2:-TERM}"
  local pid=$(get_pid "$name")
  [ -z "$pid" ] && return 1
  kill "-$sig" "$pid" 2>/dev/null || true
  rm -f "$PID_DIR/$name.pid"
}

wait_for_port() {
  local port="$1" timeout="${2:-10}"
  for i in $(seq 1 $timeout); do
    if curl -s -o /dev/null "http://127.0.0.1:$port/api/stats" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

# ═══════════════════════════════════════════════════════════
# Agent 定义
# ═══════════════════════════════════════════════════════════
# 格式: name|id|type|platform|host|port|wsUrl|role|extra
# 自动检测: host=auto, port=auto
AGENTS=()

detect_agents() {
  local ip=$(get_ip)
  local platform=$(get_platform)

  # 小宝 (OpenClaw Gateway)
  if curl -s -o /dev/null http://127.0.0.1:18790/health 2>/dev/null; then
    AGENTS+=("小宝 (CEO)|xiaobao|openclaw-gateway|$platform|127.0.0.1|18790|ws://127.0.0.1:18790|ceo|{\"model\":\"deepseek-v4-flash\"}")
    ok "发现 小宝 (OpenClaw Gateway :18790)"
  fi

  # 小聪 (如果 18800 在跑)
  if curl -s -o /dev/null http://127.0.0.1:18800/health 2>/dev/null; then
    AGENTS+=("小聪|xiaocong|openclaw-gateway|windows|127.0.0.1|18800|ws://127.0.0.1:18800|worker|{}")
    ok "发现 小聪 (:18800)"
  fi

  # Hermes
  if curl -s -o /dev/null http://127.0.0.1:8642/health 2>/dev/null; then
    AGENTS+=("Hermes|hermes|openclaw-gateway|$platform|127.0.0.1|8642|ws://127.0.0.1:8642|coordinator|{\"provider\":\"local\"}")
    ok "发现 Hermes (:8642)"
  fi

  # OpenCode WSL
  if command -v opencode &>/dev/null; then
    local oc_version=$(opencode --version 2>/dev/null || echo "1.x")
    AGENTS+=("OpenCode (WSL)|opencode-wsl|opencode|$platform|$ip|3000|ws://$ip:3000|coder|{\"version\":\"$oc_version\"}")
    ok "发现 OpenCode (WSL)"
  fi

  # 检测 Windows 的 opencode
  local win_gateway=$(ip route | grep default | awk '{print $3}' 2>/dev/null || echo "")
  if [ -n "$win_gateway" ] && ping -c 1 -W 1 "$win_gateway" >/dev/null 2>&1; then
    local win_has_opencode=$(powershell.exe -Command "Get-Command opencode -ErrorAction SilentlyContinue | Select-Object -First 1" 2>/dev/null | tr -d '
' || echo "")
    if [ -n "$win_has_opencode" ]; then
      ok "发现 Windows 主机有 opencode ($win_gateway)"
      local win_oc_running=$(powershell.exe -Command "Get-Process opencode -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id" 2>/dev/null | tr -d '
' || echo "")
      if [ -z "$win_oc_running" ]; then
        info "启动 Windows OpenCode serve..."
        powershell.exe -Command "Start-Process -FilePath 'C:\Users\Administrator\AppData\Roaming\npm\opencode.cmd' -ArgumentList 'serve','--port','0','--hostname','0.0.0.0','--mdns' -WindowStyle Hidden" 2>/dev/null
        sleep 5
      fi
      local win_pid=$(powershell.exe -Command "Get-Process opencode -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Id" 2>/dev/null | tr -d '
' || echo "")
      if [ -n "$win_pid" ]; then
        local win_port=$(powershell.exe -Command "netstat -ano | Select-String LISTENING | Select-String $win_pid | ForEach-Object { $_ -replace '.*:(\d+)\s+.*','\$1' }" 2>/dev/null | head -1 | tr -d '
' || echo "3000")
        local win_ip=$(powershell.exe -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.IPAddress -notmatch '^127|^169' } | Select-Object -First 1).IPAddress" 2>/dev/null | tr -d '
' || echo "$win_gateway")
        AGENTS+=("OpenCode (Windows)|opencode-win|opencode|windows|$win_ip|$win_port|ws://$win_ip:$win_port|coder|{\"auto-registered\":\"true\"}")
        ok "发现 OpenCode (Windows -> $win_ip:$win_port)"
      fi
    fi
  fi

  if [ ${#AGENTS[@]} -eq 0 ]; then
    warn "未自动发现任何 Agent"
    AGENTS+=("本机|$(hostname)|custom|$platform|$ip|0||worker|{}")
  fi
}

start_registry() {
  info "启动注册中心 (:${REGISTRY_PORT})..."
  if is_running registry; then
    ok "注册中心已在运行 (PID $(get_pid registry))"
    return 0
  fi

  cd "$HUB_DIR"
  nohup npx tsx src/registry/server.ts > "$LOG_DIR/registry.log" 2>&1 &
  save_pid registry

  if wait_for_port $REGISTRY_PORT 10; then
    ok "注册中心已启动 (PID $(get_pid registry))"
  fi
    die "注册中心启动超时"
  fi
  fi
}

start_agents() {
  info "注册 Agent 并建立 WS 长连接..."
  
  local now=$(date +%s%3N)
  local count=0

  for agent_entry in "${AGENTS[@]}"; do
    IFS='|' read -r name id type platform host port ws role extra_tags <<< "$agent_entry"
    
    # 注册到注册中心 (HTTP)
    # 构建 tags JSON：合并 role 和 extra_tags
    local tags_json="{}"
    if [ -n "$extra_tags" ]; then
      # extra_tags 是完整 JSON 对象（如 {"model":"xxx"}），去掉首尾括号后合并 role
      local inner="${extra_tags#\{}"
      inner="${inner%\}}"
      tags_json="{\"role\":\"$role\",$inner}"
  fi
      tags_json="{\"role\":\"$role\"}"
    fi
    local payload=$(cat <<EOF
{
  "action": "register",
  "agent": {
    "id": "$id",
    "name": "$name",
    "type": "$type",
    "platform": "$platform",
    "host": "$host",
    "port": $port,
    "wsUrl": "$ws",
    "httpUrl": "http://$host:$port",
    "status": "online",
    "tags": $tags_json,
    "lastHeartbeat": $now,
    "registeredAt": $now
  }
}
EOF
)
    api POST "/api/register" "$payload" > /dev/null && ok "  $name ($id) 已注册" || warn "  $name ($id) 注册失败"
    
    # 启动 WS 客户端 (除非是外网 Agent)
    if [ "$host" = "127.0.0.1" ] || [ "$host" = "$(get_ip)" ]; then
      if ! is_running "ws-$id"; then
        local agent_ws="$ws"
        [ -z "$agent_ws" ] && agent_ws="ws://$host:$port"
        
        # 通过环境变量传递 tags（避免 shell 参数分割问题）
        AGENT_TAGS="$tags_json" \
        nohup node "$SCRIPT_DIR/agent-ws-client.cjs" \
          --id="$id" --name="$name" --type="$type" --platform="$platform" \
          --host="$host" --port="$port" \
          --agent-ws="$agent_ws" \
          --ws="$REGISTRY_WS" \
          > "$LOG_DIR/ws-$id.log" 2>&1 &
        save_pid "ws-$id"
        ok "  $name WS 客户端已启动 (PID $(get_pid ws-$id))"
        ((count++))
  fi
        ok "  $name WS 客户端已在运行"
      fi
  fi
      warn "  $name 是外部 Agent（$host），跳过本地 WS 客户端"
    fi
  done

  info "共启动 $count 个 WS 客户端"
}

start_hub_ui() {
  info "启动 Agent Hub Web UI (:${HUB_PORT})..."
  if is_running hub-ui; then
    ok "Agent Hub 已在运行"
    return 0
  fi

  cd "$HUB_DIR"
  # 先构建
  info "构建 Agent Hub..."
  npx vite build > "$LOG_DIR/build.log" 2>&1 && ok "构建完成" || warn "构建失败，使用已有构建"

  # 启动静态服务器
  nohup python3 -m http.server $HUB_PORT --bind 0.0.0.0 -d "$HUB_DIR/dist" \
    > "$LOG_DIR/hub-ui.log" 2>&1 &
  save_pid hub-ui
  sleep 1

  if curl -s -o /dev/null "http://127.0.0.1:$HUB_PORT/" 2>/dev/null; then
    ok "Agent Hub 已启动 (http://127.0.0.1:$HUB_PORT/)"
  fi
    warn "Agent Hub 可能未完全启动，检查日志: $LOG_DIR/hub-ui.log"
  fi
}

install_cli() {
  info "安装 Agent CLI 工具..."
  
  # alias
  local alias_line='alias agent="bash '"$SCRIPT_DIR/agent-cli.sh"'"'
  local rc_files=("$HOME/.bashrc" "$HOME/.zshrc")
  
  for rc in "${rc_files[@]}"; do
    if [ -f "$rc" ]; then
      if ! grep -q "alias agent=" "$rc" 2>/dev/null; then
        echo "$alias_line" >> "$rc"
        ok "已添加 alias 到 $rc"
  fi
        ok "alias 已存在于 $rc"
      fi
    fi
  done

  # 也加为 system link
  if ln -sf "$SCRIPT_DIR/agent-cli.sh" /usr/local/bin/agent 2>/dev/null; then
    ok "已安装到 /usr/local/bin/agent"
  fi
    warn "无法写入 /usr/local/bin（无权限），使用 alias 即可"
  fi

  ok "CLI 工具就绪，运行: agent list"
}

install_systemd() {
  info "安装开机自启服务..."
  
  cat > /tmp/agent-hub.service <<EOF
[Unit]
Description=Agent Hub — 多 Agent 协作工作室
After=network.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=$SCRIPT_DIR/agent-ctl.sh start
ExecStop=$SCRIPT_DIR/agent-ctl.sh stop
ExecReload=$SCRIPT_DIR/agent-ctl.sh restart
User=$USER
WorkingDirectory=$HUB_DIR

[Install]
WantedBy=multi-user.target
EOF

  if sudo mv /tmp/agent-hub.service /etc/systemd/system/agent-hub.service 2>/dev/null; then
    sudo systemctl daemon-reload
    ok "已安装 systemd 服务: agent-hub"
    info "  sudo systemctl enable agent-hub    # 开机自启"
    info "  sudo systemctl start agent-hub     # 手动启动"
  fi
    warn "无法安装 systemd 服务（无 sudo 权限），仅支持手动启动"
  fi
}

# ═══════════════════════════════════════════════════════════
# 命令实现
# ═══════════════════════════════════════════════════════════

cmd_start() {
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo -e "${BOLD}  Agent Hub v$VERSION — 一键启动${NC}"
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo ""

  detect_agents
  echo ""
  start_registry
  echo ""
  start_agents
  echo ""
  start_hub_ui
  echo ""
  install_cli
  echo ""

  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo -e "${BOLD}  ✅ 全部就绪！${NC}"
  echo -e "${BOLD}══════════════════════════════════════${NC}"
  echo ""
  echo "  🏢 Agent Hub UI:  http://127.0.0.1:$HUB_PORT/"
  echo "  📡 注册中心:      $REGISTRY_HTTP"
  echo "  📋 Control UI:    http://127.0.0.1:18790/"
  echo ""
  echo "  CLI: agent list / agent watch / agent send <id> <msg>"
  echo ""
  echo "  日志: $LOG_DIR/"
  echo "  PID:  $PID_DIR/"
}

cmd_stop() {
  echo -e "${YELLOW}⏹  停止所有服务...${NC}"

  # 停止 WS 客户端
  for pidfile in "$PID_DIR"/ws-*.pid; do
    [ -f "$pidfile" ] || continue
    local name=$(basename "$pidfile" .pid | sed 's/^ws-//')
    kill_pid "ws-$name" && ok "已停止 $name"
  done

  kill_pid hub-ui && ok "已停止 Agent Hub UI" || true
  kill_pid registry && ok "已停止注册中心" || true

  ok "所有服务已停止"
}

cmd_status() {
  echo -e "${BOLD}📊 Agent Hub 状态${NC}"
  echo "$(printf '═%.0s' $(seq 1 50))"

  echo ""
  echo -e "  ${BOLD}服务:${NC}"
  for svc in registry hub-ui; do
    local pid=$(get_pid "$svc")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo -e "    🟢 $svc (PID $pid)"
  fi
      echo -e "    🔴 $svc"
    fi
  done

  echo ""
  echo -e "  ${BOLD}WS 客户端:${NC}"
  local ws_count=0
  for pidfile in "$PID_DIR"/ws-*.pid; do
    [ -f "$pidfile" ] || continue
    local name=$(basename "$pidfile" .pid | sed 's/^ws-//')
    local pid=$(get_pid "ws-$name")
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo -e "    🟢 $name (PID $pid)"
      ((ws_count++))
  fi
      echo -e "    🔴 $name"
    fi
  done
  [ $ws_count -eq 0 ] && echo "    (无)"

  echo ""
  echo -e "  ${BOLD}注册中心:${NC}"
  local stats=$(curl -s "$REGISTRY_HTTP/api/stats" 2>/dev/null)
  if [ -n "$stats" ]; then
    echo "$stats" | python3 -c "
import json,sys
s=json.load(sys.stdin)
print(f'    Agent 总数: {s[\"total\"]}  |  🟢在线: {s[\"online\"]}  |  🟡忙碌: {s[\"busy\"]}  |  🔴离线: {s[\"offline\"]}')
by_plat = s.get('byPlatform', {})
print(f'    平台分布: {\"  \".join([f\"{p}: {c}\" for p,c in by_plat.items()])}')
" 2>/dev/null || echo "    (无法获取)"
  fi
    echo "    🔴 未连接"
  fi
}

cmd_log() {
  local svc="${1:-all}"
  case "$svc" in
    registry) tail -f "$LOG_DIR/registry.log" ;;
    hub|ui)   tail -f "$LOG_DIR/hub-ui.log" ;;
    build)    tail -f "$LOG_DIR/build.log" ;;
    ws-*|all)
      local files=()
      for f in "$LOG_DIR"/*.log; do
        [ -f "$f" ] && files+=("$f")
      done
      tail -f "${files[@]}"
      ;;
    *)        tail -f "$LOG_DIR/registry.log" "$LOG_DIR/hub-ui.log" ;;
  esac
}

cmd_install() {
  install_cli
  install_systemd
  ok "安装完成"
}

cmd_help() {
  cat <<EOF
${BOLD}Agent Hub v$VERSION — 跨系统多 Agent 协作工作室${NC}

${BOLD}用法:${NC} ./agent-ctl.sh <command>

${BOLD}命令:${NC}
  ${GREEN}start${NC}     一键启动所有服务 (注册中心 + WS 客户端 + Web UI)
  ${GREEN}stop${NC}      停止所有服务
  ${GREEN}restart${NC}   重启所有服务
  ${GREEN}status${NC}    查看服务运行状态
  ${GREEN}log${NC}       [service] 查看日志 (registry|hub|ws-<id>|all)
  ${GREEN}install${NC}   安装 CLI 工具 + 开机自启服务

${BOLD}快速开始:${NC}
  ./agent-ctl.sh start         # 一键启动
  agent list                   # 查看 Agent 舰队
  agent watch                  # 实时监控

EOF
}

# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

main() {
  local cmd="${1:-help}"
  shift 2>/dev/null || true

  case "$cmd" in
    start)     cmd_start ;;
    stop)      cmd_stop ;;
    restart)   cmd_stop; sleep 1; cmd_start ;;
    status)    cmd_status ;;
    log)       cmd_log "$@" ;;
    install)   cmd_install ;;
    help|--help|-h) cmd_help ;;
    *)         die "未知命令: $cmd\n可用: start, stop, restart, status, log, install, help"
  esac
}

main "$@"
#!/bin/bash
# ============================================================
# agent-hub-tmux.sh — Agent Hub Tmux 稳定管理器
# 特性：tmux 管理，重启后自动恢复，进程永不掉
# ============================================================

HUB_DIR="$HOME/.openclaw/workspace/agent-hub"
SESSION="agent-hub"

# ─── 颜色 ───
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} $1"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)]${NC} $1"; }

start() {
    # 检查是否已有会话
    tmux has-session -t $SESSION 2>/dev/null && {
        warn "Agent Hub 已在运行 (tmux session: $SESSION)"
        warn "运行 '$0 attach' 查看控制台"
        return 0
    }

    log "创建 tmux session: $SESSION"
    tmux new-session -d -s $SESSION -n "registry" "cd $HUB_DIR && npx tsx src/registry/server.ts 2>&1 | tee /tmp/agent-hub-logs/registry.log"
    sleep 4

    tmux new-window -t $SESSION -n "hub-ui" "npx http-server $HUB_DIR/dist -p 5173 --host 0.0.0.0 --cache -1 2>&1 | tee /tmp/agent-hub-logs/hub-ui.log"
    sleep 1

    tmux new-window -t $SESSION -n "xiaobao" "cd $HUB_DIR/scripts && node agent-ws-client.cjs --id=xiaobao --name='小宝 (CEO)' --type=openclaw-gateway --platform=wsl --host=127.0.0.1 --port=18790 --agent-ws=ws://127.0.0.1:18790 --ws=ws://127.0.0.1:3210/ws --launch-path='$HUB_DIR/scripts/start-xiaobao.sh' 2>&1 | tee /tmp/agent-hub-logs/ws-xiaobao.log"
    sleep 1

    tmux new-window -t $SESSION -n "opencode-wsl" "cd $HUB_DIR/scripts && node agent-ws-client.cjs --id=opencode-wsl --name='OpenCode (WSL)' --type=opencode --platform=wsl --host=192.168.219.136 --port=4096 --agent-ws=ws://192.168.219.136:4096 --ws=ws://127.0.0.1:3210/ws 2>&1 | tee /tmp/agent-hub-logs/ws-opencode-wsl.log"

    log "等待服务启动..."
    sleep 5
    
    verify
}

stop() {
    tmux has-session -t $SESSION 2>/dev/null || { warn "Agent Hub 未运行"; return 0; }
    warn "停止 Agent Hub..."
    tmux kill-session -t $SESSION
    log "已停止"
}

restart() {
    stop
    sleep 2
    start
}

attach() {
    tmux attach-session -t $SESSION
}

verify() {
    echo ""
    echo "══════════════════════════════════════"
    echo "  验证服务状态"
    echo "══════════════════════════════════════"
    
    local all_ok=true
    
    # 注册中心
    local code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3210/api/stats 2>/dev/null)
    if [ "$code" = "200" ]; then
        log "✅ 注册中心: 200"
    else
        err "❌ 注册中心: $code"
        all_ok=false
    fi
    
    # Hub UI
    code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/ 2>/dev/null)
    if [ "$code" = "200" ]; then
        log "✅ Hub UI: 200"
    else
        err "❌ Hub UI: $code"
        all_ok=false
    fi
    
    # Agent
    local stats=$(curl -s http://127.0.0.1:3210/api/stats 2>/dev/null)
    if [ -n "$stats" ]; then
        local online=$(echo "$stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['online'])" 2>/dev/null)
        local total=$(echo "$stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['total'])" 2>/dev/null)
        log "✅ Agent 舰队: $online/$total 在线"
    else
        err "❌ Agent 统计不可用"
        all_ok=false
    fi
    
    # 持久化
    local proj=$(curl -s http://127.0.0.1:3210/api/projects 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('projects',[])))" 2>/dev/null)
    local msgs=$(curl -s http://127.0.0.1:3210/api/chat-history 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('messages',[])))" 2>/dev/null)
    log "✅ 数据恢复: $proj 项目, $msgs 消息"
    
    # 监测
    local health=$(curl -s http://127.0.0.1:3210/api/monitor 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['averageHealthScore'])" 2>/dev/null)
    log "✅ 监测系统: 健康分 $health"
    
    if $all_ok; then
        echo ""
        log "══════════════════════════════════════"
        log "  Agent Hub 稳定运行！"
        log "  UI:  http://192.168.219.136:5173"
        log "  API: http://192.168.219.136:3210"
        log "══════════════════════════════════════"
    else
        warn "部分服务异常，运行 '$0 status' 查看详情"
    fi
}

status() {
    tmux has-session -t $SESSION 2>/dev/null
    local running=$?
    
    echo "=== Tmux Session ==="
    if [ $running -eq 0 ]; then
        echo "  ✅ $SESSION 运行中"
        tmux list-windows -t $SESSION -F '  Window #{window_index}: #{window_name} (#{window_panes} panes)'
    else
        echo "  ❌ 未运行"
    fi
    
    echo ""
    echo "=== 端口服务 ==="
    for port in 3210 5173; do
        if ss -tlnp | grep -q ":$port "; then
            echo "  ✅ 端口 $port 监听中"
        else
            echo "  ❌ 端口 $port 未监听"
        fi
    done
    
    echo ""
    echo "=== Agent 舰队 ==="
    curl -s http://127.0.0.1:3210/api/stats 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(f'  {d[\"online\"]}/{d[\"total\"]} 在线')
except: print('  ❌')
" 2>/dev/null
    
    echo ""
    echo "=== 持久化文件 ==="
    ls -la $HUB_DIR/data/*.json 2>/dev/null | awk '{print "  " $NF " (" $5 " bytes)"}'
}

case "${1:-start}" in
    start|restart) "$@";;
    stop|attach|verify|status) "$@";;
    *) echo "用法: $0 {start|stop|restart|attach|status|verify}";;
esac
#!/bin/bash
# ============================================================
# agent-hub-stable.sh — Agent Hub 稳定启动脚本
# 特性：
#   - 一键启动所有服务
#   - 进程守护（进程挂了自动重启）
#   - 启动时自动恢复持久化数据
#   - 退出时自动保存数据
# ============================================================

HUB_DIR="$HOME/.openclaw/workspace/agent-hub"
LOG_DIR="/tmp/agent-hub-logs"
PID_DIR="/tmp/agent-hub-pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

# ─── 颜色 ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)]${NC} $1"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)]${NC} $1"; }

# ─── 守护进程启动函数 ───
# 用法: daemonize <name> <pidfile> <logfile> <command...>
daemonize() {
    local name=$1 pidfile=$2 logfile=$3; shift 3
    # 检查是否已在运行
    if [ -f "$pidfile" ]; then
        local old_pid=$(cat "$pidfile")
        if kill -0 "$old_pid" 2>/dev/null; then
            log "$name 已在运行 (PID $old_pid)"
            return 0
        fi
        warn "$name 的旧 PID 文件 ($old_pid) 已失效，重启"
    fi
    
    # 启动并记录 PID
    nohup "$@" > "$logfile" 2>&1 &
    local pid=$!
    echo $pid > "$pidfile"
    log "已启动 $name (PID $pid)"
    
    # 等待 3 秒确认存活
    sleep 3
    if kill -0 $pid 2>/dev/null; then
        log "  ✅ $name 运行正常"
    else
        err "  ❌ $name 启动失败，查看日志: $logfile"
        tail -5 "$logfile"
        return 1
    fi
}

# ─── 启动所有服务 ───
start_all() {
    echo ""
    echo "══════════════════════════════════════"
    echo "  Agent Hub — 稳定启动 v1.0"
    echo "══════════════════════════════════════"
    echo ""

    # 1. 注册中心
    log "启动注册中心..."
    daemonize "registry" "$PID_DIR/registry.pid" "$LOG_DIR/registry.log" \
        npx tsx "$HUB_DIR/src/registry/server.ts"
    if [ $? -ne 0 ]; then
        # 尝试用 node 直接启动（如果有编译版本）
        if [ -f "$HUB_DIR/dist/server.js" ]; then
            daemonize "registry" "$PID_DIR/registry.pid" "$LOG_DIR/registry.log" \
                node "$HUB_DIR/dist/server.js"
        fi
    fi
    sleep 2

    # 2. Hub UI — 用 node http-server（比 python 稳定）
    log "启动 Hub UI..."
    daemonize "hub-ui" "$PID_DIR/hub-ui.pid" "$LOG_DIR/hub-ui.log" \
        npx http-server "$HUB_DIR/dist" -p 5173 --host 0.0.0.0 --cache -1
    if [ $? -ne 0 ]; then
        # 降级到 python
        daemonize "hub-ui" "$PID_DIR/hub-ui.pid" "$LOG_DIR/hub-ui.log" \
            python3 -m http.server 5173 --bind 0.0.0.0 -d "$HUB_DIR/dist"
    fi
    sleep 1

    # 3. 小宝 WS 客户端
    log "启动小宝 (CEO)..."
    daemonize "xiaobao" "$PID_DIR/xiaobao.pid" "$LOG_DIR/ws-xiaobao.log" \
        node "$HUB_DIR/scripts/agent-ws-client.cjs" \
        --id=xiaobao --name="小宝 (CEO)" --type=openclaw-gateway --platform=wsl \
        --host=127.0.0.1 --port=18790 --agent-ws=ws://127.0.0.1:18790 \
        --ws=ws://127.0.0.1:3210/ws \
        --launch-path="$HUB_DIR/scripts/start-xiaobao.sh"
    sleep 1

    # 4. OpenCode WSL WS 客户端
    log "启动 OpenCode (WSL)..."
    daemonize "opencode-wsl" "$PID_DIR/opencode-wsl.pid" "$LOG_DIR/ws-opencode-wsl.log" \
        node "$HUB_DIR/scripts/agent-ws-client.cjs" \
        --id=opencode-wsl --name="OpenCode (WSL)" --type=opencode --platform=wsl \
        --host=192.168.219.136 --port=4096 --agent-ws=ws://192.168.219.136:4096 \
        --ws=ws://127.0.0.1:3210/ws

    echo ""
    echo "══════════════════════════════════════"
    echo "  验证服务状态..."
    echo "══════════════════════════════════════"
    sleep 2
    
    # 验证
    echo ""
    curl -s http://127.0.0.1:3210/api/stats 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(f'  Agent: {d[\"online\"]}/{d[\"total\"]} 在线')
except:
    print('  注册中心: ❌')
" 2>/dev/null
    
    curl -s -o /dev/null -w '  Hub UI: HTTP %{http_code}\n' http://127.0.0.1:5173/ 2>/dev/null || echo "  Hub UI: ❌"
    
    # 验证持久化数据恢复
    echo ""
    curl -s http://127.0.0.1:3210/api/projects 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(f'  项目恢复: {len(d.get(\"projects\",[]))} 个')
except: pass
"
    curl -s http://127.0.0.1:3210/api/chat-history 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(f'  消息恢复: {len(d.get(\"messages\",[]))} 条')
except: pass
"
    echo ""
    echo "══════════════════════════════════════"
    echo "  Agent Hub 已稳定运行！"
    echo "  访问: http://192.168.219.136:5173"
    echo "══════════════════════════════════════"
}

# ─── 停止所有服务 ───
stop_all() {
    echo "停止所有服务..."
    for pidfile in "$PID_DIR"/*.pid; do
        [ -f "$pidfile" ] || continue
        local name=$(basename "$pidfile" .pid)
        local pid=$(cat "$pidfile")
        kill $pid 2>/dev/null && log "已停止 $name" || warn "$name 未运行"
        rm -f "$pidfile"
    done
    # 也杀一下残留进程
    pkill -f "agent-ws-client" 2>/dev/null
    pkill -f "http-server.*5173" 2>/dev/null
    pkill -f "http.server.*5173" 2>/dev/null
    warn "所有服务已停止"
}

# ─── 进程看门狗（后台运行，每30秒检查一次） ───
watchdog() {
    while true; do
        sleep 30
        # 检查注册中心
        if [ -f "$PID_DIR/registry.pid" ]; then
            pid=$(cat "$PID_DIR/registry.pid")
            kill -0 $pid 2>/dev/null || {
                warn "⚠️ 注册中心挂了，重启..."
                rm -f "$PID_DIR/registry.pid"
                daemonize "registry" "$PID_DIR/registry.pid" "$LOG_DIR/registry.log" \
                    npx tsx "$HUB_DIR/src/registry/server.ts"
            }
        fi
        # 检查 Hub UI
        if [ -f "$PID_DIR/hub-ui.pid" ]; then
            pid=$(cat "$PID_DIR/hub-ui.pid")
            kill -0 $pid 2>/dev/null || {
                warn "⚠️ Hub UI 挂了，重启..."
                rm -f "$PID_DIR/hub-ui.pid"
                daemonize "hub-ui" "$PID_DIR/hub-ui.pid" "$LOG_DIR/hub-ui.log" \
                    npx http-server "$HUB_DIR/dist" -p 5173 --host 0.0.0.0 --cache -1
            }
        fi
        # 检查 WS 客户端
        for name in xiaobao opencode-wsl; do
            if [ -f "$PID_DIR/$name.pid" ]; then
                pid=$(cat "$PID_DIR/$name.pid")
                kill -0 $pid 2>/dev/null || {
                    warn "⚠️ $name 挂了，重启..."
                    rm -f "$PID_DIR/$name.pid"
                    case $name in
                        xiaobao)
                            daemonize "$name" "$PID_DIR/$name.pid" "$LOG_DIR/ws-$name.log" \
                                node "$HUB_DIR/scripts/agent-ws-client.cjs" \
                                --id=xiaobao --name="小宝 (CEO)" --type=openclaw-gateway --platform=wsl \
                                --host=127.0.0.1 --port=18790 --agent-ws=ws://127.0.0.1:18790 \
                                --ws=ws://127.0.0.1:3210/ws \
                                --launch-path="$HUB_DIR/scripts/start-xiaobao.sh"
                            ;;
                        opencode-wsl)
                            daemonize "$name" "$PID_DIR/$name.pid" "$LOG_DIR/ws-$name.log" \
                                node "$HUB_DIR/scripts/agent-ws-client.cjs" \
                                --id=opencode-wsl --name="OpenCode (WSL)" --type=opencode --platform=wsl \
                                --host=192.168.219.136 --port=4096 --agent-ws=ws://192.168.219.136:4096 \
                                --ws=ws://127.0.0.1:3210/ws
                            ;;
                    esac
                }
            fi
        done
    done
}

# ─── 主入口 ───
case "${1:-start}" in
    start)
        # 先停旧的
        stop_all 2>/dev/null
        sleep 1
        start_all
        # 启动看门狗（后台）
        watchdog &
        echo $! > "$PID_DIR/watchdog.pid"
        log "进程看门狗已启动"
        ;;
    stop)
        stop_all
        kill $(cat "$PID_DIR/watchdog.pid" 2>/dev/null) 2>/dev/null
        rm -f "$PID_DIR/watchdog.pid"
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    status)
        echo "=== 服务状态 ==="
        for pidfile in "$PID_DIR"/*.pid; do
            [ -f "$pidfile" ] || continue
            local name=$(basename "$pidfile" .pid)
            local pid=$(cat "$pidfile")
            if kill -0 $pid 2>/dev/null; then
                echo "  ✅ $name (PID $pid)"
            else
                echo "  ❌ $name (PID $pid 已失效)"
            fi
        done
        echo ""
        curl -s http://127.0.0.1:3210/api/stats 2>/dev/null | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(f'Agent 舰队: {d[\"online\"]}/{d[\"total\"]} 在线')
except: print('注册中心: ❌')
" 2>/dev/null
        curl -s -o /dev/null -w 'Hub UI: %{http_code}\n' http://127.0.0.1:5173/ 2>/dev/null || echo "Hub UI: ❌"
        ;;
    *)
        echo "用法: $0 {start|stop|restart|status}"
        ;;
esac
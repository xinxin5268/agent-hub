#!/bin/bash
# ============================================================
# start-all.sh — 一键启动 Agent Hub 工作室
# 启动: 注册中心 + 静态服务器 + 注册所有 Agent
# ============================================================

set -e

HUB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY_PORT=3210
HUB_PORT=5173

echo "══════════════════════════════════════"
echo "  🏢 Agent Hub Studio — 一键启动"
echo "══════════════════════════════════════"
echo ""

# 1. 构建最新版本
echo "🔨 Building Agent Hub..."
cd "$HUB_DIR"
npx vite build 2>&1 | tail -3

# 2. 启动注册中心
echo ""
echo "📡 Starting Registry daemon on :${REGISTRY_PORT}..."
if curl -s -o /dev/null http://127.0.0.1:$REGISTRY_PORT/api/stats 2>/dev/null; then
  echo "  ✅ Registry already running"
else
  nohup npx tsx src/registry/server.ts > /tmp/agent-hub-registry.log 2>&1 &
  echo "  PID: $!"
  sleep 2
fi

# 3. 启动静态服务器
echo ""
echo "🌐 Starting Agent Hub on :${HUB_PORT}..."
if curl -s -o /dev/null http://127.0.0.1:$HUB_PORT/ 2>/dev/null; then
  echo "  ✅ Server already running"
else
  cd "$HUB_DIR/dist"
  nohup python3 -m http.server $HUB_PORT --bind 0.0.0.0 > /tmp/agent-hub-static.log 2>&1 &
  echo "  PID: $!"
  sleep 1
fi

# 4. 注册所有 Agent
echo ""
echo "🔌 Registering all agents..."
REGISTRY="http://127.0.0.1:$REGISTRY_PORT"

register() {
  local result=$(curl -s -X POST "$REGISTRY/api/register" \
    -H "Content-Type: application/json" -d "$1" 2>/dev/null)
  echo "$result" | python3 -c "import json,sys;d=json.load(sys.stdin);print('  ✅' if d.get('ok') else '  ❌')" 2>/dev/null
}

NOW=$(date +%s%3N)

echo "  🤖 小宝 (CEO) — :18790"
register '{"action":"register","agent":{"id":"xiaobao","name":"小宝 (CEO)","type":"openclaw-gateway","platform":"wsl","host":"127.0.0.1","port":18790,"wsUrl":"ws://127.0.0.1:18790","httpUrl":"http://127.0.0.1:18790","status":"online","version":"2026.5.28","tags":{"role":"ceo","model":"deepseek-v4-flash"},"lastHeartbeat":'$NOW',"registeredAt":'$NOW'}}'

echo "  🖥️ 小聪 — :18800 (Windows)"
register '{"action":"register","agent":{"id":"xiaocong","name":"小聪","type":"openclaw-gateway","platform":"windows","host":"192.168.208.1","port":18800,"wsUrl":"ws://192.168.208.1:18800","httpUrl":"http://192.168.208.1:18800","status":"online","tags":{"role":"worker"},"lastHeartbeat":'$NOW',"registeredAt":'$NOW'}}'

echo "  🧠 Hermes — :8642"
register '{"action":"register","agent":{"id":"hermes","name":"Hermes","type":"openclaw-gateway","platform":"wsl","host":"127.0.0.1","port":8642,"wsUrl":"ws://127.0.0.1:8642","httpUrl":"http://127.0.0.1:8642","status":"online","models":["Qwen A3 (本地)"],"version":"hermes-agent","tags":{"role":"coordinator"},"lastHeartbeat":'$NOW',"registeredAt":'$NOW'}}'

WSL_IP=$(ip route | grep default | awk '{print $3}')

echo "  🔧 OpenCode (WSL) — mimo-v2.5-free"
register '{"action":"register","agent":{"id":"opencode-wsl","name":"OpenCode (WSL)","type":"opencode","platform":"wsl","host":"'$WSL_IP'","port":3000,"wsUrl":"ws://'$WSL_IP':3000","status":"online","models":["mimo-v2.5-free","deepseek-v4-flash-free"],"cwd":"/home/chenxin520/.openclaw/workspace","version":"1.15.13","tags":{"role":"coder"},"lastHeartbeat":'$NOW',"registeredAt":'$NOW'}}'

echo "  🪟 OpenCode (Windows) — mimo-v2.5-free"
register '{"action":"register","agent":{"id":"opencode-win","name":"OpenCode (Windows)","type":"opencode","platform":"windows","host":"192.168.208.1","port":3000,"wsUrl":"ws://192.168.208.1:3000","status":"online","models":["mimo-v2.5-free"],"version":"1.15.0","tags":{"role":"coder"},"lastHeartbeat":'$NOW',"registeredAt":'$NOW'}}'

echo ""
echo "══════════════════════════════════════"
echo "  ✅ Agent Hub Studio 已启动！"
echo "══════════════════════════════════════"
echo ""
echo "  🏢 Agent Hub:  http://127.0.0.1:${HUB_PORT}/"
echo "  📡 Registry:    http://127.0.0.1:${REGISTRY_PORT}"
echo "  📋 Control UI:  http://127.0.0.1:18790/openclaw/"
echo ""

# 显示当前 Agent 列表
curl -s "$REGISTRY/api/agents" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('  📊 已注册 Agent:')
for a in d.get('agents',[]):
    role = a.get('tags',{}).get('role','')
    pi = {'windows':'🪟','wsl':'🐧','linux':'🐧'}.get(a.get('platform',''),'💻')
    si = {'online':'🟢','busy':'🟡','offline':'🔴'}.get(a.get('status',''),'⚪')
    print(f'    {si} {pi} {a[\"name\"]}  ({a[\"type\"]})  {role}')
print(f'    共 {d[\"stats\"][\"total\"]} 个 Agent')
"

echo ""
echo "  提示: 关掉终端也不会停，需要停止时运行:"
echo "    kill \$(lsof -ti:${HUB_PORT}) \$(lsof -ti:${REGISTRY_PORT})"
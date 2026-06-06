#!/bin/bash
# ============================================================
# register-all.sh — 注册所有 Agent 到注册中心
# 包括：小宝 (OpenClaw GW)、Hermes、本机 opencode
# ============================================================

set -e

REGISTRY_URL="${REGISTRY_URL:-http://127.0.0.1:3210}"

echo "📋 Agent Hub — 全量 Agent 注册"
echo "═══════════════════════════════════"
echo "  Registry: $REGISTRY_URL"
echo ""

# 检查注册中心是否在运行
if ! curl -s "$REGISTRY_URL/api/stats" > /dev/null 2>&1; then
  echo "❌ 注册中心未运行！请先启动: npx tsx src/registry/server.ts"
  exit 1
fi

# ──────────────────────────────────────────
# 1. 注册小宝（OpenClaw Gateway :18790）
# ──────────────────────────────────────────
echo "🤖 注册小宝 (OpenClaw Gateway :18790)..."
curl -s -X POST "$REGISTRY_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register",
    "agent": {
      "id": "xiaobao",
      "name": "小宝 (CEO)",
      "type": "openclaw-gateway",
      "platform": "wsl",
      "host": "127.0.0.1",
      "port": 18790,
      "wsUrl": "ws://127.0.0.1:18790",
      "httpUrl": "http://127.0.0.1:18790",
      "status": "online",
      "version": "2026.5.28",
      "tags": {"role": "ceo", "model": "deepseek-v4-flash"},
      "lastHeartbeat": '$(date +%s%3N)',
      "registeredAt": '$(date +%s%3N)'
    }
  }' 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('  ✅' if d.get('ok') else '  ❌', d)"

# ──────────────────────────────────────────
# 2. 注册 Hermes（Hermes Gateway :8642）
# ──────────────────────────────────────────
echo "🧠 注册 Hermes (Hermes API :8642)..."
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8642/health 2>/dev/null | grep -q 200; then
  curl -s -X POST "$REGISTRY_URL/api/register" \
    -H "Content-Type: application/json" \
    -d '{
      "action": "register",
      "agent": {
        "id": "hermes",
        "name": "Hermes",
        "type": "openclaw-gateway",
        "platform": "wsl",
        "host": "127.0.0.1",
        "port": 8642,
        "wsUrl": "ws://127.0.0.1:8642",
        "httpUrl": "http://127.0.0.1:8642",
        "status": "online",
        "models": ["Qwen A3 (本地)"],
        "version": "hermes-agent",
        "tags": {"role": "coordinator", "provider": "local"},
        "lastHeartbeat": '$(date +%s%3N)',
        "registeredAt": '$(date +%s%3N)'
      }
    }' 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('  ✅' if d.get('ok') else '  ❌', d)"
else
  echo "  ⚠️  Hermes 未运行，跳过"
fi

# ──────────────────────────────────────────
# 3. 注册本机 opencode（如果有）
# ──────────────────────────────────────────
if command -v opencode &> /dev/null; then
  echo "🔧 注册本机 OpenCode..."
  OPENCODE_VERSION=$(opencode --version 2>/dev/null || echo "unknown")
  curl -s -X POST "$REGISTRY_URL/api/register" \
    -H "Content-Type: application/json" \
    -d '{
      "action": "register",
      "agent": {
        "id": "opencode-wsl",
        "name": "OpenCode (WSL)",
        "type": "opencode",
        "platform": "wsl",
        "host": "'$(hostname -I | awk '{print $1}')'",
        "port": 0,
        "wsUrl": "ws://'$(ip route | grep default | awk '{print $3}')':3000",
        "status": "online",
        "models": ["mimo-v2.5-free", "deepseek-v4-flash-free"],
        "cwd": "'$PWD'",
        "version": "'$OPENCODE_VERSION'",
        "tags": {"role": "coder"},
        "lastHeartbeat": '$(date +%s%3N)',
        "registeredAt": '$(date +%s%3N)'
      }
    }' 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('  ✅' if d.get('ok') else '  ❌', d)"
else
  echo "  ⚠️  本机 opencode 未安装，跳过"
fi

echo ""
echo "═══════════════════════════════════"
echo "📊 注册完成！当前 Agent 列表:"
curl -s "$REGISTRY_URL/api/agents" 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
for a in d.get('agents', []):
    icon = {'windows': '🪟', 'wsl': '🐧', 'linux': '🐧'}.get(a.get('platform',''), '💻')
    status_icon = {'online': '🟢', 'busy': '🟡', 'offline': '🔴'}.get(a.get('status',''), '⚪')
    print(f\"  {status_icon} {icon} {a['name']} ({a['type']}) — {a['host']}:{a['port']}\")
print()
print(f\"  共 {d['stats']['total']} 个 Agent，{d['stats']['online']} 在线\")
"
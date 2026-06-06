#!/bin/bash
# ============================================================
# start-studio.sh — 一键启动工作室
# 1. 启动注册中心 (Registry daemon)
# 2. 自动注册本机 opencode
# 3. 启动 Agent Hub 开发服务器
# ============================================================

set -e

HUB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY_PORT="${REGISTRY_PORT:-3210}"
HUB_PORT="${HUB_PORT:-5173}"

echo "🚀 Agent Hub Studio — 一键启动"
echo "═══════════════════════════════════"
echo ""

# 1. 启动注册中心
echo "📡 Starting Registry daemon on :${REGISTRY_PORT}..."
npx tsx "$HUB_DIR/src/registry/server.ts" &
REGISTRY_PID=$!
echo "  PID: $REGISTRY_PID"
sleep 2

# 2. 注册本机 opencode（如果存在）
if command -v opencode &> /dev/null; then
  echo ""
  echo "🔌 Registering local opencode..."
  bash "$HUB_DIR/scripts/register-agent.sh" serve 3000 "$HUB_DIR"
  echo "  opencode serve started with mDNS"
else
  echo ""
  echo "⚠️  opencode not found, skipping local registration"
fi

# 3. 启动 Agent Hub 开发服务器
echo ""
echo "🌐 Starting Agent Hub on :${HUB_PORT}..."
cd "$HUB_DIR"
npx vite --port "$HUB_PORT" --host 127.0.0.1 &
VITE_PID=$!
echo "  PID: $VITE_PID"

echo ""
echo "═══════════════════════════════════"
echo "✅ Studio is running!"
echo "  Registry:  http://127.0.0.1:${REGISTRY_PORT}"
echo "  Agent Hub: http://127.0.0.1:${HUB_PORT}"
echo "  ControlUI: http://127.0.0.1:18790/openclaw/agent-hub/"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "═══════════════════════════════════"

# Trap Ctrl+C to clean up
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $VITE_PID 2>/dev/null
  kill $REGISTRY_PID 2>/dev/null
  echo "Done."
  exit 0
}
trap cleanup SIGINT SIGTERM

# Wait for any to exit
wait
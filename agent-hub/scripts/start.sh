#!/bin/bash
# ============================================================
# Agent Hub — 启动脚本
# 启动 Agent Hub 开发服务器，对接 Gateway
# ============================================================

set -e

HUB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
GATEWAY_URL="${GATEWAY_URL:-ws://127.0.0.1:18790}"
PORT="${PORT:-5173}"

echo "🚀 Agent Hub — 多 Agent 可视化工作台"
echo "═══════════════════════════════════════"
echo "  Gateway:    $GATEWAY_URL"
echo "  Port:       $PORT"
echo "  Access:     http://127.0.0.1:$PORT"
echo "  Ctrl UI:    http://127.0.0.1:18790/openclaw/agent-hub/"
echo ""

cd "$HUB_DIR"

# Start vite dev server
exec npx vite --port "$PORT" --host 127.0.0.1
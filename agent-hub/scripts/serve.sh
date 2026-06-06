#!/bin/bash
# ============================================================
# serve.sh — 以独立静态服务器启动 Agent Hub
# 用 python http.server 在 :5173 提供服务
# 不受 Gateway SPA fallback 影响
# ============================================================

set -e

HUB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-5173}"

# 先构建最新版本
echo "🔨 Building Agent Hub..."
cd "$HUB_DIR"
npx vite build

echo ""
echo "🚀 Starting static server on :${PORT}..."
echo "   Access: http://localhost:${PORT}/"
echo "   (Or click 🚀 Agent Hub in Control UI)"
echo ""

# 用 python http.server 服务 dist 目录
exec python3 -m http.server "$PORT" --bind localhost -d "$HUB_DIR/dist"
#!/bin/bash
# ============================================================
# deploy.sh — 构建并部署 Agent Hub 到 Control UI
# ============================================================

set -e

HUB_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTROL_UI_DIR="$HOME/.nvm/versions/node/v22.22.2/lib/node_modules/openclaw/dist/control-ui"

echo "🔨 Building Agent Hub..."
cd "$HUB_DIR"
npx vite build

echo "📦 Deploying to Control UI..."
JS_FILE=$(ls dist/assets/index-*.js)
CSS_FILE=$(ls dist/assets/index-*.css)

cp "$JS_FILE" "$CONTROL_UI_DIR/assets/agent-hub.js"
cp "$CSS_FILE" "$CONTROL_UI_DIR/assets/agent-hub.css"

# 部署 HTML（修正资源路径和文件名，指向 control-ui 公共 assets）
cat dist/index.html | sed \
  -e 's|src="/openclaw/agent-hub/assets/index-[^"]*\.js"|src="../assets/agent-hub.js"|g' \
  -e 's|href="/openclaw/agent-hub/assets/index-[^"]*\.css"|href="../assets/agent-hub.css"|g' \
  -e 's|src="/openclaw/agent-hub/assets/|src="../assets/|g' \
  -e 's|href="/openclaw/agent-hub/assets/|href="../assets/|g' \
  > "$CONTROL_UI_DIR/agent-hub/index.html"

echo "✅ Deployed!"
echo ""
echo "   Access: http://127.0.0.1:18790/openclaw/agent-hub/"
echo "   Or click 🚀 Agent Hub button at bottom of Control UI"

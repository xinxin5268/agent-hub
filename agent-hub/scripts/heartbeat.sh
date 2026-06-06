#!/bin/bash
# ============================================================
# heartbeat.sh — Agent 心跳保活
# 每 60 秒向注册中心发送心跳，保持 Agent 在线状态
# ============================================================

REGISTRY_URL="${REGISTRY_URL:-http://127.0.0.1:3210}"
AGENT_IDS="${AGENT_IDS:-xiaobao xiaocong hermes opencode-wsl opencode-win}"

echo "💓 Agent Heartbeat Keepalive"
echo "  Registry: $REGISTRY_URL"
echo "  Agents: $AGENT_IDS"
echo "  Interval: 60s"
echo ""

while true; do
  for id in $AGENT_IDS; do
    curl -s -X POST "$REGISTRY_URL/api/heartbeat" \
      -H "Content-Type: application/json" \
      -d "{\"agentId\":\"$id\"}" > /dev/null 2>&1
  done
  sleep 60
done
#!/bin/bash
# agent-heartbeat.sh — 向 Agent Hub 发送心跳维持在线
source /etc/agent-hub.env

HUB_URL="http://127.0.0.1:$REGISTRY_PORT"

# 刷新 xiaocong-win（我）
curl -s -X POST "$HUB_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register",
    "agent": {
      "id": "xiaocong-win",
      "name": "小聪",
      "type": "openclaw-gateway",
      "platform": "windows",
      "host": "'$WINDOWS_IP'",
      "port": 18800,
      "wsUrl": "ws://'$WINDOWS_IP':18800",
      "httpUrl": "http://'$WINDOWS_IP':18800",
      "status": "online",
      "version": "2026.6.1",
      "skills": ["personal-assistant","coding","memory","taskflow","file-transfer"],
      "tags": {"role":"assistant","owner":"chenxin"},
      "lastHeartbeat": '$(date +%s%3N)'
    }
  }' -o /dev/null -w "%{http_code}" | grep -q 200 && echo "xiaocong-win: OK" || echo "xiaocong-win: FAIL"

# 刷新 opencode-win
curl -s -X POST "$HUB_URL/api/register" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register",
    "agent": {
      "id": "opencode-win",
      "name": "OpenCode",
      "type": "opencode",
      "platform": "windows",
      "host": "'$WINDOWS_IP'",
      "port": 18800,
      "wsUrl": "ws://'$WINDOWS_IP':3000",
      "httpUrl": "http://'$WINDOWS_IP':3000",
      "status": "online",
      "lastHeartbeat": '$(date +%s%3N)'
    }
  }' -o /dev/null -w "%{http_code}" | grep -q 200 && echo "opencode-win: OK" || echo "opencode-win: FAIL"

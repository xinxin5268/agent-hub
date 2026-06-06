#!/bin/bash
# 定时自动技能同步 — 每 15 分钟执行一次
# 把 Agent Hub 的 Agent 技能同步到共享 skill 管理器
cd "$(dirname "$0")/.." || exit 1

AGENTS=$(curl -sf http://127.0.0.1:3210/api/agents | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('agents',[])))" 2>/dev/null || echo '[]')

if [ "$AGENTS" != "[]" ]; then
    python3 scripts/sync-agent-skills.py "$AGENTS" >> /tmp/sync-agent-skills.log 2>&1
    echo "[$(date)] sync OK" >> /tmp/sync-agent-skills.log
else
    echo "[$(date)] daemon not reachable" >> /tmp/sync-agent-skills.log
fi

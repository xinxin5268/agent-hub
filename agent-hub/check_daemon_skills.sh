#!/bin/bash
cd /home/chenxin520/.openclaw/workspace/agent-hub
npx tsx src/registry/server.ts > /tmp/reg4.log 2>&1 &
sleep 3
echo "=== Skills call ==="
curl -s http://127.0.0.1:3210/api/skills 2>&1 | head -200
echo ""
echo "=== Log ==="
cat /tmp/reg4.log
kill %1 2>/dev/null

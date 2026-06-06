#!/bin/bash
cd /home/chenxin520/.openclaw/workspace/agent-hub

npx tsx src/registry/server.ts > /tmp/reg3.log 2>&1 &
sleep 3

echo "=== Skills API ==="
SKILLS=$(curl -s http://127.0.0.1:3210/api/skills)
echo "$SKILLS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK=' + str(d.get('ok')) + ', total=' + str(len(d.get('skills',[]))))"

echo "=== Stats ==="
curl -s http://127.0.0.1:3210/api/stats
echo ""

kill %1 2>/dev/null
echo "=== Done ==="

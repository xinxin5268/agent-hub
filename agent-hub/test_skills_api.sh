cd /home/chenxin520/.openclaw/workspace/agent-hub
echo "=== Starting daemon ==="
npx tsx src/registry/daemon.ts &
DAEMON_PID=$!
sleep 3
echo "=== Daemon PID: $DAEMON_PID ==="
echo "=== Test /api/skills ==="
curl -s http://localhost:3210/api/skills | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'ok={data.get(\"ok\")}, total_skills={len(data.get(\"skills\", []))}')
if data.get('ok'):
    cats = data.get('categories', {})
    print(f'categories={list(cats.keys())}')
" 2>&1
echo "=== Test /api/skills/stats ==="
curl -s http://localhost:3210/api/skills/stats 2>&1
echo ""
echo "=== Done ==="
kill $DAEMON_PID 2>/dev/null

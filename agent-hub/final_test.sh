cd /home/chenxin520/.openclaw/workspace/agent-hub

pkill -f "tsx src/registry/server" 2>/dev/null
sleep 1

npx tsx src/registry/server.ts > /tmp/daemon-test.log 2>&1 &
DAEMON_PID=$!
sleep 3

echo "Daemon PID: $DAEMON_PID"
if kill -0 $DAEMON_PID 2>/dev/null; then
  echo "DAEMON RUNNING"
else
  echo "DAEMON DIED"
  cat /tmp/daemon-test.log
  exit 1
fi

echo ""
echo "=== API /api/skills ==="
curl -s http://localhost:3210/api/skills | python3 -c "
import sys, json
data = json.load(sys.stdin)
if data.get('ok'):
    skills = data.get('skills', [])
    cats = data.get('categories', {})
    print(f'OK: {len(skills)} skills, {len(cats)} categories')
else:
    print(f'ERROR: {json.dumps(data, ensure_ascii=False)[:300]}')
"

echo ""
echo "=== API /api/skills/stats ==="
curl -s http://localhost:3210/api/skills/stats
echo ""

kill $DAEMON_PID 2>/dev/null
echo "DONE"

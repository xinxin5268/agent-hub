cd /home/chenxin520/.openclaw/workspace/agent-hub

# Kill any old daemon
pkill -f "tsx.*registry/server" 2>/dev/null
sleep 1

# Start daemon in background
nohup npx tsx src/registry/server.ts > /tmp/daemon-test.log 2>&1 &
D=$!
echo "Daemon PID: $D"
sleep 3

# Check alive
if kill -0 $D 2>/dev/null; then
  echo "Daemon is UP"
else
  echo "Daemon DIED"
  cat /tmp/daemon-test.log
  exit 1
fi

# Register agents
echo "--- Registering ---"
bash scripts/register-all.sh

echo ""
echo "--- Current agents ---"
curl -s http://localhost:3210/api/agents | python3 -c "
import sys, json
d = json.load(sys.stdin)
for a in d.get('agents', []):
    print(f'  {a[\"name\"]}  ws={a.get(\"wsUrl\",\"?\")}  http={a.get(\"httpUrl\",\"?\")}')
print(f'Total: {len(d[\"agents\"])}')
"

# Test command
echo ""
echo "--- Sending command to xiaobao ---"
curl -s -X POST http://localhost:3210/api/command \
  -H "Content-Type: application/json" \
  -d '{"agentId":"xiaobao","command":"status","id":"cmd-001"}'
echo ""

echo ""
echo "SHELL DONE - daemon still running in background"

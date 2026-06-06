cd /home/chenxin520/.openclaw/workspace/agent-hub

# Kill old daemon if any
pkill -f "tsx src/registry/server" 2>/dev/null
sleep 1

# Start daemon
npx tsx src/registry/server.ts > /tmp/daemon-reload.log 2>&1 &
sleep 2

# Check daemon is up
echo "=== Registry status ==="
curl -s http://localhost:3210/api/stats
echo ""

# Register all agents
echo ""
echo "=== Registering agents ==="
bash scripts/register-all.sh

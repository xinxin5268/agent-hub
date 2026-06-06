cd /home/chenxin520/.openclaw/workspace/agent-hub
echo "=== Starting daemon with log ==="
npx tsx src/registry/daemon.ts > /tmp/daemon-out.log 2>&1 &
DAEMON_PID=$!
sleep 4
echo "=== Daemon PID: $DAEMON_PID ==="
echo "=== Checking process ==="
ps aux | grep daemon | grep -v grep
echo "=== Daemon logs ==="
cat /tmp/daemon-out.log
echo "=== Curl test ==="
curl -v http://localhost:3210/api/skills 2>&1
echo ""
echo "=== Cleanup ==="
kill $DAEMON_PID 2>/dev/null

cd /home/chenxin520/.openclaw/workspace/agent-hub

echo "=== Step 1: Check if xiaobao gateway is reachable ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://127.0.0.1:18790/openclaw/ 2>&1
echo ""
curl -s http://127.0.0.1:18790/openclaw/ 2>&1 | head -5
echo ""

echo "=== Step 2: Check xiaobao registration ==="
curl -s http://localhost:3210/api/agents/xiaobao 2>&1
echo ""

echo "=== Step 3: Send command to xiaobao ==="
curl -s -X POST http://localhost:3210/api/command \
  -H "Content-Type: application/json" \
  -d '{"agentId":"xiaobao","command":"status","id":"cmd-001"}' 2>&1
echo ""

echo "=== Step 4: Try raw connection to xiaobao WS ==="
timeout 3 curl -s http://127.0.0.1:18790/api/status 2>&1 || echo "(timeout or refused)"

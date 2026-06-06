BASE="http://127.0.0.1:18790"
echo "=== /version ==="
curl -s "$BASE/version" 2>&1
echo ""
echo "=== /info ==="
curl -s "$BASE/info" 2>&1
echo ""
echo "=== POST /openclaw/api/command ==="
curl -s -X POST "$BASE/openclaw/api/command" -H "Content-Type: application/json" -d '{"command":"status"}' 2>&1
echo ""
echo "=== POST /openclaw/api/command with id ==="
curl -s -X POST "$BASE/openclaw/api/command" -H "Content-Type: application/json" -d '{"id":"t1","command":"status","agentId":"xiaobao"}' 2>&1
echo ""
echo "=== GET /acp ==="
curl -s "$BASE/acp" 2>&1 | head -5
echo ""

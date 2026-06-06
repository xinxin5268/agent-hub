cd /home/chenxin520/.openclaw/workspace/agent-hub
BASE="http://127.0.0.1:18790"

echo "=== Probe openclaw ACP endpoints ==="

for path in /api/acp/status /api/acp/health /api/acp /acp/health /acp/status /api/v1/status /api/v1/health; do
  CODE=$(curl -s -o /tmp/acp_resp.txt -w "%{http_code}" "$BASE$path" 2>/dev/null)
  echo "$CODE $path"
  head -1 /tmp/acp_resp.txt 2>/dev/null
done

echo ""
echo "=== POST /api/command ==="
curl -s -X POST "$BASE/api/command" -H "Content-Type: application/json" -d '{"id":"t1","command":"status"}' 2>&1
echo ""

echo ""
echo "=== Check actual openclaw process ==="
ps aux | grep openclaw | grep -v grep | head -3

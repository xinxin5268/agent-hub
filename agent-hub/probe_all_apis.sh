BASE="http://127.0.0.1:18790"
echo "=== Probe openclaw REST API ==="

# Try common ACP/openapi patterns
for path in \
  /api/acp/command \
  /api/acp/messages \
  /api/gateway/command \
  /api/v1/command \
  /api/v1/messages \
  /api/chat \
  /api/converse \
  /api/run \
  /api/tasks \
  /api/commands \
  /acp/command \
  /acp/messages \
  /api/agent/command \
  /api/command \
  /api/action \
  /api/actions \
  /api/rpc \
  /api/invoke \
; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE$path" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null)
  echo "$CODE $path"
done

echo ""
echo "=== Also GET endpoints ==="
for path in \
  /api \
  /api/acp \
  /acp \
  /api/health \
  /api/version \
  /version \
  /api/info \
  /info \
  /openclaw/api/command \
; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path" 2>/dev/null)
  echo "$CODE $path"
done

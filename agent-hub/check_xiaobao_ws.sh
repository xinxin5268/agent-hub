echo "Test if openclaw at 18790 supports WebSocket upgrade..."
{
  echo -e "GET /ws HTTP/1.1\r\nHost: 127.0.0.1:18790\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n"
  sleep 1
} | nc -w 2 127.0.0.1 18790 2>/dev/null
echo ""
echo "---"
echo "Test plain HTTP..."
{
  echo -e "GET / HTTP/1.1\r\nHost: 127.0.0.1:18790\r\nConnection: close\r\n\r\n"
} | nc -w 2 127.0.0.1 18790 2>/dev/null | head -10
echo ""
echo "---"
echo "Check if openclaw has --acp flag..."
openclaw serve --help 2>&1 | grep -i "acp\|acp-port\|acp-addr\|gateway" | head -5
echo "---"
echo "Check openclaw command line for this instance..."
cat /proc/1482/cmdline 2>/dev/null | tr '\0' ' '
echo ""

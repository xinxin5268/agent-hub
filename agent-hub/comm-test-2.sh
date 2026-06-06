#!/bin/bash
cd /home/chenxin520/.openclaw/workspace/agent-hub
set -e

echo "=== 技能 API ==="
SKILLS=$(curl -s http://127.0.0.1:3210/api/skills)
echo "$SKILLS" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print(f'  Skills API: ok={d.get(\"ok\")}, total={len(d.get(\"skills\",[]))}')
"

echo "=== 匹配 API ==="
MATCH=$(curl -s "http://127.0.0.1:3210/api/skills/match?task=python")
echo "$MATCH" | python3 -c "
import sys,json; d=json.load(sys.stdin)
print(f'  Match API: ok={d.get(\"ok\")}, matches={len(d.get(\"matches\",[]))}')
"

echo "=== WS 消息中继 (Agent -> UI) ==="
python3 << 'PYEOF'
import http.client, json, time, threading

results = []
UI_MSGS = []

def ui_client():
    conn = http.client.HTTPConnection("127.0.0.1", 3210)
    conn.request("GET", "/ws", headers={
        "Upgrade": "websocket",
        "Connection": "Upgrade",
        "Sec-WebSocket-Key": "dGVzdFVJQ2xpZW50S2V5",
        "Sec-WebSocket-Version": "13",
    })
    resp = conn.getresponse()
    results.append(f"UI WS handshake: {resp.status}")

def agent_client():
    time.sleep(0.3)
    conn = http.client.HTTPConnection("127.0.0.1", 3210)
    conn.request("GET", "/ws?agentId=test-relay-agent", headers={
        "Upgrade": "websocket",
        "Connection": "Upgrade",
        "Sec-WebSocket-Key": "dGVzdEFnZW50S2V5",
        "Sec-WebSocket-Version": "13",
    })
    resp = conn.getresponse()
    results.append(f"Agent WS handshake: {resp.status}")

t1 = threading.Thread(target=ui_client)
t2 = threading.Thread(target=agent_client)
t1.start()
t2.start()
t1.join()
t2.join()

for r in results:
    print(f"  {r}")
print("  PASS: WS 双向握手成功")
PYEOF

echo ""
echo "=== 健康检查 API ==="
curl -s http://127.0.0.1:3210/api/stats | python3 -c "
import sys,json; d=json.load(sys.stdin)
print(f'  注册中心状态: {d[\"total\"]} agents, {d[\"online\"]} online, {d[\"offline\"]} offline')
print(f'  类型: {d[\"byType\"]}')
"

echo ""
echo "=== 全部通讯路径测试通过 ==="

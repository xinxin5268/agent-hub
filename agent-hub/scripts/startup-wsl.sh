#!/bin/bash
# WSL 启动时自动执行
# 放在 /etc/profile.d/ 或 .bashrc 中调用

WSL_IP=$(ip addr show eth0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)
echo "[startup] WSL IP: $WSL_IP"

# 1. 启动 Agent Hub daemon
if ! ss -tlnp 2>/dev/null | grep -q 3210; then
    echo "[startup] 启动 Agent Hub daemon..."
    cd /home/chenxin520/.openclaw/workspace/agent-hub
    nohup npx tsx src/registry/server.ts > /tmp/agent-hub-logs/registry.log 2>&1 &
    sleep 3
    echo "[startup] daemon 已启动"
fi

# 2. 更新 Windows 端口转发
# 先删除旧规则（如果有），再添加新规则
powershell.exe -Command "netsh interface portproxy delete v4tov4 listenport=3210" 2>/dev/null
powershell.exe -Command "netsh interface portproxy add v4tov4 listenport=3210 listenaddress=0.0.0.0 connectport=3210 connectaddress=$WSL_IP" 2>/dev/null
echo "[startup] 端口转发已更新: 3210 → $WSL_IP:3210"

# 3. 启动 ws-client（小宝 + OpenCode WSL）
if ! ps aux | grep -q "agent-ws-client.*xiaobao"; then
    echo "[startup] 启动小宝 ws-client..."
    nohup node /home/chenxin520/.openclaw/workspace/agent-hub/scripts/agent-ws-client.cjs \
      --id=xiaobao --name="小宝 (CEO)" --type=agent --role=ceo \
      --ws=ws://127.0.0.1:3210/ws --launch-command="" --no-gui \
      > /tmp/agent-hub-logs/ws-xiaobao.log 2>&1 &
fi

if ! ps aux | grep -q "agent-ws-client.*opencode-wsl"; then
    echo "[startup] 启动 OpenCode WSL ws-client..."
    nohup node /home/chenxin520/.openclaw/workspace/agent-hub/scripts/agent-ws-client.cjs \
      --id=opencode-wsl --name="OpenCode (WSL)" --type=opencode \
      --ws=ws://127.0.0.1:3210/ws --launch-command="" --no-gui \
      > /tmp/agent-hub-logs/ws-opencode-wsl.log 2>&1 &
fi

echo "[startup] 完成"

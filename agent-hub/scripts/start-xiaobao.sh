#!/bin/bash
# 小宝启动脚本 — 用于注册中心自动拉起
source ~/.bashrc 2>/dev/null
cd /home/chenxin520/.openclaw/workspace/agent-hub/scripts
nohup node agent-ws-client.cjs \
  --id=xiaobao \
  --name="小宝 (CEO)" \
  --type=openclaw-gateway \
  --platform=wsl \
  --host=127.0.0.1 \
  --port=18790 \
  --agent-ws=ws://127.0.0.1:18790 \
  --ws=ws://127.0.0.1:3210/ws \
  --launch-command="bash /home/chenxin520/.openclaw/workspace/agent-hub/scripts/start-xiaobao.sh" \
  --launch-path="/home/chenxin520/.openclaw/workspace/agent-hub/scripts/start-xiaobao.sh" \
  > /tmp/agent-hub-logs/ws-xiaobao.log 2>&1 &
echo "小宝 WS 已启动 (PID $!)"
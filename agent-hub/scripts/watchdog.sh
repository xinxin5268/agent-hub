#!/bin/bash
# Agent Hub + Toonflow 看门狗 - v2 (systemd compatible)
# cron 版，只处理 systemd 不管的部分：端口转发 + 未知进程保护
LOG="/tmp/watchdog.log"
echo "[$(date '+%H:%M:%S')] 看门狗检查..." >> "$LOG"

WSL_IP=$(ip addr show eth0 2>/dev/null | grep "inet " | awk '{print $2}' | cut -d/ -f1)

# ── 端口转发 (systemd 不管，必须由 cron 做) ──
for PORT in 3210 10588; do
    CURRENT_FWD=$(powershell.exe -Command "netsh interface portproxy show v4tov4" 2>/dev/null | grep " $PORT " | awk '{print $4}')
    if [ "$CURRENT_FWD" != "$WSL_IP" ]; then
        echo "  [转发:$PORT] IP 变化: $CURRENT_FWD → $WSL_IP，更新..." >> "$LOG"
        powershell.exe -Command "netsh interface portproxy delete v4tov4 listenport=$PORT" 2>/dev/null
        powershell.exe -Command "netsh interface portproxy add v4tov4 listenport=$PORT listenaddress=0.0.0.0 connectport=$PORT connectaddress=$WSL_IP" 2>/dev/null
        echo "  [转发:$PORT] 已更新" >> "$LOG"
    fi
done

# ── 千问 A3 ws-client (systemd 不管理) ──
if [ -f /tmp/agent-hub-logs/ws-qianwen-a3.cjs ]; then
    if ! ps aux | grep -q "ws-qianwen-a3"; then
        echo "  [qianwen-a3] ws-client 挂了，重启..." >> "$LOG"
        nohup node /tmp/agent-hub-logs/ws-qianwen-a3.cjs > /tmp/agent-hub-logs/ws-qianwen-a3.log 2>&1 &
        echo "  [qianwen-a3] 已重启" >> "$LOG"
    fi
fi

echo "[$(date '+%H:%M:%S')] 看门狗完成" >> "$LOG"
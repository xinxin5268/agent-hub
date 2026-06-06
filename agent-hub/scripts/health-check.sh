#!/bin/bash
# Agent Hub 健康检查 — 一键验证所有功能
echo "========== Agent Hub 健康检查 =========="
echo ""

# 1. daemon
echo "📊 daemon:"
if ss -tlnp | grep -q 3210; then
    PID=$(ss -tlnp | grep 3210 | grep -oP 'pid=\K[0-9]+')
    ELAPSED=$(ps -o etime= -p "$PID" 2>/dev/null | xargs)
    echo "  ✅ 运行中 (PID $PID, 已运行 $ELAPSED)"
else
    echo "  ❌ 未运行"
fi
echo ""

# 2. tmux
echo "📊 tmux 窗口:"
tmux list-windows -t agent-hub 2>/dev/null | awk '{print "  "$0}' || echo "  ❌ agent-hub session 不存在"
echo ""

# 3. Agent
echo "📊 Agent:"
curl -sf http://127.0.0.1:3210/api/agents | python3 -c "
import json,sys
d=json.load(sys.stdin)
for a in d['agents']:
    if a['status']=='online':
        s=','.join(a.get('skills',[]) or ['❌'])
        print(f'  🟢 {a[\"name\"]:15s} skills=[{s}]')
print(f'  --- {d[\"stats\"][\"online\"]}/{d[\"stats\"][\"total\"]} online')
" 2>/dev/null || echo "  ❌ API 不可达"
echo ""

# 4. Projects
echo "📊 项目:"
curl -sf http://127.0.0.1:3210/api/projects | python3 -c "
import json,sys
d=json.load(sys.stdin)
for p in d.get('projects',[]):
    print(f'  📁 {p[\"name\"]:30s} [{p[\"status\"]:12s}] agents={p.get(\"assignedAgents\",[])}')
" 2>/dev/null
echo ""

# 5. 知识库
echo "📊 知识库:"
curl -sf http://127.0.0.1:3210/api/knowledge | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'  {len(d.get(\"entries\",[]))} entries')
" 2>/dev/null
echo ""

# 6. Monitor
echo "📊 监测:"
curl -sf http://127.0.0.1:3210/api/monitor/summary | python3 -c "
import json,sys
d=json.load(sys.stdin)
print(f'  健康分: {d.get(\"averageHealthScore\",\"?\")}')
print(f'  告警: {d.get(\"unresolvedAlerts\",0)} unresolved')
" 2>/dev/null
echo ""

# 7. 共享 skill 管理器
echo "📊 共享 skill 管理器:"
python3 -c "
import json
with open('$HOME/.openclaw/workspace/workbench/_catalog/registry.json') as f:
    d=json.load(f)
print(f'  {d[\"total_skills\"]} skills total')
for r in ['ceo-agent','coding-agent','code-review-agent','debugging-agent','assistant-agent','gateway-agent','awesome-llm-apps']:
    if r in d['skills']:
        s=d['skills'][r]
        a=s.get('last_agent','?')
        print(f'  ✅ {r:25s} ({s[\"tier\"]:7s}/{s[\"category\"]:10s}) agent={a}')
    else:
        print(f'  ❌ {r}')
" 2>/dev/null
echo ""

# 8. Cron 日志
echo "📊 定时任务:"
echo "  同步技能: $(cat /tmp/sync-agent-skills.log 2>/dev/null | tail -1)"
echo "  重索引:   $(cat /tmp/classifier-cron.log 2>/dev/null | tail -1)"
echo ""

# 9. 会话
echo "📊 会话:"
python3 -c "
import json
with open('$HOME/.openclaw/workspace/agent-hub/data/sessions.json') as f:
    d=json.load(f)
print(f'  {len(d.get(\"sessions\",[]))} sessions persisted')
" 2>/dev/null || echo "  ❌ 未持久化"
echo ""

echo "========================================"
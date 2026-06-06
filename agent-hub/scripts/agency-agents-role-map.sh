#!/bin/bash
# agency-agents 角色分配到工作室各 Agent
# 每个 Agent 工作时加载对应部门的角色定义

BASE="$HOME/.openclaw/workspace/agent-hub/agency-agents"

echo "=== 角色分配表 ==="
echo ""
echo "【小宝 (CEO)】→ 战略 + 项目管理"
echo "  $BASE/strategy/"
echo "  $BASE/project-management/"
echo ""
echo "【OpenCode WSL (后端)】→ 工程"
echo "  $BASE/engineering/ (35 个角色)"
echo ""
echo "【OpenCode Windows (前端)】→ 设计 + 工程(前端)"
echo "  $BASE/design/ (8 个角色)"
echo "  $BASE/engineering/engineering-frontend-developer.md"
echo ""
echo "【小聪 (审计+运营)】→ 测试 + 运维"
echo "  $BASE/testing/ (9 个角色)"
echo "  $BASE/engineering/engineering-sre.md"
echo ""
echo "=== 其他可用部门 ==="
echo "  营销: $BASE/marketing/ (36)"
echo "  游戏: $BASE/game-development/ (20)"
echo "  金融: $BASE/finance/ (8)"
echo "  法务: $BASE/legal/ (2)"
echo "  HR: $BASE/hr/ (2)"
echo "  销售: $BASE/sales/ (8)"
echo "  学术: $BASE/academic/ (6)"
echo "  供应链: $BASE/supply-chain/ (5)"
echo "  专业领域: $BASE/specialized/ (46)"


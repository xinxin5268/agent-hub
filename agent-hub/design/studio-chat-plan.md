# Agent Hub — 工作室完善方案

## 当前状态
- ✅ 注册中心 (:3210) — 5 个 Agent 已注册
- ✅ Agent Hub UI (:5173) — React + Vite，6 个面板
- ❌ UI 空白（路径问题）
- ❌ Agent 间不能互相通信
- ❌ 没有实时终端流
- ❌ 没有指令执行能力

## 需要实现的功能

### 1. 修复 UI 空白
- 原因：base 路径 `/openclaw/agent-hub/` 在独立静态服务器下找不到资源
- 修复：构建时 base=`/`，或构建后替换 HTML 中的路径

### 2. Agent 实时通信（核心）
架构：
```
Agent Hub UI (:5173)
  ↓ WebSocket
注册中心 (:3210/ws)
  ↓ 转发
Agent A ←→ Agent B ←→ Agent C
```

实现：
- **工作室聊天室** — 所有 Agent 在一个聊天室，发消息 = 广播
- **私聊** — 选择目标 Agent 一对一发送
- **指令执行** — 通过注册中心向 Agent 下发命令

### 3. Agent 详情面板
- 点击 Agent → 弹出详情侧栏
- 显示：状态、模型、平台、最后心跳
- 操作：发送消息、查看日志、启动/停止

### 4. 实时状态更新
- WebSocket 连接注册中心
- Agent 状态变化实时推送到 UI
- 心跳超时自动标记离线

## 文件修改计划

### src/registry/protocol.ts
添加消息类型：
- `agent:message` — Agent 间消息
- `agent:broadcast` — 广播消息
- `command:execute` — 指令执行

### src/features/studio/StudioPanel.tsx（已有，需重写）
- 连接注册中心 WebSocket
- Agent 卡片列表（当前状态）
- 点击 Agent 展开详情
- 消息输入框 + 发送
- 聊天消息流

### src/features/studio/AgentChat.tsx（新建）
- 聊天室组件
- 消息气泡（发送者、时间、内容）
- 输入框 + 发送按钮
- Agent 在线状态指示

### src/features/studio/AgentDetail.tsx（新建）
- Agent 详细信息面板
- 操作按钮（发消息、启动、停止）
- 最后活动时间

## 数据流
```
UI 发送消息 → fetch POST /api/command → 注册中心 → WebSocket 转发到目标 Agent
目标 Agent 回复 → WebSocket → 注册中心 → 广播到所有 UI 客户端
```

## 启动方式
```bash
cd ~/.openclaw/workspace/agent-hub
bash scripts/start-all.sh  # 一键启动注册中心 + 静态服务器 + 注册 Agent
# 访问 http://127.0.0.1:5173/
```

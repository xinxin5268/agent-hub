# Agent 自动注册 + 工作室方案

## 架构

```
┌───────────────────────────────────────────────────────────┐
│                  Agent Hub (工作室)                        │
│   Web UI :3200 (基于 TermHive 或独立实现)                  │
│   - 展示所有注册 Agent 状态                                │
│   - 一键启动/停止 Agent                                   │
│   - 终端流查看                                            │
│   - 广播指令 / Agent 间消息                                │
└──────────────┬───────────────────────┬───────────────────┘
               │                       │
    ┌──────────▼──────────┐  ┌────────▼────────┐
    │  注册中心 daemon     │  │  mDNS 监听器     │
    │  :3210              │  │  (自动发现)       │
    │  - 管理 Agent 注册表  │  │                   │
    │  - 下发启动脚本       │  │                   │
    │  - 健康检查           │  │                   │
    └──────────┬──────────┘  └────────┬────────┘
               │                       │
    ┌──────────▼───────────────────────▼────────┐
    │            局域网 mDNS 广播                 │
    └──────────┬──────────┬──────────┬──────────┘
               │          │          │
    ┌──────────▼┐ ┌──────▼─────┐ ┌──▼──────────┐
    │ opencode  │ │ opencode   │ │ OpenClaw GW  │
    │ Windows   │ │ WSL        │ │ 小宝/小聪/  │
    │ serve     │ │ serve      │ │ Hermes      │
    │ --mdns    │ │ --mdns     │ │ Bonjour     │
    └───────────┘ └────────────┘ └─────────────┘
```

## 流程

1. **Agent 启动自注册**：
   - opencode: `opencode serve --mdns --port 3xxx` → 广播 `_opencode._tcp`
   - OpenClaw Gateway: 已有 Bonjour 广播 `_openclaw-gw._tcp`
   - 也可以主动 POST 到注册中心 HTTP 接口

2. **注册中心自动发现**：
   - mDNS 监听器扫描 `_opencode._tcp` 和 `_openclaw-gw._tcp`
   - 新 Agent 加入 → 记录到注册表 → 推送到工作室 UI
   - Agent 离线 → 标记下线

3. **工作室统一管理**：
   - 列表展示所有 Agent（名称、状态、平台、模型）
   - "启动 Agent" → 注册中心下发启动指令（通过 opencode ACP 协议或 SSH）
   - "停止 Agent" → 同上
   - "注入指令" → 通过 opencode 的 codex:send 或 Gateway 的 sessions.send
   - 终端流 → WebSocket 实时显示

## 文件结构

```
agent-hub/
├── src/
│   ├── registry/          # 注册中心
│   │   ├── daemon.ts      # 注册中心 daemon (WebSocket + HTTP)
│   │   ├── mdns-scanner.ts # mDNS 监听器
│   │   ├── agent-pool.ts  # Agent 注册表管理
│   │   └── protocol.ts    # 通信协议
│   ├── studio/            # 工作室 UI
│   │   ├── StudioPanel.tsx # 主面板
│   │   ├── AgentConsole.tsx # Agent 终端
│   │   ├── AgentRegistry.tsx # 注册表视图
│   │   └── CommandCenter.tsx # 指令中心
│   ├── adapters/          # 适配器
│   │   ├── opencode-adapter.ts  # opencode 通信
│   │   └── gateway-adapter.ts   # OpenClaw Gateway 通信
│   └── ...
└── scripts/
    ├── start-registry.sh   # 启动注册中心
    └── register-agent.sh   # Agent 注册脚本
```
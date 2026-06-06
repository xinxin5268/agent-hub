# Agent Hub v2 升级方案

## 定位
多 Agent × 多项目 协作管理系统，共享技能、知识库、工作经验，自动化监测

## 从开源项目吸收的精华

### 从 captain-claw 吸收
1. **Agent Forge** — 自然语言描述→自动生成 Agent 团队
2. **Flight Deck 仪表盘** — 更完善的 Agent 状态看板
3. **多级记忆系统** — 工作记忆/语义记忆/深度记忆/洞察/神经信号
4. **Agent Council** — 结构化多 Agent 讨论/辩论/评审
5. **意图系统 (Intentions)** — Agent 主动提议 + 用户审批
6. **工具/技能自动发现** — Agent 自动报告能力

### 从 agent-club 吸收
1. **能力声明 (Capability Declarations)** — Agent 注册时声明自己能做什么
2. **知识交换协议** — 结构化知识共享（fact/skill/code/experience）
3. **信任评分** — 基于交互历史的信任体系
4. **标签搜索** — 按标签检索知识和 Agent
5. **内容验证** — 防注入、异常检测

### 从 claudecode-discord 吸收
1. **频道=工作空间映射** — 每个频道/房间对应一个项目目录
2. **消息队列** — 多 Agent 消息排队顺序处理
3. **移动端远程控制** — 后续可以接 Telegram/Discord

## 升级计划（6 个阶段）

### Phase 1: Agent 能力声明 + 技能自动发现
- Agent 注册时声明能力（code_review, translation, coding, security_audit...）
- 注册中心自动匹配 Agent 能力 ↔ 可用技能
- UI 显示每个 Agent 的能力雷达图

### Phase 2: 共享知识库
- Agent 工作经验的**结构化存储**（fact/skill/code/experience）
- 标签搜索 + 全文搜索
- Agent 自动写入工作记录
- 新 Agent 上线自动同步相关知识

### Phase 3: 自动化监测
- 注册中心定时轮询：Agent CPU/内存/任务进度/错误率
- 异常自动告警（Agent 掉线、任务超时、错误率飙升）
- 自动化看板：Agent 健康分、任务完成率、响应延迟
- 自动启动离线 Agent（已有 `/api/launch-all`，前端按钮已加）

### Phase 4: Agent 协作增强
- Agent Council — 结构化多 Agent 讨论
- 消息队列 — 多消息排队处理
- 意图系统 — Agent 主动提议 + CEO 审批
- Agent 间文件传输

### Phase 5: 记忆系统
- 工作记忆（当前会话）
- 语义记忆（向量 + 全文搜索）
- 洞察提取（自动提取关键决策/事实/联系人）
- 背景进程（自主分析/模式发现）

### Phase 6: 外部接入
- Discord/Telegram 桥接
- 移动端远程控制
- Webhook 集成

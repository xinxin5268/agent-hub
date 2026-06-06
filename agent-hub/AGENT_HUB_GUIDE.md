# Agent Hub — Agent 操作指南

> 参考 OpenMontage 的 Agent 驱动管线设计。本文件定义 Agent Hub 中所有 Agent 的操作契约。

## 核心理念

**所有生产任务必须走管线，没有例外。**

```
用户指令
  │
  ▼
Agent Hub Core (消息路由 + 状态追踪)
  │
  ├── 小宝（执行制作人）— 拆解任务 → 选择管线 → 分发
  ├── 千问A3（研究员）— 调研、拆书、题材分析
  ├── OpenCode（执行者）— 写代码、生成文件
  └── 小聪（审核人）— 检查产出、门禁校验
```

---

## 一、Agent 注册与通信

### Agent 身份注册

每个 Agent 启动时向 Agent Hub Core 注册：

```json
{
  "type": "register",
  "agent_id": "xiaobao",
  "agent_name": "小宝",
  "type": "openclaw",
  "capabilities": ["orchestration", "writing", "review"],
  "ws_url": "ws://127.0.0.1:3210/ws"
}
```

### 消息格式

```json
{
  "type": "message",
  "id": "msg-xxx",
  "from": "xiaobao",
  "to": "opencode-wsl",
  "content": "任务描述",
  "task_id": "task-001",
  "priority": "normal"
}
```

### 确认机制

| 消息状态 | 含义 |
|----------|------|
| `pending` | 已入库，待推送 |
| `delivered` | 已推送到目标 Agent |
| `acknowledged` | 目标 Agent 确认收到 |
| `processed` | 目标 Agent 处理完成 |
| `failed` | 处理失败 |

---

## 二、管线定义

### 管线结构

每条管线是一个 YAML 文件，定义阶段、工具、质量门禁。

```
pipelines/
├── novel-writing.yaml       # 小说写作管线
├── manga-storyboard.yaml    # 漫剧故事板管线
├── video-production.yaml    # 视频生产管线
└── skill-development.yaml   # Skill 开发管线
```

### 管线模板

```yaml
name: novel-writing
version: "1.0"
description: 小说创作管线：从选题到成稿
stability: production

orchestrator: xiaobao
budget:
  max_stages: 6
  max_revisions: 3

stages:
  - name: outline
    skill: novel/outline
    assignee: xiaobao
    produces: outline.md
    human_approval: true
    review_focus:
      - 三幕结构完整
      - 角色≥3个有动机
      - 世界观不矛盾

  - name: chapter_split
    skill: novel/chapter-split
    assignee: xiaobao
    produces: chapters.md
    human_approval: true

  - name: writing
    skill: novel/writing
    assignee: opencode-wsl
    produces: chapter-*.md
    parallel: true  # 可并行写多章
    tools_available:
      - write_file
    human_approval: false
    quality_gates:
      - gatekeeper: 6道门禁校验

  - name: review
    skill: novel/review
    assignee: xiaocong-win
    produces: review-report.md
    human_approval: true
    review_focus:
      - 一致性：角色属性 vs facts.jsonl
      - 逻辑：时间线/因果关系
      - 反AI味检测
```

---

## 三、操作流程

### 当收到用户指令时

1. **分类指令** → 匹配到对应管线
2. **运行预检** → 检查所需 Agent 是否在线
3. **选择管线** → 读取 pipeline YAML
4. **按阶段执行** → 每个阶段：
   - 读取 stage skill（`skills/pipelines/<pipeline>/<stage>.md`）
   - 分发给 assignee
   - 等待完成或超时
   - 运行质量门禁
   - 需要审批时暂停等待
5. **完成后总结** → 输出交付物 + 成本/时间报告

### 当收到其他 Agent 消息时

1. 读取 `task_id` → 检查 task 状态
2. 如果是分配给我的任务：
   - 回复 `acknowledged`
   - 执行任务
   - 回复 `processed` + 结果
3. 如果是广播消息：
   - 只关注与自己相关的部分

### 当审核任务时

1. 阅读任务文件
2. 阅读产出文件
3. 逐项检查审核清单
4. 输出审核报告（✅/❌/⚠️）
5. ❌ 项附具体修改建议

---

## 四、质量门禁

### 小说创作门禁（6道）

见 `agent-hub/gatekeeper.js` 实现：
1. 协议解析 — `---CHANGES---` 声明块
2. 引用校验 — 引用的事实是否在 facts.jsonl 中
3. 一致性校验 — 角色属性/关系/位置
4. 未知实体检测 — 未注册新角色/地点
5. 描写一致性 — 外貌/语气/习惯守恒
6. 蓝图出场检查 — 该出现的角色是否出现

### 漫剧故事板门禁（规划中）
1. 角色视觉一致性 — 同一角色在不同帧中面貌一致
2. 镜头连续性 — 相邻镜头不跳轴
3. 景别节奏 — 不同景别交替出现
4. 对话匹配 — 对话气泡/字幕与画面同步

---

## 五、项目目录规范

```
projects/<project-name>/
├── tasks/           # 任务文件
├── assets/          # 素材（角色卡、背景、道具）
├── outputs/         # 交付物
│   ├── chapters/    # 小说章节
│   ├── storyboard/  # 故事板
│   └── video/       # 视频
├── facts.jsonl      # 事实快照
├── checkpoint.json  # 当前进度
└── review.md        # 审核报告
```

---

## 六、Agent 能力清单

| Agent | ID | 能力 | 通信方式 |
|-------|-----|------|----------|
| 小宝 | xiaobao | 编排、写作、决策 | WS ws://127.0.0.1:3210/ws |
| 千问A3 | qianwen-a3 | 研究、拆书、题材分析 | ACP ws://127.0.0.1:8765 |
| OpenCode WSL | opencode-wsl | 代码编写、文件生成 | MQ agent-hub |
| OpenCode Win | opencode-win | 代码编写、模板制作 | MQ agent-hub |
| 小聪 | xiaocong-win | 审核、门禁校验 | WS ws://192.168.1.28:18800 |

---

## 七、错误处理

| 场景 | 行为 |
|------|------|
| Agent 离线 | 任务排队，等上线后推送 |
| 任务超时（>5分钟无响应） | 重新分发或升级给人类 |
| 连续失败3次 | 标记为 failed，通知人类 |
| 消息确认超时（>30秒） | 重新推送，最多3次 |
| 管线阶段审批未通过 | 打回上一阶段修改，最多3次修订 |

---

## 八、与 OpenMontage 的区别

| 维度 | OpenMontage | Agent Hub |
|------|-------------|-----------|
| 执行体 | AI coding agent | 多异构 Agent 集群 |
| 渲染引擎 | Remotion / HyperFrames / FFmpeg | html-video (HyperFrames) / Toonflow |
| 工具注册 | Python tool registry | MQ + WS 消息路由 |
| 素材来源 | Pexels/Pixabay/Archive.org | Toonflow素材库（待建） |
| Agent 技能 | `.agents/skills/` markdown | `agent-hub/skills/` markdown |
| 管线定义 | YAML pipeline manifest | YAML pipeline manifest（同） |

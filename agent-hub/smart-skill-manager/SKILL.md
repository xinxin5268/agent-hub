---
name: smart-skill-manager
description: 智能 Skill 分类分级分层管理器 — 自动整理、分级加载、场景适配推荐。解决 100+ skill 一次性加载的 token 浪费问题。
---

# 🧠 Smart Skill Manager — 智能分类分级分层管理器

> 不是普通文件管理器，是 Agent 的"技能大脑"。

## 解决什么痛点

| 痛点 | 以前 | 现在 |
|------|------|------|
| 😱 **Skill 太多加载不过来** | 100 个 skill 一次性加载，大量 token 浪费 | 按 **层级+场景** 按需加载，首次只加载核心层 |
| 🧭 **找不到需要的 skill** | 靠文件名猜，实际效果靠碰 | 自动生成每个分类的 **Skill 清单目录** |
| 🤖 **Agent 不知道用什么** | 装了一堆 skill 但 Agent 不会主动调 | 根据当前任务**主动晒出适配清单**让 Agent 选 |
| 🗂️ **分类混乱** | 文件名算分类，没有层级结构 | 三级结构：**层级→分类→技能** |
| 🔄 **跨 Agent 不兼容** | 小宝的 skill 小聪不统一 | 同一份 registry，跨 Agent 同步 |
| 🧪 **弱模型不会选** | 小模型面对一堆 skill 无所适从 | 根据场景自动**排序推荐**，弱模型也能选 |

---

## 架构：三级分层 (v3.0)

```
层级 1: 核心层 (Core)       → tier='core'，始终加载 (~3 个)
层级 2: 工具层 (Tool)       → tier='toolkit'，关键词分组注入 (~87 个)
层级 3: 场景层 (Scene)      → tier='unknown'，运行时分类名索引 (~14 个)
```

### 第一层：核心层（Core — 始终加载，~3 个）

| 技能 | 原因 |
|------|------|
| behavior-engine | 注入 8 条自动行为规则 |
| taskpad | 跨轮次记忆自动机 |
| vuln-scanner | 统一漏洞扫描编排器 |

**何时触发：** Agent 启动时
**输出什么：** 降级索引中的 Core 技能（~300 tokens）

### 第二层：工具层（Tool — 关键词分组注入）

> **分组策略：** 按 category 分组，每组 ≤8 个技能，超了按前缀拆子类
> **注入格式：** `组名: 关键词1 关键词2 | 技能: skill-a, skill-b`

| 分类 | 技能数 | 关键词示例 |
|------|--------|-----------|
| 代码工具 | 42 | ai- opensource git cla |
| 安全工具 | 15 | aud fir imp sca sem |
| 其他工具 | 13 | ddd dee del mes sma |
| AI Agent | 10 | age cla cli her pho |
| 网络工具 | 5 | cn- dog web ski ope |
| DevOps | 4 | cre kan ski ver |
| 工程开发 | 4 | ski cli gh- pla |
| 技能管理 | 3 | sec pla sec |
| 其他 | 1 | dep |
| 金融 | 2 | sec sec |

**触发阈值：**
- ≥0.85 → 自动加载组内具体技能
- 0.6-0.85 → 加入候选池，等用户确认
- <0.6 → 跳过

### 第三层：场景层（Scene — 分类名索引）

| 分类 | 技能数 | 触发方式 |
|------|--------|----------|
| AI Agent | 10 | auto-skill-loader 匹配 |
| DevOps | 4 | auto-skill-loader 匹配 |
| 代码工具 | 42 | auto-skill-loader 匹配 |
| 其他 | 1 | auto-skill-loader 匹配 |
| 其他工具 | 13 | auto-skill-loader 匹配 |
| 安全工具 | 15 | auto-skill-loader 匹配 |
| 安全扫描 | 2 | auto-skill-loader 匹配 |
| 工程开发 | 4 | auto-skill-loader 匹配 |
| 技能管理 | 3 | auto-skill-loader 匹配 |
| 网络工具 | 5 | auto-skill-loader 匹配 |
| 金融 | 2 | auto-skill-loader 匹配 |

**触发方式：** 运行时通过 auto-skill-loader 关键词匹配
**降级：** 匹配度 <0.6 时跳过，不加载

### 清理层（Cleanup — 任务完成后自动回收）

**何时触发：** 任务完成后（onStepEnd）
**输出什么：** `✅ 已完成回收`
**下一步：** 释放 token → 继续对话

---

## 三级降级策略

### L1: registry.json.bak 恢复（主备份）
- **触发：** registry.json 损坏或为空
- **操作：** `cp registry.json.bak registry.json`
- **备份时机：** 每次成功写入 registry.json 前自动备份

### L2: 最小降级索引（Core 层）
- **触发：** registry.json 和缓存都失效
- **文件：** `~/.openclaw/workspace/.config/skill-base-index.json`
- **内容：** 仅 Core 层技能（~300 tokens）
- **生成：** `python3 scripts/generate-shared-index.py --minimal`

### L3: 自动备份恢复
- **触发：** L1 + L2 都失效
- **目录：** `~/.openclaw/workspace/memory/archive/`
- **内容：** 最近一次成功运行的索引快照
- **恢复：** `rsync memory/archive/latest/ .cache/`

**降级顺序：** L1 → L2 → L3（逐级降级）
**覆盖场景：** 99% 故障场景由 L1+L2 覆盖

---

## auto-skill-loader 触发链 (v3.0)

1. **用户输入** → auto-skill-loader 关键词匹配
2. **Tier 1** (匹配度 ≥0.85) → 自动加载具体技能
3. **Tier 2** (匹配度 0.6-0.85) → 加入候选池，用户确认
4. **Tier 3** (匹配度 <0.6) → 跳过

**Scene 层保护：** 62 个场景技能，保守匹配防止误触浪费 token

---

## 使用流程 (v3.0)

```
用户说"帮我写个 Python 爬虫"
  │
  ├─ 1. auto-skill-loader 匹配输入
  │     关键词: "写" + "Python" + "爬虫"
  │     └→ 匹配度 0.92 → 自动加载
  │
  ├─ 2. 加载匹配技能
  │     ├─ [Tool] web-scraping ✅ (tier='toolkit', 匹配度 0.92)
  │     ├─ [Tool] playwright ✅ (tier='toolkit', 匹配度 0.87)
  │     └─ [Scene] 网络工具 (tier='unknown', 匹配度 0.95)
  │
  ├─ 3. 执行任务
  │     └→ 加载推荐 skill → 开始执行
  │
  └─ 4. 任务完成 → 清理未使用的 skill
       └→ 释放 token 空间
```

### 跳过规则（不加载 skill 的场景）

以下场景**跳过所有 skill 推荐和加载**，只保留核心层：

| 场景 | 识别标志 | 行为 |
|------|----------|------|
| 主动关心 | 消息以 `[关心]` 开头 | 跳过推荐+加载，直接回复 |
| 纯聊天 | classifier 判定为 chat | 跳过推荐+加载 |
| 简单问答 | 单步可完成，无 task 关键词 | 跳过推荐+加载 |

---

## 安装

```bash
# 1. 复制到 skills 目录
cp -r skills/smart-skill-manager ~/.openclaw/workspace/skills/smart-skill-manager

# 2. 注入到 AGENTS.md（自动生效）
cat skills/smart-skill-manager/AGENTS-INJECT.md >> ~/.openclaw/workspace/AGENTS.md

# 3. 在 openclaw.json 注册
# "skills": { "entries": { "smart-skill-manager": { "enabled": true } } }
```

---

## v3.0 命令（共享索引工具链）

```bash
# 生成共享索引（registry.json → SHARED_SKILLS_INDEX.md + 缓存 + 降级索引）
python3 scripts/generate-shared-index.py

# 一致性检查（hash + count + 旧目录扫描）
python3 scripts/check-consistency.py
python3 scripts/check-consistency.py --fix  # 自动修复
python3 scripts/check-consistency.py --scan # 仅旧目录扫描

# 旧目录扫描（发现未注册技能）
python3 scripts/scan-old-dirs.py
python3 scripts/scan-old-dirs.py --register  # 自动添加到注册表

# 仅生成降级索引（Core 层，~300 tokens）
python3 scripts/generate-shared-index.py --minimal

# 仅检查一致性（不生成）
python3 scripts/generate-shared-index.py --check
```

## 旧命令（classifier.py 系列）

```bash
python3 classifier.py                         # 扫描+分类+生成目录（默认）
python3 classifier.py match "任务"            # 推荐技能
python3 classifier.py be-integrate "任务"      # 输出 JSON 给 behavior-engine
python3 classifier.py load skill1 skill2       # 加载指定的技能
python3 classifier.py loaded                   # 查看当前已加载的技能
python3 classifier.py cleanup                  # 清理未用技能
python3 classifier.py stats                    # 统计
python3 classifier.py catalog                  # 仅生成目录
python3 classifier.py sync --agent xiaobao     # 同步注册表（多 Agent）
python3 classifier.py check-conflicts          # 查看分类冲突
python3 classifier.py check-conflicts --json   # JSON 输出冲突
python3 classifier.py resolve                  # 解决分类冲突
python3 classifier.py lock skill-name          # 锁定分类
python3 classifier.py unlock skill-name        # 解锁分类
```

---

## 环境变量

| 变量 | 效果 |
|------|------|
| `SKILL_MANAGER_DISABLE=true` | 关闭智能管理器 |
| `SKILL_MANAGER_CORE_ONLY=true` | 仅加载核心层 |
| `SKILL_MANAGER_AUTO_CLEANUP=true` | 自动清理未用 skill（默认开）|
| `SKILL_MANAGER_AUTO_RECOMMEND=true` | 自动推荐 skill（默认开）|
| `SKILL_MANAGER_MAX_RECOMMEND=5` | 弱模型最大推荐数（默认 5）|

---

## 兼容性

| 系统 | 兼容性 | 说明 |
|------|--------|------|
| **Linux (WSL2 Ubuntu)** | ✅ 已验证 | 小宝运行环境 |
| **Windows** | ✅ 已验证 | 小聪运行环境 |
| **macOS** | ✅ 理论上兼容 | Python 脚本跨平台 |

---

> 踩坑故事见 [README.md](./README.md) | 快速注入版见 [AGENTS-INJECT.md](./AGENTS-INJECT.md)
> 联动方案见 [integration-design.md](./integration-design.md)

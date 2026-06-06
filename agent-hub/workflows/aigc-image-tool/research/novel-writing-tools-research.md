# 中文小说创作工具能力完善调研

> 2026-06-05 | 来源: GitHub 开源项目

---

## 一、全景概览：17 个高星中文小说创作开源项目

| 项目 | ⭐ | 技术栈 | 定位 |
|------|---|--------|------|
| **MuMuAINovel** | 2537 | Python + FastAPI + React | 全功能小说创作助手（智能向导+角色管理+世界观） |
| **chinese-novelist-skill** | 1880 | Python (Claude Code Skill) | Claude Code 上的三层递进式小说创作 Skill |
| **91Writing** | 1545 | Vue 3 + Element Plus | 纯前端 AI 写作工具，数据本地化 |
| **AI-Novel-Writing-Assistant** | 1523 | TypeScript + Express + React | 长篇小说生产引擎，Agent + 世界观 + 写法引擎 + RAG |
| **Long-Novel-GPT** | 1147 | Python (LLM+RAG) | 大纲→章节→正文自顶向下扩写，支持导入改写 |
| **NovelForge** | 900 | Python + Vue | 卡片式创作，Schema 驱动，知识图谱一致性 |
| **AI-automatically-generates-novels** | 874 | JavaScript | 商业化小说生成工具（v5.2），数百家工作室在用 |
| **Ai-Novel** | 663 | Python | 强大 AI 小说创作网站 |
| **novel-creator-skill** | 395 | Python | 基于文件级长期记忆的 Smart State 模式，百万字级 |
| **WenShape (文枢)** | 379 | Python + FastAPI + React | 深度上下文感知 Agent 创作系统，事实摘要+卡片系统 |
| **NovelClaw (原版)** | 313 | Python | 动态记忆优先的协同框架，长篇小说故事生成 |
| **tianming (天命)** | 291 | C# (.NET 8) | 15维事实快照·12类变更声明·6道生成门禁，3000章连贯 |
| **Novel-Control-Station-Skill** | 290 | PowerShell (Claude Code Skill) | 项目控制+文档驱动+动态状态更新+图式回忆 |
| **character-arc (弧光)** | 176 | TypeScript + Electron | 桌面应用，项目设定+角色关系+剧情大纲 |
| **storyforge (故事熔炉)** | 85 | TypeScript | AI 小说创作工作台 |
| **daer-novel** | 74 | TypeScript | 基于 AI 的长篇小说创作助手 |
| **novel_agent** | 60 | Python + Dify | Git-native AI 小说创作工作台 |

---

## 二、核心项目深度分析

### 1. MuMuAINovel ⭐2537 — 最全功能

**定位**: 全功能 AI 小说创作助手，Web 应用
**技术栈**: Python FastAPI 后端 + React 前端
**亮点**:
- 多 AI 模型支持（OpenAI、Gemini、Claude 等）
- 智能向导：AI 自动生成大纲、角色和世界观
- 角色管理：人物关系、组织架构可视化管理
- 章节编辑：创建、编辑、重新生成和润色
- PostgreSQL 生产级数据库，多用户数据隔离
- Docker 一键部署
- **最新 v1.5.1 (2026-06-03)**

**不足**: 功能全面但偏重管理，Agent 编排能力弱于 Toonflow

---

### 2. AI-Novel-Writing-Assistant ⭐1523 — 架构最像我们需要的

**定位**: 面向长篇小说创作的 AI Native 开源系统
**技术栈**: TypeScript + Express + React + LangChain/LangGraph + Qdrant + Prisma
**核心架构**:
- **Creative Hub**: 统一创作中枢（对话、追问、规划、工具调用、执行状态）
- **Agent Runtime**: Planner + Tool Registry + 审批节点 + 中断恢复
- **写法引擎**: 保存/编辑/绑定/复用写作风格，可从文本提取写法特征
- **整本生产主链**: 结构化规划→章节目录→逐章写作→审计→修复→批量 pipeline
- **世界观系统**: 分层设定、快照、深化问答、一致性检查
- **RAG 知识库**: Qdrant 向量检索，拆书结果回灌
- **模型路由**: 多提供商（OpenAI/DeepSeek/SiliconFlow/xAI），可按角色分配

**典型流程**:
1. 灵感→AI自动导演→整本方向候选
2. 项目设定（题材/卖点/读者感受/前30章承诺）
3. 故事宏观规划+角色准备+世界观
4. 卷战略/卷骨架→节奏/拆章
5. 章节执行→审计→修复→批量生产

**与 Toonflow 的对比**:
| 维度 | Toonflow | AI-Novel-Writing-Assistant |
|------|----------|---------------------------|
| 定位 | 小说→视频 | 小说写作全流程 |
| 架构 | 三层Agent(决策/执行/监督) | Agent Runtime + Creative Hub |
| 侧重点 | 分镜+视频生成 | 长篇小说文本生产 |
| 写作能力 | 剧本为主 | 完整小说 |
| 技术栈 | TS + SQLite | TS + LangGraph + Qdrant |

---

### 3. chinese-novelist-skill ⭐1880 — Claude Code Skill 标杆

**定位**: Claude Code 上的 AI 小说创作 Skill
**亮点**:
- **三层递进式问答**: L1(核心定位:题材/主角/冲突) → L2(深度定制:世界观/视角/主题) → L3(可选细节)
- **跨会话偏好记忆**: 自动学习用户喜好（题材/风格/章节数/文字密度）
- **中断续写**: 自动检测断点并继续
- **三种写作模式**: 串行 / 子Agent并行 / Agent Teams
- **自动校验修复**: 字数检查+连贯性检查，不合格自动重写（最多3轮）
- **每章必爽**: 开头即高潮，结尾留悬念
- 输出为完整全稿

**流程**: 初始化→问答→规划确认→写作模式选择→全自动逐章创作→校验修复

**价值**: 和我们已有的 Claude Code 生态高度契合，可以直接安装使用

---

### 4. tianming (天命) ⭐291 — 一致性最强

**定位**: AI 网文创作系统，不依赖上下文窗口
**核心机制**:
- **15维事实快照**: 角色/地点/势力/伏笔等结构化追踪
- **12类变更声明**: AI 输出必须包含 `---CHANGES---` 分隔符 + JSON
- **6道生成门禁**:
  1. 协议解析 — 必须含CHANGES字段
  2. 引用校验 — 引用的ID必须存在
  3. 一致性校验 — 角色状态不矛盾
  4. 未知实体检测 — 新实体数控制
  5. 描写一致性 — 发色/瞳色等外貌一致
  6. 蓝图出场检查 — 关键角色必须出场
- **长距召回**: 跨千章的回忆靠系统挑选历史切片，不靠模型记忆
- **统一校验**: 修改设定后重跑→列出受影响章节

**核心主张**: "第3001章看到的是第3000章落地后写入的真实字段值，而不是模型模糊回忆"

---

### 5. NovelForge ⭐900 — 卡片式创作

**定位**: AI 辅助长篇小说创作，卡片式 + Schema 驱动
**核心特性**:
- **Schema 驱动的卡片创作**: 每种卡片定义结构，AI 生成按结构校验
- **指令流式 AI 卡片生成**: 字段粒度流式填充，不是一次性整段
- **@DSL 上下文注入**: 精准引用项目数据
- **知识图谱一致性**: 关系图谱+动态信息
- **代码式工作流系统**: 可视化编辑工作流 + Workflow Agent（自然语言描述）
- **灵感工作台**: 持续对话、引用卡片、调用工具

---

### 6. WenShape (文枢) ⭐379 — Agent 创作系统

**定位**: 深度上下文感知的智能体创作系统
**核心架构**: orchestrator + agents + context_engine + storage
**亮点**:
- 分卷章节结构（`volumes/*.yaml`, `summaries/*.yaml`）
- 卡片系统（人物卡/世界观卡/文风卡）
- 按距离索引的事实摘要系统（BM25 + 实体增强 + 章节距离衰减）
- 同人创作工作流（搜索→预览→抓取→提案）
- 多模型供应商支持
- 纯文本格式存储（YAML/Markdown/JSONL），适合版本管理

---

### 7. 91Writing ⭐1545 — 最佳写作工具体验

**定位**: 纯前端专业 AI 写作平台
**亮点**:
- 所有数据本地存储
- 智能续写 + 多样化小说生成算法
- 世界观构建系统（模板化）
- 写作目标跟踪（每日/每周/每月字数）
- 章节状态管理（草稿/完成/发表）
- 版本控制 + 自动保存
- 在线演示: https://xiezuo.91hub.vip

---

## 三、关键技术能力对比

| 能力 | MuMuAI | AI-Novel-Asst | chinese-novelist | 天命 | NovelForge | WenShape | 91Writing |
|------|--------|---------------|-----------------|------|-----------|---------|----------|
| 大纲生成 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 角色管理 | ✅ 可视化 | ✅ 动态资产 | ✅ 基础 | ✅ 15维 | ✅ 卡片 | ✅ 卡片 | ✅ 基础 |
| 世界观 | ✅ | ✅ 分层 | ❌ | ✅ | ✅ | ✅ 卡片 | ✅ 模板 |
| 章节写作 | ✅ | ✅ 逐章+批量 | ✅ 全自动 | ✅ 闭环 | ✅ 流式 | ✅ | ✅ |
| 一致性 | ❌ | ✅ RAG | ✅ 校验 | ✅ 6道门禁 | ✅ 知识图谱 | ✅ 事实摘要 | ❌ |
| 中断续写 | ❌ | ✅ 检查点 | ✅ | ✅ 状态回写 | ❌ | ❌ | ❌ |
| 写法/风格 | ❌ | ✅ 写法引擎 | ✅ 偏好记忆 | ✅ 五大规则 | ❌ | ✅ 文风卡 | ❌ |
| Agent 编排 | ❌ | ✅ LangGraph | ✅ 子Agent | ❌ | ✅ 工作流 | ✅ 智能体 | ❌ |
| 批量生产 | ❌ | ✅ 整本pipeline | ✅ 全自动 | ✅ 逐章闭环 | ✅ 工作流 | ❌ | ❌ |
| 多模型 | ✅ | ✅ 路由 | ❌ | ✅ | ✅ | ✅ 多供应商 | ✅ |
| 知识库/RAG | ❌ | ✅ Qdrant | ❌ | ❌ | ❌ | ❌ | ❌ |
| 桌面应用 | ❌ | ✅ Electron | ❌ | ❌ | ❌ | ✅ Win发布 | ❌ |

---

## 四、适合我们的整合路径

### 当前已有能力
- ✅ **Toonflow** 部署完成（localhost:10588）：小说→剧本→分镜→角色→视频
- ✅ **PenShot** 调研：剧本分镜 Agent
- ✅ **Agent Mangaka Forge**：角色一致性策略
- ✅ **AIGC 角色卡/人设表**调研
- ✅ **DeepSeek API** 可用（极低价格）

### 推荐整合方案

#### 方案 A：轻量级 — 安装现有 Skill（最快）
1. 安装 `chinese-novelist-skill`（⭐1880）→ 直接用 Claude Code 写小说
2. 搭配 Toonflow 做小说→视频转换
3. 通过 DeepSeek API 驱动

**优点**: 零开发，立刻能用
**缺点**: 能力受限于 Skill 本身

#### 方案 B：中量级 — 部署现有系统
1. 部署 **AI-Novel-Writing-Assistant**（⭐1523）作为写作主系统
2. 对接 Toonflow 做视频化
3. 接入 DeepSeek API

**优点**: 完整写作流程，Agent 编排能力强
**缺点**: 需要部署和维护

#### 方案 C：深度整合 — 在 Agent Hub 上构建
1. 借鉴 **AI-Novel-Writing-Assistant** 的 Agent Runtime + Creative Hub 架构
2. 借鉴 **天命** 的事实快照 + 生成门禁机制保证一致性
3. 借鉴 **Toonflow** 的三层 Agent 架构（决策/执行/监督）
4. 整合已有 AIGC 角色卡/人设表/多视角能力
5. 接入 DeepSeek API（极低成本）
6. 接入 Agent Hub 的 Agent 编排 + 技能体系

**优点**: 完全自主，可定制，与现有生态整合
**缺点**: 开发量大

#### 方案 D：务实路线 — 先用现成，逐步整合
1. **Step 1**: 部署 AI-Novel-Writing-Assistant（Web + API），先跑通小说写作流程
2. **Step 2**: 将其 API 接入 Agent Hub，作为 Agent Hub 的"写作 Agent"
3. **Step 3**: 接入 Toonflow 做小说→视频
4. **Step 4**: 借鉴天命的事实快照机制，提升一致性
5. **Step 5**: 逐步替换/自建组件

---

## 五、需要完善的能力清单（按优先级）

### P0 — 核心写作能力
- [ ] 完整的小说大纲/章节规划生成
- [ ] 逐章写作（带字数控制）
- [ ] 批量生产（整本书）
- [ ] 中断续写（断点恢复）

### P1 — 创作资产管理
- [ ] 角色管理（基础档案+关系图谱）
- [ ] 世界观设定（结构化）
- [ ] 知识库/RAG（设定回灌）

### P2 — 质量控制
- [ ] 一致性校验（角色/地点/伏笔）
- [ ] 去 AI 味（润色）
- [ ] 自动校验修复

### P3 — 高级能力
- [ ] 写法/风格引擎（保存+复用）
- [ ] Agent 编排（多 Agent 协作）
- [ ] 模型路由（按任务分配模型）
- [ ] 与 Toonflow 的 AIGC 管线打通

---

## 六、建议下一步

你说想继续完善"小说创作工具能力"，我建议先明确方向：

**你的优先目标是什么？**
A. 先自己用起来 → 安装 chinese-novelist-skill，搭配 DeepSeek API 跑一轮试试
B. 搭建完整系统 → 部署 AI-Novel-Writing-Assistant 做写作主系统
C. 整合到 Agent Hub → 把写作能力作为 Agent Hub 的一个 Agent 角色
D. 结合 AIGC 管线 → 打通 小说→Toonflow→视频 的全流程
E. 其他方向

或者可以先浏览几个项目的实际界面，看看哪个最接近你想要的？

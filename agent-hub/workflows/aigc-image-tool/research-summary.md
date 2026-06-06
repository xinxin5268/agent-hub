# AI小说→漫画→视频 全流程工具调研总结

## 一、核心发现：Toonflow（9589⭐）

**定位**: 开源一站式 AI 短剧创作工具，小说→剧本→分镜→角色→视频，一条龙
**技术栈**: TypeScript + Node.js + Express + Electron + SQLite
**模型支持**: DeepSeek / Qwen / OpenAI / Anthropic / Google / xAI
**许可**: Apache-2.0（≤5人内部使用免费）
**状态**: v1.1.7（2026-05-01），本地已克隆（Gitee），Docker build 中

### 三层 Agent 架构（最值得学习）

```
用户 → 决策层Agent（需求分析/任务拆解/质量把控）
         ├── 执行层Agent（剧本/分镜/素材生成等具体干活）
         └── 监督层Agent（审核产出物质量，提建议不改决策）
```

**决策层** (script_agent_decision.md / production_agent_decision.md):
- 唯一与用户直接对接的 Agent
- 拆解任务、调度执行层和监督层
- 不自己干活，只派活+检查结果

**执行层** (script_execution_*.md / production_execution_*.md):
- 骨架搭建 → 改编策略 → 剧本编写
- 分镜表 → 分镜图生成 → 视频生成
- 每个执行层只干自己那一步

**监督层** (script_agent_supervision.md / production_agent_supervision.md):
- 只审核不修改
- 按红线清单逐项检查
- 输出评分A/B/C/D + 问题清单

### 提示词技能体系
`data/skills/` 目录下所有 .md 文件就是 Agent 的"技能"
- 决策层技能: 告诉 Agent 怎么拆任务、调谁
- 执行层技能: 告诉 Agent 具体怎么干活
- 监督层技能: 告诉 Agent 怎么审核
- art_skills/ 和 story_skills/: 细分专业领域技能

### 和我们架构的对比

| 维度 | 我们的 Agent Hub | Toonflow |
|------|-----------------|----------|
| Agent 能干嘛 | 心跳+技能匹配 | 决策/执行/监督三层 |
| 任务怎么派 | 手动写数据库 | Agent自主拆解+调度 |
| 记忆 | 无 | ONNX向量检索 |
| 技能体系 | 共享skill管理器 | 按角色的skills目录 |
| 运行状态 | 稳定在线 | Docker部署中 |

## 二、其他值得关注的项目

### 小说生成
- **RecurrentGPT** (1001⭐): 交互式超长文本生成
- **NovelClaw** (313⭐): 动态记忆长篇故事协作框架
- **Awesome-Story-Generation** (623⭐): LLM时代故事生成论文汇总

### 辅助工具（awesome-llm-apps 已有）
- content-creator: 内容创作SKILL
- music-generator: AI音乐生成
- blog-to-podcast: 文本→音频转换
- news-podcast: 新闻+播客多Agent系统

## 三、后续建议

1. ✅ **部署 Toonflow** — Docker 构建中，成功后直接可用
2. 🔍 **学习 Toonflow 的 Agent 架构** — 把三层Agent机制引入我们的Agent Hub
3. 🛠 **对接已有工具** — 把 prompt_pipeline.py 作为Toonflow的"外部提示词生成器"
4. 📝 **批量小说创作** — 基于 DeepSeek API 写长篇小说生成脚本

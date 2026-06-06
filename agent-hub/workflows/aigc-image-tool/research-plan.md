# 🎯 AI小说创作工具 联合研究计划

## 目标
研究并搭建一条：**AI自主小说创作 → 漫画分镜 → 视频生成** 的全自动流水线
对标国内那些3000万字级、全AI自创、过审的小说+漫画+视频团队

## 现有资源

### 已安装
- **awesome-llm-apps** (125个模板): 内容创作/content-creator、技术写作/technical-writer、音乐生成/music-generator、博客转播客/blog-to-podcast、新闻播客/news-podcast
- **prompt_pipeline.py**: 一句话创意 → 5个脚本 → 视频API prompt

### GitHub 研究方向（按优先级）
1. **vllm-project/snap** ⭐ ~10K — 分布式小说推理引擎
2. **aider/AI** ⭐ ~20K — 可辅助小说写作的pair programming
3. **Legado/legado** ⭐ 高 — 开源阅读器/小说引擎
4. **AiWriter/LongWriter** ⭐ 高 — 长文本生成模型
5. **NovelCrafter** — 长篇小说AI写作
6. **Weaver** — 小说创作辅助（角色/世界观/情节）

### 小说→漫画工具
- PenShot — 剧本分镜
- ai-drama-platform — 漫剧平台
- **ComicGen/MangaMaker** — GitHub上的漫画生成

## 调研分工

### Agent 1: xiaocong-win（小说写作工具研究）
- 搜索GitHub上高星小说AI写作工具
- 重点：长篇小说分章/人物一致性/世界观构建
- 评估：能否接入我们的流水线

### Agent 2: opencode-wsl（awesome-llm-apps深度挖掘）
- 详细阅读 content-creator、technical-writer 等创作相关SKILL
- 跑通 music_generator_agent.py 看它怎么生成音乐
- 跑通 blog_to_podcast_agent.py 看文本→音频的转

### Agent 3: opencode-win（漫画+视频工具）
- 研究 ComicGen / MangaMaker 等漫画生成开源项目
- 研究 ai-drama-platform 代码结构
- 看PenShot是否能pip install

### Agent 4: xiaobao（架构整合）
- 设计整体流水线架构
- 整合所有发现
- 做出可用的原型

## 完成标准
- [ ] 完成GitHub主要小说工具的调研并记录
- [ ] 跑通至少2个awesome-llm-apps中的相关工具
- [ ] 设计出端到端架构图
- [ ] 产出第一个版本的AI小说创作脚本

## 核心发现：Toonflow（9589⭐）

### 简介
开源一站式 AI 短剧创作工具，小说→剧本→分镜→角色→视频，一条龙全流程。
- GitHub: https://github.com/HBAI-Ltd/Toonflow-app
- Gitee: https://gitee.com/HBAI-Ltd/Toonflow-app
- 主页: https://toonflow.net
- 许可: Apache-2.0（≤5人内部使用免费）
- 语言: TypeScript + Node.js + Electron
- 最新: v1.1.7（2026-05-01）

### 核心功能
- 三层 Agent 协作（决策层/执行层/监督层）
- Agent 持久化记忆（基于 ONNX 向量检索）
- 章节事件图谱驱动改编
- 多模型供应商（DeepSeek/Qwen/OpenAI/Anthropic/Google）
- 可编程供应商系统（TypeScript 即时生效）
- 无限画布工作台
- 本地推理（ONNX）

### 项目结构
- src/routes/novel/ — 小说管理（增删改查+事件提取）
- src/routes/script/ — 剧本生成（AI剧本+素材提取）
- src/routes/cornerScape/ — 分镜管理
- src/routes/production/ — 制作管线（storyboard/workbench/video）
- src/routes/assetsGenerate/ — 素材AI生成
- src/routes/agents/ — Agent记忆管理

### 和我们的关系
Toonflow 的路线和我们完全一致：小说→剧本→分镜→角色→视频
我们已有的 prompt_pipeline.py 可以做为 Toonflow 的一个"提示词生成模块"
但 Toonflow 已经是一个完整的可运行产品，我们应考虑：
1. 直接部署 Toonflow 使用
2. 或者深度研究它的 Agent 协作机制，在我们的架构中复用

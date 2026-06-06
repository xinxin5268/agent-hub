# Toonflow 调研报告

> 一站式 AI 短剧工厂：小说 → 漫画 → 视频全自动流水线
> ⭐ 9589 Stars | Apache-2.0 | TypeScript + Node.js + Electron + Docker

## 访问信息
- **本地地址**: http://localhost:10588
- **默认账号**: admin / admin123
- **源码**: `/home/chenxin520/.openclaw/workspace/Toonflow-app`
- **技术栈**: TypeScript, Express, Socket.IO, SQLite, AI SDK (Vercel ai)

## 核心架构：三层 Agent

### 1. Script Agent（编剧 Agent）
- **入口**: `src/agents/scriptAgent/index.ts`
- **技能**: `data/skills/script_agent_decision.md`
- **功能**:
  - 分析小说剧情线、角色、场景
  - 自动提取角色设定、人物关系
  - 生成分镜脚本（按章节/事件）
  - 有 RAG 记忆系统（`src/utils/agent/memory.ts`）

### 2. Production Agent（制作 Agent）
- **入口**: `src/agents/productionAgent/index.ts`
- **技能**: `data/skills/production_agent_decision.md`
- **功能**:
  - 根据脚本生成画面描述提示词
  - 调用外部 AI 模型生成图片（对接 Stable Diffusion / ComfyUI / 第三方 API）
  - 生成视频（分镜合成 + 配音 + 动效）
  - 有技能工具系统（`src/utils/agent/skillsTools.ts`）

### 3. Supervision（监督层）
- **技能文件**: 
  - `data/skills/script_agent_supervision.md`
  - `data/skills/production_agent_supervision.md`
- **功能**: 检查生成质量，确保角色一致性、画面连贯性

## 技能体系（12 种题材）
`data/skills/story_skills/` 下按小说类型分类，每种题材有专属导演技能：
1. `Horror_supernatural/` — 恐怖灵异
2. `Xianxia_fantasy/` — 仙侠奇幻
3. `Mystery_thriller/` — 悬疑惊悚
4. `Comedy_humor/` — 喜剧幽默
5. `Coming_of_age/` — 成长青春
6. `Urban_workplace_drama/` — 都市职场
7. `Sweet_romance_novel/` — 甜宠言情
8. `Historical_epic/` — 历史史诗
9. `Family_warmth/` — 家庭温情
10. `Hot_blooded_action/` — 热血动作
11. `Psychological_drama/` — 心理剧
12. `Scifi_post_apocalypse/` — 科幻末世

## API 路由（207 个 TS 文件）

### 小说管理 (`routes/novel/`)
- `addNovel.ts` — 导入小说
- `getNovel.ts` — 获取小说内容
- `updateNovel.ts` — 更新小说
- `delNovel.ts` — 删除小说
- `getNovelIndex.ts` — 获取目录
- `event/generateEvents.ts` — AI 自动生成剧情事件
- `event/getEvent.ts` — 获取事件详情

### 脚本/分镜 (`routes/script/`)
- `addScript.ts` — 添加分镜
- `batchAddScript.ts` — 批量添加分镜
- `extractAssets.ts` — 提取画面资产
- `exportScript.ts` — 导出脚本

### 图片生成 (`routes/assetsGenerate/`)
- `generateAssets.ts` — 生成图片资产
- `batchGenerateImageAssets.ts` — 批量生成
- `polishAssetsPrompt.ts` — 优化提示词
- `cancelGenerate.ts` — 取消生成

### 画风管理 (`routes/artStyle/`)
- `addArtStyle.ts` — 添加画风
- `extractStylePrompt.ts` — 从参考图提取画风

### Agent 通信 (`routes/agents/`)
- `getMemory.ts` — 获取 Agent 记忆
- `clearMemory.ts` — 清空记忆

## 工具集成
- `src/utils/ai.ts` — AI 模型调用（支持多厂商）
- `src/utils/vendor.ts` — 厂商/API 配置管理
- `src/utils/agent/skillsTools.ts` — Agent 技能工具系统
- `src/utils/agent/embedding.ts` — 向量嵌入
- `src/utils/agent/memory.ts` — RAG 记忆系统

## 与 Agent Hub 的整合点
1. **Agent 架构一致**: 都是多层 Agent 决策+执行+监督模式
2. **技能体系**: Toonflow 有 12 种题材的导演 skill，可导入 Agent Hub
3. **记忆系统**: 都有 RAG 记忆，可互相借鉴
4. **Socket.IO 通信**: Toonflow 用 socket.io，Agent Hub 用 ws，可桥接

## 下一步
- 用 admin/admin123 登录 Toonflow Web UI 实际操作测试
- 对接 DeepSeek API 作为 AI 模型后端
- 导入一个小说测试全流程
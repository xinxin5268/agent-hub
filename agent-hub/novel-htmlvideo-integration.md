# 小说写作 + html-video 融合方案

> 让写作 Agent 产出小说，html-video 自动渲染成视频

---

## 一、核心流程

```
用户: "写一本修仙文，并做成视频"

小宝 (CEO)
  ├─ 拆需求: 玄幻修仙+视频化
  ├─ 调题材Skill: xianxia.md
  └─ 分配Agent团队
       │
       ├─ 千问A3: 世界观/角色/大纲
       ├─ OpenCode: 逐章写作 + 内容图生成
       └─ html-video: 每章渲染成视频
            │
            ├─ 每章 → content-graph (多帧故事板)
            ├─ 选模板 (light-leak-cinema 电影感 / kinetic-type 动感排版)
            ├─ 填变量 (每帧文本/颜色/节奏)
            └─ render → MP4
```

---

## 二、两种模式

### 模式 A: 逐章视频化（推荐）

```
小说 (文本)
  │
  第1章 → content-graph: [intro→修炼→冲突→悬念]
  │           │
  │           └─ html-video project-create → set-template → set-vars → render → 第1章.mp4
  │
  第2章 → content-graph: [回顾→新场景→战斗→升级]
  │           │
  │           └─ html-video project-create → set-template → set-vars → render → 第2章.mp4
  │
  ...每章一个独立视频
```

**适合**: 短视频平台分发（抖音/B站/YouTube Shorts）

### 模式 B: 整本小说→长篇视频

```
整本小说 → content-graph: [序章→第1章→第2章→...→尾声]
               │
               ├─ 每章 = 1-3 帧 (按内容密度)
               ├─ 帧间用 transition 连接
               └─ render → 整本.mp4
```

**适合**: 有声书/听书平台

---

## 三、Agent 与 html-video 的集成方式

### 方式 1: CLI 调用（最简单，今天就能用）

```bash
# 写作 Agent 产出小说后，脚本化调用：

# 1. 创建项目
node packages/cli/dist/bin.js project-create \
  --name "修仙传-第1章" \
  --intent "小说章节视频化"

# 2. 选择模板（根据题材自动选）
node packages/cli/dist/bin.js project-set-template proj_xxx \
  --template frame-light-leak-cinema

# 3. 设置变量（小说内容注入）
cat > vars.json << 'EOF'
{
  "text": "天地玄黄，宇宙洪荒。在这片大陆上，修炼者为追寻大道而奋斗...",
  "duration_sec": 30,
  "mood": "epic"
}
EOF
node packages/cli/dist/bin.js project-set-vars proj_xxx \
  --vars-file vars.json

# 4. 渲染 MP4
node packages/cli/dist/bin.js project-render proj_xxx \
  --output chapter-01.mp4
```

### 方式 2: Node.js SDK 调用（更灵活）

```typescript
import { ProjectOrchestrator } from '@html-video/core';

const orch = new ProjectOrchestrator({...});

// 写作 Agent 输出小说后，程序化创建视频
async function chapterToVideo(chapterText: string, chapterNum: number) {
  // 1. 创建项目
  const project = await orch.create({
    name: `第${chapterNum}章`,
    intent: '小说章节动画视频'
  });
  
  // 2. 注入小说内容作为 asset
  await orch.addInlineAsset(project.id, chapterText, 'text', '小说原文');
  
  // 3. 选模板（根据题材）
  await orch.setTemplate(project.id, 'frame-light-leak-cinema');
  
  // 4. 设置变量
  await orch.setVariables(project.id, {
    text: chapterText,
    duration_sec: Math.min(chapterText.length / 10, 60),
    mood: 'epic'
  });
  
  // 5. 渲染
  const result = await orch.exportMp4({
    projectId: project.id,
    outputPath: `./output/chapter-${chapterNum}.mp4`
  });
  
  return result.outputPath;
}
```

### 方式 3: Agent Hub 自动集成（最完整）

```
小宝(CEO) 收到"写小说并做视频"
  │
  ├─ 调用写作 Agent 集群 → 产出小说文本
  │
  ├─ 将每章文本传给 html-video Agent
  │     ├─ Agent 分析章节内容 → 提取关键事件
  │     ├─ Agent 构建 content-graph (帧序列+边关系)
  │     ├─ Agent 选模板（根据章节氛围）
  │     ├─ Agent 填充变量 → 调用 CLI/SDK 渲染
  │     └─ Agent 收集所有 MP4 → 返回给用户
  │
  └─ 用户得到: 小说文本 + 每章视频
```

---

## 四、模板选型

根据小说题材自动匹配最佳模板：

| 小说题材 | 推荐模板 | 原因 |
|---------|---------|------|
| 玄幻/修仙 | frame-light-leak-cinema | 电影感、暖色漏光、史诗氛围 |
| 都市/职场 | frame-bold-signal | 现代、简洁、节奏感强 |
| 悬疑/推理 | frame-glitch-title | 故障效果、紧张感 |
| 恐怖/灵异 | frame-takram-organic | 有机流动、不安感 |
| 言情/甜宠 | frame-warm-grain | 暖色胶片、温馨 |
| 科幻/赛博 | frame-glitch-title | 数字故障、科技感 |
| 热血/战斗 | frame-kinetic-type | 动感排版、冲击力 |
| 数据/分析型 | frame-data-chart-nyt | 数据可视化 |
| 解说/知识型 | frame-decision-tree | 决策树、步骤分解 |
| 片头/标题 | frame-liquid-bg-hero | 液态渐变、大标题 |
| 片尾 | frame-logo-outro | Logo动画、品牌落版 |
| 跨场景长视频 | frame-product-promo-30s | 多beat组合、30秒模板 |

---

## 五、content-graph 与小说的映射

小说元素 → content-graph 节点映射：

```
小说结构                content-graph
────────────────────────────────────
章节标题     →   frameIntent: "title-card"
场景描述     →   EntityNode (props: {mood, setting})
对话片段     →   TextNode (text: 对话内容)
情节转折     →   Edge (kind: "contrast", reason: "反转")
事件顺序     →   Edge (kind: "sequence")
伏笔/因果    →   Edge (kind: "dependency")
高潮/爽点    →   durationSec: 延长 (强调)
过渡/平缓    →   durationSec: 缩短 (快速带过)
```

---

## 六、实施计划

| 步骤 | 内容 | 时间 |
|------|------|------|
| 1 | 写一个脚本：输入小说文本 → 输出 MP4 | 今天 |
| 2 | 测试 3 种模板（light-leak / kinetic-type / warm-grain） | 今天 |
| 3 | 整合到写作流程：Agent 写完一章自动触发渲染 | 1天 |
| 4 | 整合 Toonflow：小说→角色/分镜→html-video→视频 | 2天 |
| 5 | 题材-模板自动匹配 | 1天 |
| 6 | 多帧 storyboard（content-graph 自动生成） | 2天 |

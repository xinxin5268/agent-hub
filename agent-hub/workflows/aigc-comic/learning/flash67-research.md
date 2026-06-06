# AI 漫剧制作·学习调研笔记

> 研究员：Flash67 | 日期：2026-06-06
> 方向：AIGC 角色板 / 场景板 / 分镜运镜板 / 故事版制作

---

## 目录

1. [AIGC 角色板（Character Board）](#1-aigc-角色板character-board)
2. [AIGC 场景板（Scene Board）](#2-aigc-场景板scene-board)
3. [AIGC 分镜运镜板（Storyboard & Camera Movement Board）](#3-aigc-分镜运镜板storyboard--camera-movement-board)
4. [AIGC 故事版制作（Storyboard Production）](#4-aigc-故事版制作storyboard-production)

---

## 1. AIGC 角色板（Character Board）

### 1.1 角色板的核心要素

AI漫剧的角色板是保证角色形象统一的核心参考文件，包含以下关键要素：

**（1）角色三视图（Turnaround）**
- 正面（Front）、侧面（Side/Profile）、背面（Back/Three-quarter Back）
- 45° 半侧面（Three-quarter View）——实际漫剧中最常用的角度
- 俯视/仰视角度示意（High/Low Angle References）

**（2）表情集（Expression Sheet）**
- 基础六情：喜（Happy）、怒（Angry）、哀（Sad）、乐（Joy）、惊（Surprise）、惧（Fear）
- 微表情扩展：疑惑（Confused）、害羞（Shy）、尴尬（Awkward）、得意（Smug）、不屑（Sneer）、沉思（Pensive）
- 极端表情：大笑（Laughing）、崩溃（Crying）、暴怒（Furious）、惊恐（Terrified）
- 嘴型参考：A/E/I/O/U 基础口型（为配音对口型准备）

**（3）服饰设定（Costume Design）**
- 主要服装：常服（Casual）、战斗服（Battle）、礼服（Formal）
- 配饰清单：头饰、眼镜、项链、戒指、武器等
- 服饰细节：材质（丝绸/皮革/金属/棉麻）、图案、褶皱方向
- 季节/场景变体：夏装、冬装、雨装、睡衣等

**（4）配色方案（Color Palette）**
- 主色（Primary）：角色标志性颜色，通常 2-3 色
- 辅色（Secondary）：点缀色，1-2 色
- 肤色（Skin Tone）：包含高光、中间调、阴影三个层次
- 发色（Hair Color）：包含发根、发中、发梢渐变
- 眼色（Eye Color）：包含虹膜主色、渐变、高光点

**（5）体态特征（Body & Silhouette）**
- 身高比例（头身比，如 5 头身/Q 版 2 头身）
- 体型特征（纤细/健壮/丰满）
- 标志性姿态（Signature Pose）：角色常出现的站姿/坐姿/手势
- 剪影识别度（Silhouette Test）：黑白剪影是否可辨认

**（6）角色设定说明（Character Bio）**
- 姓名、年龄、职业、性格标签
- 气质关键词（如：冷峻/阳光/神秘/飒爽）

### 1.2 常见风格与制作流程

**风格分类：**
| 风格 | 特点 | 适用场景 |
|------|------|----------|
| 日系二次元（Anime） | 大眼睛、简化鼻嘴、高光发 | 少女漫、热血漫 |
| 韩系厚涂（Semi-Realistic） | 细腻光影、真实比例 | 言情漫、都市漫 |
| 国风（Chinese Style） | 水墨线条、古风配色 | 仙侠、古风 |
| 美式卡通（Cartoon） | 夸张比例、粗线条 | 搞笑漫、儿童向 |
| 写实（Realistic） | 照片级细节 | 悬疑、纪实 |

**制作流程（5步法）：**

1. **概念草图**：用 Midjourney/DALL·E 生成风格探索图 → 选定方向
2. **正稿生成**：用 Stable Diffusion + ControlNet（Canny/Lineart）精修细节
3. **多视图生成**：使用 Consistent Character Gen（如 Character Consistency SD 插件）批量生成三视图
4. **表情包制作**：用 IP-Adapter + Face ID 保持面部一致，替换表情关键词
5. **整合排版**：整理成角色板文档（PS/Canva/Figma 均可）

### 1.3 主流工具与提示词技巧

**工具矩阵：**

| 工具 | 用途 | 推荐理由 |
|------|------|----------|
| Midjourney V6 | 角色概念探索 | 风格化能力强，适合初期探索 |
| Stable Diffusion XL | 精细控制 | ControlNet/IP-Adapter 生态丰富 |
| ComfyUI | 工作流编排 | 节点式管理，可复用角色工作流 |
| DALL·E 3 | 快速原型 | 理解自然语言好，适合非专业用户 |
| Fooocus | 一键出图 | SD 简化版，上手快 |
| Character Consistency SD | 角色一致性 | 专门插件，支持多人同框 |

**提示词模板：**

```
# 三视图提示词
character turnaround sheet, front view, side view, back view,
[character description: e.g. young female warrior, long silver hair, blue eyes],
[style: anime style / semi-realistic / watercolor style],
[outfit: detailed armor with gold trim, flowing cape],
uniform lighting, clean background, character sheet layout,
--ar 3:4 --nij 5

# 表情集提示词
character expression sheet, [character name], [same character],
6 expressions: [happy, angry, sad, surprised, scared, neutral],
consistent facial features, same hairstyle,
[style descriptor], grid layout, simple background
```

**关键提示词技巧：**
- **种子固定法**：找到满意角色图后锁定 `--seed` 参数
- **参考图法**：使用 `--sref`（Midjourney）或 Reference Only（SD）注入角色特征
- **权重控制**：`(character feature:1.3)` 强调关键特征
- **负提示词**：加 `extra limbs, distorted face, different person` 防止变异

### 1.4 角色一致性解决方案

**方案一：LoRA 微调（推荐，质量最高）**
1. 收集 10-20 张同一角色多角度、多表情的图
2. 使用 Kohya SS / AI Toolkit 训练角色 LoRA（约 30 分钟）
3. 在生成时调用 LoRA 权重：`<lora:char_name:0.8>`

**方案二：InstantID / IP-Adapter**
- 输入 1 张角色面部参考图
- 通过 IP-Adapter Face ID 保持面部一致性
- 适合不需要训练的场景

**方案三：Midjourney 角色参考（--cref）**
- MJ V6 支持 `--cref URL` 参数直接引用角色
- 配合 `--cw 100`（特征权重）使用
- 简单快捷，但复杂场景可能不稳定

**方案四：ComfyUI 工作流**
- 搭建 Node 工作流，串联 IP-Adapter + ControlNet + LoRA
- 一次性输出同一角色的多角度、多表情
- 可保存为 JSON 模板反复使用

---

## 2. AIGC 场景板（Scene Board）

### 2.1 场景板的构成要素

场景板是漫剧的"舞台设计图"，包含：

**（1）环境氛围（Environment & Atmosphere）**
- 地点标识：室内/室外/抽象空间
- 时代背景：古代/现代/未来/架空
- 季节与时间：春夏秋冬、晨午暮夜
- 天气与气候：晴天/阴天/雨/雪/雾/沙暴
- 氛围关键词：温馨/压抑/开阔/神秘/紧张

**（2）光影设计（Lighting Design）**
- 光源类型：
  - 自然光：日光（暖/冷）、月光（冷蓝）、黄昏（金橙）
  - 人工光：烛光（暖黄）、霓虹灯（彩色）、荧光灯（冷白）
  - 戏剧光：顶光（神秘/压抑）、侧光（立体/戏剧性）、逆光（剪影/神圣）
- 光影风格：
  - 平光（Flat）：日漫常见，均匀明亮
  - 强对比（High Contrast）：黑白漫/悬疑
  - 柔光（Soft）：言情/回忆
  - 点光源（Spotlight）：聚焦重要场景

**（3）构图与空间（Composition & Space）**
- 透视类型：一点透视/两点透视/三点透视/鱼眼透视
- 景深层次：前景（Foreground）、中景（Midground）、背景（Background）
- 视觉引导线：道路、河流、建筑线条引导视线
- 留白设计：东方美学特色，营造呼吸感

**（4）色彩方案（Color Script）**
- 场景主色调：每个场景设定 1-2 个主导色
- 情绪色板映射：
  - 红色系：愤怒、激情、危险
  - 蓝色系：冷静、悲伤、科技感
  - 黄色系：温暖、希望、疯狂
  - 绿色系：平静、自然、不安
  - 紫色系：神秘、高贵、梦幻
  - 灰色系：压抑、迷茫、末日
- 对比色搭配：主色 + 互补色点缀

**（5）场景细节（Scene Details）**
- 道具清单：每个场景中的关键道具
- 材质表现：木质/金属/玻璃/布料/水面
- 特效元素：光晕、粒子、烟雾、倒影
- 背景人群/生物（如适用）

### 2.2 不同场景类型的 AIGC 制作要点

**室内场景：**
```
关键词：interior room, [room type: bedroom/kitchen/library],
[style: cozy/modern/rustic], warm lighting, window with curtains,
wooden furniture, depth of field, clutter details,
--ar 16:9
```
- 要点：注意透视准确性（ControlNet MLSD 辅助）、光源一致性
- 难点：室内家具排列的逻辑性（AI 容易生成不合理布局）
- 解决：使用 MLSD 线稿约束 + 语义分割图

**室外场景：**
```
关键词：outdoor landscape, [city street / forest / beach],
golden hour lighting, atmospheric perspective,
detailed foliage, depth, wide angle,
--ar 16:9
```
- 要点：大气透视（远处虚化+偏蓝）、地面纹理细节
- 难点：远景一致性（前后场景衔接）
- 解决：统一色调映射 + 场景种子管理

**奇幻场景：**
```
关键词：fantasy realm, floating islands, glowing crystal,
purple and blue color palette, magical atmosphere,
bioluminescent flora, misty clouds, epic scale,
--ar 16:9 --stylize 300
```
- 要点：创意度要高、光影要有戏剧性
- 难点：保持风格一致性（奇幻元素的统一设计语言）
- 解决：先做概念设计板（Mood Board），再用 IP-Adapter 统一风格

**现实场景：**
```
关键词：realistic, photorealistic, [city name / location],
natural lighting, accurate proportions, minimal stylization,
--ar 16:9
```
- 要点：参考真实照片，追求真实感
- 难点：人物与场景的融合（避免"贴图感"）
- 解决：ControlNet Depth 做人物与场景的空间融合

### 2.3 场景风格统一的方法

**方法一：场景种子库（Seed Bank）**
- 为每个场景类型分配一个固定 `--seed` 范围
- 同一场景的不同镜头使用相近种子（seed ±1~5）
- 记录种子与对应场景的映射表

**方法二：调色板约束（Color Palette Lock）**
- 使用 Adobe Color / Coolors 生成场景色板
- 在提示词中显式写入主色调：`(color palette: deep blue, amber, warm gold)`
- SD 中可以使用 Color Palette ControlNet 约束色彩

**方法三：风格 LoRA**
- 训练场景风格 LoRA（20 张同风格场景图）
- 调用权重 `0.6~0.8` 保持风格统一
- 场景 LoRA + 角色 LoRA 可同时加载

**方法四：IP-Adapter 风格参考**
- 用 1 张"场景风格参考图"注入 IP-Adapter
- 所有场景生成时加载同一张参考图
- 保证色调、光影、画风高度一致

**方法五：后期统一调色**
- 所有生成图导入 Lightroom / DaVinci Resolve
- 批量套用同色调预设（LUT）
- 微调曝光、对比度、色温

---

## 3. AIGC 分镜运镜板（Storyboard & Camera Movement Board）

### 3.1 分镜脚本的 AIGC 实现方法

**从文字到分镜的转换过程：**

```
[剧本段落] → [分镜描述] → [AI提示词] → [生成画面]
```

**分镜描述结构（标准模板）：**

```
镜头 #[编号] | [景别] | [运镜方式] | [时长]

画面描述：[角色/场景/动作的详细描述]
对白：[角色说的话 / 旁白]
音效：[环境音/特效音]
情绪：[该镜头的情绪基调]
```

**AI 分镜生成流程：**

1. **分镜拆解**：将剧本按镜头拆解为分镜段落
2. **提示词组装**：将分镜要素转化为 AI 提示词
3. **批量生成**：使用 ComfyUI 批量工作流生成
4. **筛选排序**：从候选图中选择最佳镜头
5. **排版输出**：制作分镜板文档

**提示词模板（分镜版）：**

```
storyboard frame, [shot type: wide shot / medium shot / close-up],
[scene description], [character description], [action/pose],
[lighting], [mood: tense / romantic / sad],
rough sketch style, blue pencil, storyboard aesthetic,
--ar 16:9 --stylize 150
```

### 3.2 常见运镜方式的 AI 描述与生成

| 运镜方式 | 中文名 | AI 描述关键词 | 提示词示例 |
|----------|--------|---------------|-----------|
| Push In / Dolly In | 推 | `dolly zoom in`, `camera slowly approaching`, `increasing intimacy` | camera pushes in towards character's face, dolly zoom effect, intimate close-up |
| Pull Out / Dolly Out | 拉 | `dolly zoom out`, `camera pulling away`, `revealing scale` | camera pulls out from close-up to wide shot, revealing the vast landscape |
| Pan | 摇 | `panning camera`, `horizontal camera movement` | camera panning left to right, following the character's movement |
| Tilt | 仰/俯 | `tilt up / tilt down`, `vertical camera movement` | camera tilting up from ground to reveal tall building |
| Track / Follow | 跟 | `tracking shot`, `following camera`, `side tracking` | tracking shot, camera follows character running through corridor |
| Truck | 移 | `trucking shot`, `camera moving parallel` | trucking shot, camera moves parallel to the action |
| Crane / Boom | 升降 | `crane shot`, `camera rising`, `elevating view` | crane shot, camera rising from ground level to bird's eye view |
| Arc / Orbit | 环绕 | `orbit shot`, `circular camera movement`, `360 around subject` | camera orbiting around the character, 360 degree rotation |
| Handheld | 手持 | `handheld camera`, `shaky camera`, `documentary style` | handheld camera movement, shaky, documentary feel, raw |
| Steadicam | 稳定器 | `steadicam shot`, `smooth following`, `floating camera` | smooth steadicam shot, gliding through the environment |

**运镜描述的提示词技巧：**

- **动感强化**：加 `motion blur`, `cinematic camera movement`, `dynamic composition`
- **镜头焦段**：`24mm wide angle` / `50mm standard` / `85mm portrait` / `200mm telephoto`
- **景深控制**：`shallow depth of field (f/1.8)` / `deep focus (f/16)`
- **镜头语言标记**：`POV shot`（主观视角）/ `Over-the-shoulder shot`（过肩镜头）/ `Two-shot`（双人镜头）

### 3.3 镜头语言与情绪表达

**景别与情绪对应：**

| 景别 | 英文 | 情绪/功能 | AI 提示词 |
|------|------|-----------|-----------|
| 大远景 | Extreme Wide Shot (EWS) | 渺小、壮阔、孤独 | `extreme wide shot, tiny figure against vast landscape` |
| 远景 | Wide Shot (WS) | 交代环境、位置关系 | `wide shot, character standing in the middle of the room` |
| 全景 | Full Shot (FS) | 完整人物、动作展示 | `full body shot, character walking confidently` |
| 中景 | Medium Shot (MS) | 对话、日常互动 | `medium shot, two characters talking, waist up` |
| 中近景 | Medium Close-up (MCU) | 情绪过渡、强调表情 | `medium close-up, chest up, character showing concern` |
| 特写 | Close-up (CU) | 情感爆发、关键细节 | `close-up on face, tears streaming down` |
| 大特写 | Extreme Close-up (ECU) | 极度紧张、强调细节 | `extreme close-up on eyes, pupil dilating` |

**镜头角度与情绪：**

| 角度 | 英文 | 情绪效果 | AI 提示词 |
|------|------|----------|-----------|
| 平视 | Eye Level | 中立、平等、客观 | `eye level shot, neutral perspective` |
| 俯视 | High Angle | 弱势、渺小、被监视 | `high angle shot, looking down at character` |
| 仰视 | Low Angle | 强大、压迫、崇高 | `low angle shot, looking up at towering figure` |
| 鸟瞰 | Bird's Eye | 上帝视角、命运感 | `bird's eye view, top down, characters as small dots` |
| 荷兰角 | Dutch Angle | 不安、混乱、疯狂 | `dutch angle shot, tilted camera, unsettling mood` |
| 过肩镜头 | Over-the-Shoulder (OTS) | 对话参与感 | `over the shoulder shot, focusing on speaker` |
| 主观视角 | Point of View (POV) | 代入感、第一人称 | `POV shot, seeing through character's eyes` |

### 3.4 分镜连贯性控制

**关键挑战与解决方案：**

**挑战 1：角色在相邻镜头间变化**
- 解决：镜头序列生成时保持相同 seed + 角色 LoRA 加载
- 技巧：相邻镜头使用 `--cref` 同一张参考图

**挑战 2：场景切换生硬**
- 解决：加入过渡镜头（B-Roll、空镜、细节特写）
- 技巧：匹配前后镜头的色调（Color Grading 统一）

**挑战 3：动作不连贯**
- 解决：使用"动作链"提示词（action sequence）
- 技巧：`[action step 1] -> [action step 2] -> [action step 3]` 连续生成

**挑战 4：视线方向不一致**
- 解决：在提示词中显式标注视线方向
- 技巧：`character looking [left/right/up/down/directly at camera]`

**分镜连贯性检查清单：**
- [ ] 相邻镜头角色特征是否一致？
- [ ] 场景色调是否连续变化而非跳跃？
- [ ] 角色视线方向是否符合对话逻辑？
- [ ] 动作方向是否连贯（从左到右/从右到左）？
- [ ] 镜头距离变化是否符合节奏设计？
- [ ] 180 度规则是否遵守（对话场景）？

---

## 4. AIGC 故事版制作（Storyboard Production）

### 4.1 从剧本到故事版的完整 AIGC 流程

**六步工作流：**

```
Step 1: 剧本分析
  ├─ 提取关键场景、角色、动作
  ├─ 标注情绪曲线
  └─ 输出：剧本分析表
        │
Step 2: 分镜拆解
  ├─ 按镜头切分（平均 3-8 秒/镜头）
  ├─ 标注景别 + 运镜 + 时长
  └─ 输出：分镜脚本表
        │
Step 3: 提示词工程
  ├─ 组装场景提示词 + 角色提示词
  ├─ 注入风格参考
  └─ 输出：提示词批次文件 (JSON/CSV)
        │
Step 4: 批量生成
  ├─ ComfyUI / Automatic1111 批量运行
  ├─ 每镜头生成 3-5 个候选
  └─ 输出：候选图集
        │
Step 5: 筛选与排序
  ├─ 按构图/表情/一致性评分
  ├─ 选中最佳 → 标记镜头编号
  └─ 输出：初版故事板
        │
Step 6: 后期合成
  ├─ 排版（分镜板格式）
  ├─ 标注对白 + 音效
  ├─ 加入时间轴标记
  └─ 输出：完整故事板 PDF/PPT
```

### 4.2 画面节奏控制

**节奏设计原则：**

**（1）镜头时长规律**
- 快节奏（动作/紧张）：1-3 秒/镜头
- 中节奏（对话/叙事）：3-6 秒/镜头
- 慢节奏（抒情/氛围）：6-12 秒/镜头

**（2）景别变化节奏**
- 递增式：WS → MS → CU → ECU（逐渐聚焦，制造紧张）
- 递减式：ECU → CU → MS → WS（逐渐拉开，制造释放）
- 跳跃式：WS → ECU（强烈视觉冲击）
- 平稳式：MS → MS → MS（对话场景，减少视觉疲劳）

**（3）AI 提示词中的节奏控制**

快节奏动作场景：
```
fast-paced action sequence, rapid cuts,
wide shot of explosion → medium shot of character dodging → close-up of intense expression,
dynamic composition, motion blur, high contrast lighting
```

慢节奏抒情场景：
```
slow-paced emotional sequence, lingering shots,
wide shot of sunset landscape → medium shot of character sitting alone → close-up of tears,
soft lighting, warm tones, gentle atmosphere
```

**（4）视觉节拍标记**

在分镜表中添加视觉节拍标记：
- 🟢 **建立镜头**：交代环境/角色
- 🟡 **推进镜头**：推动剧情/情绪
- 🔴 **高潮镜头**：剧情/情绪顶点
- 🔵 **过渡镜头**：场景/情绪转换
- ⚪ **空镜头**：氛围/留白

### 4.3 文字转分镜的提示词工程

**提示词工程核心策略：**

**策略一：结构化提示词（Structured Prompt）**

```
[STYLE] cinematic anime style, key visual quality
[SCENE] abandoned train station at night, rain, neon lights reflecting on wet ground
[CHARACTER] young man in black coat, umbrella, looking up
[SHOT] low angle medium shot, rain falling on camera lens
[LIGHTING] dramatic side lighting from neon sign, blue and pink tones
[MOOD] lonely, mysterious, anticipation
[CAMERA] slight handheld movement, rain particle effects
```

**策略二：模板化组装（Template Assembly）**

创建 JSON 模板批次文件：
```json
[
  {
    "id": "SC01_SH01",
    "scene": "abandoned train station, night, rain",
    "shot": "wide shot",
    "camera": "crane shot descending",
    "character": "young man in black coat entering frame",
    "lighting": "neon blue and pink",
    "mood": "lonely mysterious",
    "style": "cinematic anime, high detail",
    "negative": "blurry, low quality, distorted face"
  },
  {
    "id": "SC01_SH02",
    "scene": "same station, platform area",
    "shot": "medium close-up",
    "camera": "push in slowly",
    "character": "young man's face, rain on face, looking up",
    "lighting": "neon light reflecting in eyes",
    "mood": "anticipation, tension",
    "style": "cinematic anime, high detail",
    "negative": "blurry, low quality, distorted face"
  }
]
```

**策略三：ControlNet 引导（Guidance Engineering）**
- **Canny Edge**：控制构图/轮廓，适合保持场景结构
- **Depth Map**：控制空间关系，适合多人/多物体场景
- **OpenPose**：控制角色姿态，适合动作场景
- **MLSD**：控制透视/建筑线条，适合室内场景
- **Lineart Anime**：控制线条风格，适合二次元风格
- **IP-Adapter**：控制整体风格/角色面部

**策略四：提示词链（Prompt Chaining）**

```
[场景提示词] + [角色提示词] + [镜头提示词] + [风格提示词] + [质量提示词]
```

质量提升后缀（Quality Boosters）：
```
masterpiece, best quality, highly detailed, 8k, cinematic lighting,
professional color grading, sharp focus, intricate details
```

### 4.4 批量生成与质量控制

**批量生成方案：**

**方案 A：ComfyUI 批量工作流**
- 使用 `Batch Prompt Schedule` 节点加载 JSON 批次
- 串联 ControlNet + IP-Adapter + LoRA
- 自动保存为编号文件
- 工作流可复用，修改批次 JSON 即可

**方案 B：Automatic1111 脚本**
- 使用 `X/Y/Z Plot` 脚本批量测试参数
- 使用 `Prompt Batch` 脚本批量生成
- 配合 `Wildcard` 脚本随机变化

**方案 C：API 批量调用**
```python
# 伪代码示例
for shot in storyboard_shots:
    prompt = assemble_prompt(shot)
    response = sd_api.txt2img(
        prompt=prompt,
        negative_prompt=negative_prompt,
        seed=base_seed + shot.id,
        batch_size=4  # 每镜头 4 个候选
    )
    save_images(response, f"output/{shot.id}")
```

**质量控制体系：**

**（1）自动质量评分**
- CLIP Score：提示词-图像匹配度（>0.3 及格）
- BRISQUE：图像质量评分（<40 为高质量）
- Face Detection：确保人脸完整
- Blur Detection：排除模糊图

**（2）人工筛选标准**
```
✅ 通过标准：
- 角色特征与角色板一致
- 场景符合场景板设定
- 构图符合分镜描述
- 情绪传达准确
- 画面无明显畸形/崩坏

❌ 淘汰标准：
- 角色变脸/崩脸
- 透视严重错误
- 构图偏离分镜要求
- 画面模糊/低分辨率
- 情绪基调不对
```

**（3）版本管理**
- 每版故事板保存为 v1/v2/v3 版本
- 使用 Git LFS 管理大图文件
- 关键帧标记：⭐ 必选帧 / 📌 可选帧 / ❌ 废弃帧

**（4）效率优化建议**

| 阶段 | 时间占比 | 优化策略 |
|------|----------|----------|
| 剧本分析 | 10% | AI 辅助分析（GPT/Claude） |
| 分镜拆解 | 20% | 分镜模板 + 快捷键 |
| 提示词工程 | 15% | 提示词库复用 + 模板化 |
| 批量生成 | 30% | ComfyUI 自动化 + GPU 队列 |
| 筛选排序 | 15% | 自动评分 + 批量预览 |
| 后期合成 | 10% | 故事板模板 + 自动排版 |

**常用工具清单：**

| 工具 | 用途 | 类型 |
|------|------|------|
| Storyboarder (Wonder Unit) | 手绘分镜 + 时间轴 | 免费桌面端 |
| Boords | 在线分镜协作 | 付费 Web |
| Canva | 故事板排版 | 免费/付费 Web |
| ComfyUI | AI 批量生成 | 免费开源 |
| Automatic1111 | SD WebUI | 免费开源 |
| Fooocus | 简易生成 | 免费开源 |
| ShotGrid (Autodesk) | 生产管理 | 企业级 |
| Frame.io | 审阅协作 | 付费 Web |

---

## 附录：关键术语速查

| 术语 | 英文 | 说明 |
|------|------|------|
| 角色板 | Character Board | 角色设定参考文件 |
| 场景板 | Scene Board | 场景设定参考文件 |
| 分镜板 | Storyboard | 镜头序列可视化 |
| 运镜 | Camera Movement | 镜头移动方式 |
| 景别 | Shot Size | 画面取景范围 |
| 镜头角度 | Camera Angle | 拍摄角度 |
| 情绪板 | Mood Board | 风格/氛围参考图集合 |
| 色彩脚本 | Color Script | 全片色调变化规划 |
| 三视图 | Turnaround | 角色前/侧/背视图 |
| LoRA | Low-Rank Adaptation | 轻量模型微调技术 |
| ControlNet | — | 条件控制生成网络 |
| IP-Adapter | — | 图像提示适配器 |
| 一致性 | Consistency | 角色/场景在镜头间保持一致 |

---

*学习笔记完成于 2026-06-06 · 持续更新中*
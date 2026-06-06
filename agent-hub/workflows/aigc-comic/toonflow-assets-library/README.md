# Toonflow 素材库

> 为 AI 漫剧制作的素材资产库，与 Toonflow 三层 Agent 架构对接
> 素材类型对齐 Toonflow 资产系统：role（角色）、scene（场景）、prop（道具）

## 目录结构

```
toonflow-assets-library/
├── README.md              ← 本文件
├── characters/            ← 角色素材库
│   ├── index.json         ← 角色索引
│   ├── templates/         ← 角色模板（三视图/表情集/服饰）
│   └── prompts/           ← 角色生成提示词库
├── scenes/                ← 场景素材库
│   ├── index.json         ← 场景索引
│   ├── templates/         ← 场景模板
│   └── prompts/           ← 场景生成提示词库
├── camera-moves/          ← 运镜动作素材库
│   ├── index.json         ← 运镜索引
│   ├── templates/         ← 运镜模板
│   └── prompts/           ← 运镜提示词库
└── props/                 ← 道具素材库
    ├── index.json         ← 道具索引
    ├── templates/         ← 道具模板
    └── prompts/           ← 道具生成提示词库
```

## 资产格式（对齐 Toonflow）

每个资产条目遵循 Toonflow 的资产信息格式：

```json
{
  "id": "C001",
  "type": "role | scene | prop",
  "name": "资产名称",
  "description": "详细描述",
  "tags": ["标签1", "标签2"],
  "prompt_template": "生成提示词模板",
  "image_ref": "参考图路径（可选）",
  "variations": ["变体1", "变体2"],
  "relations": ["关联资产ID列表"]
}
```

## 与 Toonflow 集成

素材库可通过以下方式接入 Toonflow：
1. **extractAssets API** — 从分镜脚本自动提取所需资产
2. **Production Agent** — 生成时自动匹配角色/场景/道具
3. **Supervision 层** — 检查资产一致性

详见各子目录的 index.json。

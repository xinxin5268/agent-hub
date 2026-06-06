# 角色素材库 - 提示词模板集（v2.0）

## 4视图生成模板

### 角色设计表（四视图合一）
```
Character design sheet of {角色名}, front view / back view / left profile / right profile,
wearing {服装},
{hair_style} {hair_color} hair, {skin_tone} skin, {eye_color} eyes,
consistent style, uniform lighting, clean grid layout, 4 views, 8k
```

### 单独正面
```
Front view of {角色名}, standing facing forward,
{hair_style} {hair_color} hair, {skin_tone} skin, {eye_color} eyes,
wearing {服装} with {配饰1}, {配饰2}, {配饰3},
full body, {style}, 8k, --ar 3:4
```

### 单独背面
```
Back view of {角色名}, standing with back to camera,
{hair_style} {hair_color} hair, {skin_tone} skin,
wearing {服装} showing back details,
full body, {style}, 8k, --ar 3:4
```

### 单独左侧/右侧面
```
[Left/Right] profile of {角色名}, standing in profile,
{hair_style} {hair_color} hair, {skin_tone} skin, {eye_color} eyes,
wearing {服装}, side silhouette,
full body, {style}, 8k, --ar 3:4
```

## 5表情生成模板

### 表情集（五格合一）
```
Expression sheet of {角色名}: {表情1} / {表情2} / {表情3} / {表情4} / {表情5},
same character, same outfit, same lighting, same angle,
{hair_style} {hair_color} hair, {skin_tone} skin,
facial expressions grid, 5 panels, consistent character design, 8k
```

### 各表情单独生成
```
Close-up portrait of {角色名}, {表情_keyword},
{hair_style} {hair_color} hair, {skin_tone} skin, {eye_color} eyes,
wearing {服装}, {style}, dramatic lighting, 8k, --ar 3:4
```

## 服装6配饰模板

### 服装展示
```
{角色名} wearing {服装套装名}:
{配饰1}, {配饰2}, {配饰3}, {配饰4}, {配饰5}, {配饰6},
full body, {style}, fashion illustration style, detailed accessories, 8k, --ar 3:4
```

### 配饰特写
```
Close-up details of {角色名}'s accessories:
focus on {配饰1}, {配饰2}, {配饰3},
showing textures and craftsmanship, {style}, macro details, 8k
```

## 角色一致性提示词结构

### 完整一致性关键词
```
{角色名}, {style},
{hair_style} {hair_color} hair, {skin_tone} skin, {eye_color} eyes,
[标志性服装+配饰],
consistent character design
```

### 不变要素（跨服装通用）
```
{角色名}, {hair_style} {hair_color} hair, {skin_tone} skin, {eye_color} eyes, {style}
```

## 肤色+发色+瞳色参考表

| 肤色 | 色值 | 描述关键词 |
|------|------|-----------|
| 白皙 | #f5e6d3 | fair skin, porcelain complexion |
| 小麦 | #e8c39e | wheatish skin, warm undertone |
| 古铜 | #c68e5b | bronze skin, sun-kissed |
| 苍白 | #f0ebe1 | pale skin, alabaster |
| 健康 | #ecc9a7 | healthy skin, natural glow |

| 发色 | 色值 | 描述关键词 |
|------|------|-----------|
| 墨黑 | #1a1a1a | jet black hair, raven black |
| 棕褐 | #4a3728 | chestnut brown hair |
| 银白 | #e8e8e8 | silver white hair, platinum |
| 金黄 | #d4a017 | golden blonde hair |
| 红褐 | #8b4513 | auburn hair |
| 蓝紫 | #4b0082 | blue-purple hair |

| 瞳色 | 描述关键词 |
|------|-----------|
| 深褐 | dark brown eyes |
| 墨黑 | black eyes |
| 琥珀 | amber eyes |
| 碧蓝 | azure blue eyes |
| 翠绿 | emerald green eyes |
| 银灰 | silver gray eyes |
| 异色瞳 | heterochromia, [left] and [right] eyes |

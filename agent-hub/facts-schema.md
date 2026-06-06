# facts.jsonl Schema — 15维事实快照

> 每章完成后更新 facts.jsonl，写入最新的状态快照。
> 下一章生成前，读取最新一条快照作为上下文。

## 文件格式

JSONL（每行一个 JSON 对象），append-only。

## 记录类型

### 1. character — 角色状态

```json
{
  "type": "character",
  "name": "陆晨",
  "chapter": 5,
  "timestamp": "2147-08-15T22:00:00Z",
  "location": "深渊之城·控制中心",
  "status": "alive",
  "health": "normal",
  "mood": "determined",
  "relations": {
    "苏晚禾": "精神导师",
    "方铭": "对立"
  },
  "traits": {
    "appearance": { "height": "中", "build": "偏瘦", "hair": "黑短发", "eyes": "深褐" },
    "voice": "低沉，语速偏慢",
    "habit": "思考时转笔"
  },
  "inventory": ["神经接口", "加密终端"],
  "arc": "从封闭到开放的转变"
}
```

### 2. location — 地点状态

```json
{
  "type": "location",
  "name": "深渊之城·记忆库",
  "chapter": 5,
  "status": "active",
  "occupants": ["陆晨"],
  "state": "正常运行",
  "events": ["外部写入异常"]
}
```

### 3. timeline — 时间线

```json
{
  "type": "timeline",
  "chapter": 5,
  "currentDate": "2147-08-15",
  "daysElapsed": 3,
  "season": "夏",
  "weather": "模拟晴",
  "significantEvents": ["收到苏晚禾的第一段记忆"]
}
```

### 4. plot — 伏笔/情节状态

```json
{
  "type": "plot",
  "id": "plot-001",
  "name": "海底电缆信号源",
  "status": "open",
  "introducedChapter": 1,
  "expectedResolution": "chapter 8-10",
  "relatedCharacters": ["陆晨", "苏晚禾"],
  "notes": "信号来自废弃六十年的旧大陆遗址"
}
```

```json
{
  "type": "plot",
  "id": "plot-001",
  "name": "海底电缆信号源",
  "status": "resolved",
  "resolvedChapter": 9,
  "resolution": "发现苏晚禾的掩体"
}
```

### 5. faction — 势力关系

```json
{
  "type": "faction",
  "name": "深渊之城理事会",
  "chapter": 5,
  "leader": "方铭",
  "members": ["陆晨", "方铭"],
  "relations": {
    "地表幸存者": "敌对（官方立场）"
  },
  "state": "内部分裂"
}
```

### 6. theme — 主题状态

```json
{
  "type": "theme",
  "name": "记忆与存在的意义",
  "chapter": 5,
  "expression": "陆晨开始质疑记忆保存工作的本质",
  "development": "从技术执行到人文关怀的转变"
}
```

## 读取接口

```python
def get_latest_facts(facts_file='facts.jsonl'):
    """返回最新的完整快照"""
    facts = {
        'characters': {},
        'locations': {},
        'timeline': None,
        'plots': {},
        'factions': {}
    }
    with open(facts_file) as f:
        for line in f:
            entry = json.loads(line)
            t = entry['type']
            if t == 'character':
                facts['characters'][entry['name']] = entry
            elif t == 'location':
                facts['locations'][entry['name']] = entry
            elif t == 'timeline':
                facts['timeline'] = entry
            elif t == 'plot':
                facts['plots'][entry['id']] = entry
            elif t == 'faction':
                facts['factions'][entry['name']] = entry
    return facts
```

## 写入规范

- 每章完成后，写入该章的所有事实变化
- 只写变化的字段，不变的不写
- 时间线每章必写
- 伏笔引入/解决必写
- 角色位置变化必写
- 不写主观评价，只写客观事实
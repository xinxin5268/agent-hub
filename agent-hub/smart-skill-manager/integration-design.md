# Smart Skill Manager ↔ Behavior Engine 联动方案

## 联动流程

```
behavior-engine 生命周期:
  user_input
    │
    ├─ [onMessage] classifier 分拣
    │   ├─ 非 task → 聊天直接回复
    │   └─ 是 task → 触发 smart-skill-manager
    │
    ├─ [NEW] smart-skill-manager recommend
    │   ├─ 分析任务关键词 → 匹配三级技能
    │   ├─ 生成推荐清单（含匹配度）
    │   └─ 返回结构给 behavior-engine 展示
    │
    ├─ [onConfirm] confirmer
    │   ├─ 展示推荐清单
    │   ├─ 询问加载哪些推荐技能
    │   └─ 用户确认后调用 load
    │
    ├─ [preToolCall] guardian 安全拦截
    │
    ├─ [执行任务] 使用已加载的技能
    │
    └─ [onStepEnd] smart-skill-manager cleanup
        └─ 任务完成 → 清理未使用的 toolkit/scenario 技能
```

## classifier.py 新增接口

### 1. be-integrate 子命令 — 供 behavior-engine 调用

```
python3 classifier.py be-integrate "写Python爬虫"
```

输出 JSON 结构（behavior-engine 可 parse）:
```json
{
  "task": "写Python爬虫",
  "is_task": true,
  "recommendations": {
    "core": ["behavior-engine", "taskpad"],
    "toolkit": [{"name": "cloakbrowser", "category": "网络工具", "score": 3}],
    "scenario": [{"name": "内容创作", "key": "content_creation", "based_on_categories": [], "score": 2, "skills": ["youtube", "songsee"]}]
  }
}
```

### 2. load 子命令 — 标记技能为已加载

```
python3 classifier.py load tdd debug cloack-browser
python3 classifier.py load --all     # 加载所有推荐的
```

写入 `workbench/_catalog/loaded_skills.json`。

### 3. cleanup 子命令 — 清理未使用技能

```
python3 classifier.py cleanup              # 清理全部 toolkit/scenario
python3 classifier.py cleanup --keep core  # 清理 toolkit/scenario，保留核心层
```

## AGENTS.md 注入块

```markdown
### smart-skill-manager（已安装 — 自动集成 behavior-engine）
behavior-engine 的 classifier 检测到任务后，自动调用 smart-skill-manager 推荐技能。
推荐清单在 confirmer 步骤展示，可多选加载。任务完成后自动清理未用技能。
```

### 4. suggest 子命令 — 主动晒清单

```
python3 classifier.py suggest
```

在 behavior-engine reporter 每次汇报完毕后调用 `suggest_active()`，将建议追加到消息末尾：

```
report 输出
  │
  └─ [消息末尾] ── suggest_active() 输出
      ├─ 当前已加载清单
      ├─ 💡 建议额外加载（同分类未加载技能）
      └─ 加载命令
```

## 环境变量

| 变量 | 效果 |
|------|------|
| `SKILL_MANAGER_DISABLE=true` | 关闭智能管理器 |
| `SKILL_MANAGER_AUTO_RECOMMEND=true` | 自动推荐 skill（默认开） |
| `SKILL_MANAGER_AUTO_CLEANUP=true` | 任务完成后自动清理未用 skill（默认开） |

---

## 跨 Agent 共享方案（WSL + Windows）

### 目标
小宝（WSL）装的 skill，小聪（Windows）也能用。skill 注册到同一份 registry，记忆各自隔离。

### 架构

```
~/.openclaw/workspace/workbench/_skills_registry/      ← 共享 registry 文件
  ├── registry.json             ← WSL + Windows 共用（客户端 PATH 共享）
  
~/.openclaw/workspace/skills/                          ← skill 文件目录
  ├── behavior-engine/
  ├── semgrep/
  └── ...（谁装都放这里，统一维护）

workbench/xiaobao/               ← 小宝私有（记忆/加载状态）
workbench/xiaocong/              ← 小聪私有（记忆/加载状态）
```

### registry.json 结构（共享）

```json
{
  "shared_at": "2026-05-19T02:24:00",
  "skills": {
    "behavior-engine": {
      "installed_by": "xiaobao",
      "available_to": ["*"],
      "description": "Agent 行为引擎"
    },
    "semgrep": {
      "installed_by": "xiaobao",
      "available_to": ["*"],
      "path": "/mnt/c/.../skills/semgrep",
      "description": "静态代码安全扫描"
    }
  }
}
```

### 改动最小方案

1. **registry.json 路径改到共享目录** — `WORKSPACE/workbench/_skills_registry/`
2. **classifier.py 加 --agent 参数** — 指定当前是哪个 Agent，读写对应的工作目录
3. **match/be-integrate 读共享 registry** — 所有 Agent 都能看到全部技能
4. **清理/加载状态隔离** — 各自写自己的 `loaded_<agent>.json`
5. **记忆强隔离** — 各自 `memory/` 目录物理路径不同

### 不需要改动

- skill 文件可以共存（同一份文件，WSL 和 Windows 都装同一份）
- 管理器代码结构不变（只是路径和 agent_id 参数）
- 记忆完全不共享（物理上就是隔离的）

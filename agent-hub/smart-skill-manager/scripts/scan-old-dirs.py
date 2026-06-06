#!/usr/bin/env python3
"""旧目录扫描器 — 发现未注册的技能

扫描 ~/.agents/skills/ 和 ~/.hermes/skills/，
发现 registry.json 中没有的新技能，输出待注册列表。

用法:
  python3 scan-old-dirs.py              # 扫描并输出 JSON
  python3 scan-old-dirs.py --register   # 自动添加到注册表
"""

import json
import sys
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent.parent.parent.parent
REGISTRY_PATH = BASE_DIR / "workbench" / "_catalog" / "registry.json"
HERMES_SKILLS = Path.home() / ".hermes" / "skills"
AGENTS_SKILLS = Path.home() / ".agents" / "skills"

def scan_dir(dir_path, source_name):
    """扫描目录，返回新技能列表"""
    if not dir_path.exists():
        return []
    
    new_skills = []
    for skill_dir in sorted(dir_path.iterdir()):
        if not skill_dir.is_dir():
            continue
        if skill_dir.name.startswith('.'):
            continue
        
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        
        # 读取 SKILL.md 前 200 字符作为 description
        desc = ""
        try:
            desc = skill_md.read_text(encoding="utf-8", errors="replace")[:200]
        except:
            desc = "(unreadable)"
        
        new_skills.append({
            "name": skill_dir.name,
            "path": str(skill_dir),
            "source": source_name,
            "description": desc,
            "size": skill_md.stat().st_size
        })
    
    return new_skills

def main():
    register = "--register" in sys.argv
    
    # 加载注册表
    if not REGISTRY_PATH.exists():
        print(f"❌ registry.json 不存在: {REGISTRY_PATH}", file=sys.stderr)
        sys.exit(1)
    
    with open(REGISTRY_PATH) as f:
        data = json.load(f)
    registered = set(data.get("skills", data).keys())
    
    # 扫描
    all_new = []
    for dir_path, source in [(HERMES_SKILLS, "hermes"), (AGENTS_SKILLS, "agents")]:
        found = scan_dir(dir_path, source)
        # 过滤已注册的
        new = [s for s in found if s["name"] not in registered]
        all_new.extend(new)
    
    if not all_new:
        print("✅ 无新技能需要注册")
        return
    
    print(f"发现 {len(all_new)} 个未注册技能:\n")
    for s in all_new:
        print(f"  - {s['name']}")
        print(f"    path: {s['path']}")
        print(f"    source: {s['source']}")
        print(f"    size: {s['size']} bytes")
        print(f"    desc: {s['description'][:80]}...")
        print()
    
    if register:
        # 添加到注册表
        skills = data.get("skills", data)
        for s in all_new:
            skills[s["name"]] = {
                "name": s["name"],
                "category": "未分类",
                "description": s["description"],
                "path": s["path"],
                "source": "auto-scanner",
                "ready": True,
                "requirements": {},
                "size": s["size"],
                "hash": "",
                "tags": [],
                "status": "active",
                "updated_at": datetime.utcnow().isoformat(),
                "last_agent": "smart-skill-manager",
                "tier": "unknown",
                "priority_score": 0,
                "triggers": [s["name"].replace("-", " ")],
                "tools": []
            }
        
        with open(REGISTRY_PATH, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ 已注册 {len(all_new)} 个技能到 registry.json")
        print("   请重新运行 generate-shared-index.py 更新索引")

if __name__ == "__main__":
    main()

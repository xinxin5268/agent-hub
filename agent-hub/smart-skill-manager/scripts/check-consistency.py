#!/usr/bin/env python3
"""共享索引一致性检查器

检查项：
1. registry.json hash vs 缓存 hash
2. registry.json skill_count vs 缓存 skill_count
3. SHARED_SKILLS_INDEX.md 是否存在且非空
4. 降级索引是否存在且非空
5. 旧目录扫描：是否有新技能未注册

用法:
  python3 check-consistency.py          # 全量检查
  python3 check-consistency.py --fix    # 自动修复（重新生成 + 更新缓存）
  python3 check-consistency.py --scan   # 仅旧目录扫描
"""

import json
import hashlib
import os
import sys
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent.parent.parent.parent
REGISTRY_PATH = BASE_DIR / "workbench" / "_catalog" / "registry.json"
INDEX_PATH = BASE_DIR / "workbench" / "_catalog" / "SHARED_SKILLS_INDEX.md"
CACHE_PATH = BASE_DIR / "workbench" / "_catalog" / ".cache" / "index-hash.json"
MINIMAL_PATH = BASE_DIR / ".config" / "skill-base-index.json"
OLD_DIR = Path.home() / ".agents" / "skills"

def calc_sha256(filepath):
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def check_registry():
    """检查 registry.json"""
    if not REGISTRY_PATH.exists():
        return False, f"❌ registry.json 不存在: {REGISTRY_PATH}"
    
    with open(REGISTRY_PATH) as f:
        data = json.load(f)
    
    skills = data.get("skills", data)
    count = len(skills)
    print(f"✅ registry.json: {count} skills")
    return True, f"OK ({count} skills)"

def check_cache():
    """检查缓存一致性"""
    if not CACHE_PATH.exists():
        return False, "⚠️  缓存不存在，需要重新生成"
    
    with open(CACHE_PATH) as f:
        cache = json.load(f)
    
    # 检查 hash
    current_hash = calc_sha256(REGISTRY_PATH)
    cached_hash = cache.get("hash", "")
    
    if current_hash != cached_hash:
        return False, f"⚠️  Hash 不匹配: {current_hash[:16]} vs {cached_hash[:16]}"
    
    # 检查 skill_count
    with open(REGISTRY_PATH) as f:
        data = json.load(f)
    skills = data.get("skills", data)
    
    if len(skills) != cache.get("skill_count", 0):
        return False, f"⚠️  Skill count 不匹配: {len(skills)} vs {cache.get('skill_count')}"
    
    print(f"✅ 缓存一致 (hash: {current_hash[:16]}...)")
    return True, "OK"

def check_index():
    """检查索引文件"""
    if not INDEX_PATH.exists():
        return False, "❌ SHARED_SKILLS_INDEX.md 不存在"
    
    size = INDEX_PATH.stat().st_size
    if size < 100:
        return False, f"⚠️  索引文件太小 ({size} bytes)，可能已损坏"
    
    print(f"✅ SHARED_SKILLS_INDEX.md: {size} bytes")
    return True, f"OK ({size} bytes)"

def check_minimal():
    """检查降级索引"""
    if not MINIMAL_PATH.exists():
        return False, "❌ 降级索引不存在"
    
    with open(MINIMAL_PATH) as f:
        minimal = json.load(f)
    
    if not minimal:
        return False, "⚠️  降级索引为空"
    
    print(f"✅ 降级索引: {len(minimal)} core skills")
    return True, f"OK ({len(minimal)} skills)"

def check_backup():
    """检查 L1 降级备份"""
    bak_path = REGISTRY_PATH.with_suffix(".json.bak")
    if not bak_path.exists():
        return False, "⚠️  registry.json.bak 不存在（L1 降级失效）"
    
    bak_size = bak_path.stat().st_size
    if bak_size < 100:
        return False, f"⚠️  registry.json.bak 太小 ({bak_size} bytes)"
    
    print(f"✅ registry.json.bak: {bak_size} bytes")
    return True, f"OK ({bak_size} bytes)"

def check_archive():
    """检查 L3 归档"""
    archive_dir = Path.home() / ".openclaw" / "workspace" / "memory" / "archive" / "skill-index"
    if not archive_dir.exists():
        return False, "⚠️  memory/archive/skill-index/ 不存在（L3 降级未配置）"
    
    latest_dir = archive_dir / "latest"
    if not latest_dir.exists():
        return False, "⚠️  memory/archive/skill-index/latest/ 不存在"
    
    print(f"✅ 归档快照存在: {archive_dir}")
    return True, f"OK"

def check_auto_skill_loader():
    """检查 auto-skill-loader 是否集成了触发链"""
    loader_path = Path.home() / ".openclaw" / "workspace" / "skills" / "auto-skill-loader" / "SKILL.md"
    if not loader_path.exists():
        return False, "⚠️  auto-skill-loader/SKILL.md 不存在"
    
    content = loader_path.read_text()
    if "shared_skill_index" not in content and "三层触发" not in content and "SHARED_SKILLS_INDEX" not in content:
        return False, "⚠️  auto-skill-loader 未集成共享索引触发链"
    
    print(f"✅ auto-skill-loader 已集成触发链")
    return True, f"OK"

def scan_old_dirs():
    """扫描旧目录中的新技能"""
    if not OLD_DIR.exists():
        print(f"ℹ️  旧目录不存在: {OLD_DIR}")
        return 0
    
    with open(REGISTRY_PATH) as f:
        data = json.load(f)
    skills = data.get("skills", data)
    registered_names = set(skills.keys())
    
    new_skills = []
    for skill_dir in OLD_DIR.iterdir():
        if not skill_dir.is_dir():
            continue
        if skill_dir.name.startswith('.'):
            continue
        
        # 检查是否有 SKILL.md
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.exists():
            continue
        
        name = skill_dir.name
        if name not in registered_names:
            new_skills.append({
                "name": name,
                "path": str(skill_dir),
                "size": skill_md.stat().st_size
            })
    
    if new_skills:
        print(f"\n⚠️  发现 {len(new_skills)} 个未注册技能:")
        for s in new_skills:
            print(f"   - {s['name']} ({s['size']} bytes)")
    else:
        print("\n✅ 旧目录同步完成，无新技能")
    
    return len(new_skills)

def main():
    fix = "--fix" in sys.argv
    scan = "--scan" in sys.argv
    check_only = not fix and not scan
    
    checks = []
    checks.append(("Registry", check_registry()))
    
    if check_only:
        checks.append(("Cache", check_cache()))
        checks.append(("Index", check_index()))
        checks.append(("Minimal", check_minimal()))
        checks.append(("Backup", check_backup()))
        checks.append(("Archive", check_archive()))
        checks.append(("AutoLoader", check_auto_skill_loader()))
    
    new_count = scan_old_dirs()
    
    # 汇总
    failed = [name for name, (ok, _) in checks if not ok]
    
    if failed:
        print(f"\n❌ 检查失败: {', '.join(failed)}")
        if fix:
            print("→ 正在重新生成索引...")
            import subprocess
            result = subprocess.run(
                [sys.executable, str(Path(__file__).parent / "generate-shared-index.py")],
                cwd=str(Path(__file__).parent.parent.parent.parent),
                capture_output=True, text=True
            )
            print(result.stdout)
            if result.returncode != 0:
                print(f"ERROR: {result.stderr}")
                sys.exit(1)
            print("✅ 索引已重新生成")
        sys.exit(1)
    else:
        print("\n✅ 所有检查通过")
        if new_count > 0 and not scan:
            print(f"⚠️  发现 {new_count} 个未注册技能，建议运行 --scan 查看")

if __name__ == "__main__":
    main()

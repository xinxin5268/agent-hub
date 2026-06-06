#!/usr/bin/env python3
"""Smart Skill Manager — 共享索引生成器 (v3.0)

从 registry.json 生成 SHARED_SKILLS_INDEX.md + 缓存 + 降级索引。

核心逻辑：
1. 读取 registry.json，先备份旧 registry.json → registry.json.bak
2. 按分类分组，语义化前缀分组（取技能名的语义前缀，非前3字符）
3. 分层输出：Core 全量、Tool 语义分组、Scene 分类名+触发词
4. 计算 SHA256 hash，写入缓存
5. 生成降级索引（仅 Core 层，~300 tokens）
6. 归档索引快照到 memory/archive/（L3 降级用）

用法：
  python3 generate-shared-index.py              # 全量生成
  python3 generate-shared-index.py --check      # 仅检查一致性
  python3 generate-shared-index.py --minimal    # 仅生成降级索引
  python3 generate-shared-index.py --dry-run    # 仅显示输出，不写文件
"""

import json
import hashlib
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime

# ── 路径配置 ──
BASE_DIR = Path(__file__).parent.parent.parent.parent
REGISTRY_PATH = BASE_DIR / "workbench" / "_catalog" / "registry.json"
INDEX_PATH = BASE_DIR / "workbench" / "_catalog" / "SHARED_SKILLS_INDEX.md"
CACHE_PATH = BASE_DIR / "workbench" / "_catalog" / ".cache" / "index-hash.json"
MINIMAL_PATH = BASE_DIR / ".config" / "skill-base-index.json"
BACKUP_ARCHIVE = BASE_DIR / "memory" / "archive"

# ── tier → 层级映射 ──
# Core: tier='core' — 始终加载
# Tool: tier='toolkit' — 关键词分组注入
# Scene: tier='unknown' — 运行时分类名匹配
CORE_TIERS = {"core"}

# 分组上限
MAX_SKILLS_PER_GROUP = 8

# ── 语义前缀映射 ──
# 将机械的前3字符分组改为语义前缀分组
SEMANTIC_PREFIXES = {
    "gitnexus-": "GitNexus",
    "agent-skill-": "AgentSkill",
    "openai-": "OpenAI",
    "openclaw-": "OpenClaw",
    "vercel-": "Vercel",
    "ctf-": "CTF",
    "hermes-": "Hermes",
    "apple-": "Apple",
    "qiaomu-": "QiaoMu",
    "security-": "Security",
    "scanning-": "Scanning",
    "implementing-": "Implementing",
    "migrate-to-": "Migration",
    "deploy-to-": "Deploy",
    "setup-": "Setup",
    "to-": "ToDo",
    "pr-": "PR",
    "dd-": "DD",
    "yc-": "YC",
    "cn-": "CN",
}

def load_registry():
    """加载注册表，返回 skills dict"""
    if not REGISTRY_PATH.exists():
        print(f"❌ 注册表不存在: {REGISTRY_PATH}", file=sys.stderr)
        sys.exit(1)
    with open(REGISTRY_PATH, "r") as f:
        data = json.load(f)
    return data.get("skills", {})

def calc_sha256(filepath):
    """计算文件 SHA256"""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def backup_registry():
    """L1 降级：写入前备份 registry.json → registry.json.bak"""
    if not REGISTRY_PATH.exists():
        return
    bak_path = REGISTRY_PATH.with_suffix(".json.bak")
    shutil.copy2(REGISTRY_PATH, bak_path)
    print(f"✅ 已备份注册表: {bak_path}")

def archive_snapshot():
    """L3 降级：归档索引快照到 memory/archive/"""
    archive_dir = BACKUP_ARCHIVE / "skill-index"
    archive_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    # 归档 registry.json
    if REGISTRY_PATH.exists():
        dst = archive_dir / f"registry-{timestamp}.json"
        shutil.copy2(REGISTRY_PATH, dst)

    # 归档 SHARED_SKILLS_INDEX.md
    if INDEX_PATH.exists():
        dst = archive_dir / f"index-{timestamp}.md"
        shutil.copy2(INDEX_PATH, dst)

    # 更新 latest 软链接
    latest_dir = archive_dir / "latest"
    if latest_dir.exists():
        shutil.rmtree(latest_dir)
    latest_dir.mkdir(parents=True, exist_ok=True)
    if REGISTRY_PATH.exists():
        shutil.copy2(REGISTRY_PATH, latest_dir / "registry.json")
    if INDEX_PATH.exists():
        shutil.copy2(INDEX_PATH, latest_dir / "SHARED_SKILLS_INDEX.md")

    # 清理 30 天前的归档
    cutoff = datetime.now().timestamp() - 30 * 86400
    for f in archive_dir.iterdir():
        if f.is_file() and f.stat().st_mtime < cutoff:
            f.unlink()

    print(f"✅ 已归档索引快照: {archive_dir}")

def get_semantic_group_key(name):
    """获取语义分组 key，而非简单前3字符"""
    # 优先匹配语义前缀映射
    for prefix, display in SEMANTIC_PREFIXES.items():
        if name.startswith(prefix):
            return display
    # 按第一个 - 之前的词分组
    if "-" in name:
        parts = name.split("-")
        if len(parts) >= 2:
            return parts[0]
    # 回退：取前 4 个字符
    return name[:4]

def group_skills(skills, category):
    """将技能按语义分组，每组 ≤ MAX_SKILLS_PER_GROUP 个"""
    skill_names = [s for s, info in skills.items() if info.get("category") == category]
    if not skill_names:
        return {}

    # 如果技能数 ≤ 8，直接作为一组
    if len(skill_names) <= MAX_SKILLS_PER_GROUP:
        return {category: skill_names}

    # 按语义前缀分组
    groups = {}
    for name in skill_names:
        key = get_semantic_group_key(name)
        if key not in groups:
            groups[key] = []
        groups[key].append(name)

    # 确保每组 ≤ 8，超过的拆子组
    result = {}
    for key, members in groups.items():
        if len(members) <= MAX_SKILLS_PER_GROUP:
            result[key] = members
        else:
            for i in range(0, len(members), MAX_SKILLS_PER_GROUP):
                chunk = members[i:i+MAX_SKILLS_PER_GROUP]
                sub_key = f"{key}-{i//MAX_SKILLS_PER_GROUP + 1}"
                result[sub_key] = chunk

    return result

def generate_index(skills):
    """生成 SHARED_SKILLS_INDEX.md 内容"""
    lines = []
    lines.append("# 共享技能索引 (Smart Skill Manager)")
    lines.append(f"version: 3.0")
    lines.append(f"generated_at: {datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')}")
    lines.append(f"total_skills: {len(skills)}")
    lines.append("")

    # ── Core 层（全量） ──
    lines.append("## Core（核心层 - 始终加载）")
    lines.append("> 核心层技能始终加载，不占「可选的」token 预算")
    lines.append("")
    core_skills = {s: info for s, info in skills.items() if info.get("tier") in CORE_TIERS}
    for name, info in sorted(core_skills.items()):
        desc = info.get("description", "")[:80]
        path = info.get("path", "")
        lines.append(f"- `{name}`: {desc} | path: `{path}`")
    lines.append("")

    # ── Tool 层（语义分组） ──
    lines.append("## Tool（工具层 - 按语义分组）")
    lines.append("> 工具层按语义分组注入，匹配后加载组内具体技能")
    lines.append("")
    non_core = {s: info for s, info in skills.items() if info.get("tier") not in CORE_TIERS}

    # 按分类分组
    category_groups = {}
    for name, info in non_core.items():
        cat = info.get("category", "other")
        if cat not in category_groups:
            category_groups[cat] = []
        category_groups[cat].append(name)

    for cat, members in sorted(category_groups.items()):
        groups = group_skills({n: {"category": cat} for n in members}, cat)
        lines.append(f"### {cat}")
        for group_name, members_list in groups.items():
            lines.append(f"- **{group_name}**: {', '.join(members_list)}")
        lines.append("")

    # ── Scene 层（分类名+触发词） ──
    lines.append("## Scene（场景层 - 分类名索引）")
    lines.append("> 场景层启动时不加载，运行时通过 auto-skill-loader 关键词匹配触发")
    lines.append("")
    scene_cats = sorted(set(info.get("category", "other") for info in non_core.values()))
    # 为每个 Scene 分类提供触发词建议
    scene_triggers = {
        "代码工具": "git, python, debug, deploy, review, ci",
        "安全工具": "vuln, scan, audit, firewall, secret, nmap",
        "其他工具": "dead-loop, delegation, message, deepseek",
        "AI Agent": "agent, skill, discover, research",
        "网络工具": "proxy, web, scrape, dns, curl",
        "DevOps": "docker, k8s, deploy, ci/cd",
        "工程开发": "code, setup, config, install",
        "技能管理": "skill, register, classify, manage",
        "金融": "trade, market, price, finance",
        "安全扫描": "semgrep, bandit, trivy, scan",
        "其他": "misc, other",
    }
    for cat in scene_cats:
        count = sum(1 for info in non_core.values() if info.get("category") == cat)
        triggers = scene_triggers.get(cat, "")
        line = f"- `{cat}` ({count} skills)"
        if triggers:
            line += f" — 触发词: {triggers}"
        lines.append(line)
    lines.append("")

    return "\n".join(lines)

def generate_minimal_index(skills):
    """生成降级索引（仅 Core 层，~300 tokens）"""
    minimal = {}
    for name, info in skills.items():
        if info.get("tier") in CORE_TIERS:
            minimal[name] = {
                "description": info.get("description", "")[:80],
                "path": info.get("path", "")
            }
    return minimal

def main():
    check_only = "--check" in sys.argv
    minimal_only = "--minimal" in sys.argv
    dry_run = "--dry-run" in sys.argv

    skills = load_registry()
    source_hash = calc_sha256(REGISTRY_PATH)
    mtime = os.path.getmtime(REGISTRY_PATH)
    skill_count = len(skills)

    # ── 检查一致性 ──
    if check_only:
        if CACHE_PATH.exists():
            with open(CACHE_PATH, "r") as f:
                cache = json.load(f)
            if cache.get("hash") == source_hash:
                print(f"✅ 索引一致 (hash: {source_hash[:12]}...)")
                print(f"   skills: {cache.get('skill_count', '?')}")
                return
            else:
                print(f"⚠️  索引不同步!")
                print(f"   当前 hash: {source_hash[:12]}")
                print(f"   缓存 hash: {cache.get('hash', '?')[:12]}")
                print(f"   需要重新生成索引")
                return

    # ── L1 降级：备份 ──
    backup_registry()

    # ── 生成索引 ──
    if not minimal_only:
        index_content = generate_index(skills)
        if dry_run:
            print(index_content)
            return
        INDEX_PATH.parent.mkdir(parents=True, exist_ok=True)
        INDEX_PATH.write_text(index_content, encoding="utf-8")
        print(f"✅ 已生成共享索引: {INDEX_PATH}")
        print(f"   技能数: {skill_count}")
        print(f"   Hash: {source_hash[:16]}...")

    # ── 生成缓存 ──
    if not minimal_only:
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        cache_data = {
            "hash": source_hash,
            "mtime": mtime,
            "skill_count": skill_count,
            "last_generated": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ")
        }
        with open(CACHE_PATH, "w") as f:
            json.dump(cache_data, f, indent=2)
        print(f"✅ 已更新缓存: {CACHE_PATH}")

    # ── 生成降级索引 ──
    minimal = generate_minimal_index(skills)
    if dry_run:
        print(json.dumps(minimal, indent=2, ensure_ascii=False))
        return
    MINIMAL_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MINIMAL_PATH, "w") as f:
        json.dump(minimal, f, indent=2, ensure_ascii=False)
    print(f"✅ 已生成降级索引: {MINIMAL_PATH}")
    print(f"   Core 技能数: {len(minimal)}")

    # ── L3 降级：归档快照 ──
    archive_snapshot()

if __name__ == "__main__":
    main()

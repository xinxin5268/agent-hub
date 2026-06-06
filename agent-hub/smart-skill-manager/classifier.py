#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能 Skill 分类分级分层管理器 v2
================================

功能：
  1. 扫描所有 SKILL.md，提取 name/description
  2. 三级分类：核心层(Core) / 工具层(Toolkit) / 场景层(Scenario)
  3. 智能分类（精确匹配 > 关键词 > 路径兜底）
  4. 生成 CURRENT_CATALOG.md（当前 Skill 清单目录）
  5. 根据任务描述推荐适配 Skill
  6. Agent 启动时自动调用

用法：
  python3 classifier.py                     # 扫描+分类+生成目录
  python3 classifier.py match "写Python爬虫" # 根据任务推荐 skill
  python3 classifier.py catalog              # 仅生成目录
  python3 classifier.py stats                # 统计
"""

import os
import sys
import json
import re
from datetime import datetime
from pathlib import Path

# Windows 兼容：fcntl 在 Windows 上不可用
try:
    import fcntl
    HAS_FLOCK = True
except ImportError:
    HAS_FLOCK = False

try:
    import jieba
    JIEBA_AVAILABLE = True
except ImportError:
    JIEBA_AVAILABLE = False

# ─── 配置 ─────────────────────────────────────────────
WORKSPACE = os.path.expanduser("~/.openclaw/workspace")
SKILL_DIRS = [
    os.path.join(WORKSPACE, "skills"),
    os.path.expanduser("~/.agents/skills"),
    os.path.expanduser("~/.hermes/hermes-agent/skills"),
]

# Windows 路径映射（WSL 和 Windows 共享技能目录）
if sys.platform == "win32":
    # Windows 本地路径：使用原始字符串避免转义
    SKILL_DIRS = [
        os.path.join(WORKSPACE, "skills"),
        os.path.expanduser(r"~\.agents\skills"),
        os.path.expanduser(r"~\.hermes\hermes-agent\skills"),
    ]
# 共享注册表目录（WSL 和 Windows 共用同一份 registry.json）
if sys.platform == "win32":
    # Windows 本地
    SHARED_CATALOG_DIR = os.path.join(
        os.path.expanduser(r"~\.openclaw"), "workspace", "workbench", "_catalog"
    )
else:
    # WSL/Linux：优先使用本地目录，Windows 共享目录作为备选
    SHARED_CATALOG_DIR = os.path.join(WORKSPACE, "workbench", "_catalog")
    win_shared = "/mnt/c/Users/Administrator/.openclaw/workspace/workbench/_catalog"

OUTPUT_DIR = SHARED_CATALOG_DIR
CORE_SKILLS_FILE = os.path.join(OUTPUT_DIR, "core-skills.json")
CATALOG_FILE = os.path.join(OUTPUT_DIR, "CURRENT_CATALOG.md")
REGISTRY_FILE = os.path.join(OUTPUT_DIR, "registry.json")
LOADED_SKILLS_FILE = os.path.join(OUTPUT_DIR, "loaded_skills.json")

# ─── 跨平台路径工具 ───────────────────────────────────

def normalize_path(path: str) -> str:
    r"""跨平台路径标准化
    
    WSL 和 Windows 共享文件时，路径格式可能不同：
    - WSL: /home/chenxin520/.openclaw/workspace/...
    - Windows: C:\Users\Administrator\.openclaw\workspace\...
    - WSL 访问 Windows: /mnt/c/Users/Administrator/...
    
    统一转换为 realpath 进行比较。
    """
    return os.path.realpath(path)


# ─── 三级分层定义 ─────────────────────────────────────

# 第一层：核心层 — 始终加载
# 默认核心层技能列表（可被 registry.json 或环境变量覆盖）
DEFAULT_CORE_SKILLS = [
    "behavior-engine",
    "taskpad",
    "taskflow",
    "skill-summoner",
    "vuln-scanner",
]

def get_core_skills(skills: list = None) -> dict:
    """动态获取核心层技能列表
    
    优先级：
    1. 环境变量 SKILL_MANAGER_CORE_SKILLS（逗号分隔）
    2. registry.json 中标记为 core 的技能
    3. 默认列表（仅当技能实际存在时）
    """
    # 尝试从环境变量读取
    env_cores = os.environ.get("SKILL_MANAGER_CORE_SKILLS", "")
    if env_cores:
        return {name: {"description": "", "tier": "core"} for name in env_cores.split(",") if name.strip()}

    # 尝试从 registry.json 读取
    try:
        with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
            registry = json.load(f)
        registry_cores = {}
        for name, info in registry.get("skills", {}).items():
            if info.get("tier") == "core":
                registry_cores[name] = {"description": info.get("description", ""), "tier": "core"}
        if registry_cores:
            return registry_cores
    except (IOError, json.JSONDecodeError):
        pass

    # 默认列表：仅返回实际存在的技能
    if skills:
        existing = {s["dir_name"] for s in skills}
        return {name: {"description": "", "tier": "core"} for name in DEFAULT_CORE_SKILLS if name in existing}
    # 如果没有传入 skills，尝试从 registry.json 读取已注册的技能
    try:
        with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
            if HAS_FLOCK:
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                registry = json.load(f)
            finally:
                if HAS_FLOCK:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        existing = set(registry.get("skills", {}).keys())
        return {name: {"description": "", "tier": "core"} for name in DEFAULT_CORE_SKILLS if name in existing}
    except (IOError, json.JSONDecodeError):
        pass
    # 最后才返回默认列表（可能包含不存在的技能）
    return {name: {"description": "", "tier": "core"} for name in DEFAULT_CORE_SKILLS}

# 第二层：工具层 — 按任务按需加载
# 分类优先级得分（高优先级可覆盖低优先级）
CATEGORY_PRIORITY = {
    "核心": 100,
    "安全工具": 80,
    "AI Agent": 75,
    "代码工具": 70,
    "DevOps": 60,
    "网络工具": 50,
    "数据处理": 40,
    "文档工具": 30,
    "其他工具": 10,
}

# 层级优先级得分
TIER_PRIORITY = {
    "core": 100,
    "toolkit": 50,
    "scenario": 30,
}


def get_priority_score(tier: str, category: str) -> int:
    """计算分类的优先级得分"""
    return TIER_PRIORITY.get(tier, 0) + CATEGORY_PRIORITY.get(category, 0)


TOOLKIT_CLASSIFICATION = {
    # 分类名 → (触发关键词, 技能前缀关键词)
    "代码工具": (["代码", "编码", "python", "typescript", "test", "debug", "重构", "review", "pr", "issue"],
                  ["tdd", "debug", "diagnose", "lint", "gitnexus", "triage", "to-issues", "to-prd", "code-review"]),
    "安全工具": (["安全", "扫描", "vuln", "audit", "nmap", "secret", "渗透", "漏洞", "firebase", "威胁", "threat", "trivy", "gitleaks", "bandit"],
                  ["semgrep", "gitleaks", "trivy", "nmap", "vuln-scanner", "firebase", "audit-website", "security",
                   "security-best-practices", "security-threat-model", "firebase-security-rules-auditor",
                   "implementing-secret-scanning-with-gitleaks", "scanning-docker-images-with-trivy",
                   "scanning-network-with-nmap-advanced", "pip-audit", "bandit", "convex-performance-audit"]),
    "网络工具": (["网络", "web", "浏览器", "http", "api", "请求", "爬虫", "抓取"],
                  ["cloakbrowser", "webhook", "web-fetch", "scrapling", "multi-search"]),
    "DevOps":   (["部署", "docker", "容器", "ci", "cd", "运维", "服务器", "nginx", "域名"],
                  ["docker", "deploy", "cli-proxy", "mihomo", "gateway", "nginx", "domain"]),
    "AI Agent": (["agent", "AI", "模型", "大模型", "autonomous", "orchestrator", "codex"],
                  ["codex", "claude-code", "opencode", "hermes", "orchestrator", "autonomous"]),
    "数据处理": (["数据分析", "数据", "csv", "json", "excel", "报表", "可视化", "chart"],
                  ["jupyter", "nano-pdf", "ocr", "data-science", "diagramming"]),
    "文档工具": (["文档", "报告", "论文", "writing", "阅读", "生成"],
                  ["nano-pdf", "ocr", "notion", "obsidian", "note-taking", "research-paper"]),
    "其他工具": (["其他", "通用", "misc", "other"], []),
}


# 第三层：场景层 — 按场景主题加载
# 场景层引用工具层分类（categories）+ 场景专有技能（skills）
# 不再重复列出工具层已有的技能名
SCENARIO_CLASSIFICATION = {
    "🎬 内容创作": {
        "key": "content_creation",
        "keywords": ["视频", "音频", "创作", "内容", "youtube", "media", "音乐"],
        "categories": [],
        "skills": ["youtube", "songsee", "manju-studio", "heartmula", "media", "video", "gifs"],
    },
    "📊 数据分析": {
        "key": "data_analysis",
        "keywords": ["数据分析", "数据", "分析", "报表", "统计", "图表"],
        "categories": ["数据处理"],
        "skills": ["multi-search-engine"],
    },
    "🛡️ 安全审计": {
        "key": "security_audit",
        "keywords": ["安全", "审计", "渗透", "扫描", "漏洞", "威胁", "合规", "密钥", "secret", "trivy", "gitleaks", "nmap"],
        "categories": ["安全工具"],
        "skills": ["security-best-practices", "security-threat-model", "firebase-security-rules-auditor"],
    },
    "🏢 办公文档": {
        "key": "office_docs",
        "keywords": ["文档", "笔记", "notion", "obsidian", "办公", "写作", "邮件"],
        "categories": ["文档工具"],
        "skills": ["email"],
    },
    "☁️ DevOps": {
        "key": "devops",
        "keywords": ["部署", "运维", "docker", "ci/cd", "服务器", "域名"],
        "categories": ["DevOps"],
        "skills": [],
    },
    "💬 社交营销": {
        "key": "social_marketing",
        "keywords": ["社交", "营销", "推广", "内容", "博客", "rss"],
        "categories": [],
        "skills": ["social-media", "blogwatcher", "feeds", "multi-search-engine"],
    },
    "🧪 科研": {
        "key": "research",
        "keywords": ["研究", "论文", "arxiv", "科研", "学术", "调研"],
        "categories": [],
        "skills": ["research", "arxiv", "blogwatcher", "multi-search-engine", "research-paper"],
    },
    "🏠 智能家居": {
        "key": "smart_home",
        "keywords": ["智能家居", "home", "家居", "自动化"],
        "categories": [],
        "skills": ["smart-home", "openhue"],
    },
    "🤖 AI Agent 模板库": {
        "key": "ai_agent_templates",
        "keywords": ["agent", "rag", "mcp", "template", "llm", "voice", "ai agent"],
        "categories": [],
        "skills": ["awesome-llm-apps"]
    },
    "🤖 Agent 角色": {
        "key": "agent_roles",
        "keywords": ["agent-role", "ceo", "coding", "debugging", "assistant", "gateway", "agent 角色"],
        "categories": [],
        "skills": ["ceo-agent", "coding-agent", "code-review-agent", "debugging-agent", "assistant-agent", "gateway-agent"]
    }

}


# ─── 扫描函数 ─────────────────────────────────────────

def scan_skills():
    """扫描所有 SKILL.md 文件，返回技能列表"""
    skills = []
    seen = set()

    for skill_dir in SKILL_DIRS:
        # Windows 兼容：使用 realpath 统一路径格式
        skill_dir = os.path.realpath(skill_dir)
        if not os.path.isdir(skill_dir):
            continue
        try:
            entries = os.listdir(skill_dir)
        except PermissionError:
            continue
        for name in entries:
            skill_path = os.path.realpath(os.path.join(skill_dir, name))
            skill_file = os.path.join(skill_path, "SKILL.md")
            if not os.path.isfile(skill_file):
                continue

            if skill_path in seen:
                continue
            seen.add(skill_path)

            desc = ""
            tags = []
            fm_name = name

            try:
                with open(skill_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read(2000)
            except IOError:
                continue

            fm = re.search(r'^---\n(.*?)\n---', content, re.DOTALL)
            if fm:
                fm_text = fm.group(1)
                desc_match = re.search(r'^description:\s*["\']?(.+?)["\']?\s*$', fm_text, re.MULTILINE)
                if desc_match:
                    desc = desc_match.group(1).strip()
                name_match = re.search(r'^name:\s*(.+)', fm_text, re.MULTILINE)
                if name_match:
                    fm_name = name_match.group(1).strip()
                tags_match = re.search(r'^tags:\s*\n((?:\s*-\s*.+\n?)*)', fm_text, re.MULTILINE)
                if tags_match:
                    tags = [t.strip().lstrip('- ').strip() for t in tags_match.group(1).split('\n') if t.strip().startswith('-')]

            skills.append({
                "name": fm_name,
                "dir_name": name,
                "path": skill_path,
                "description": desc,
                "tags": tags,
                "content": content,
    "🤖 Agent 角色": {
        "key": "agent_roles",
        "keywords": ["agent-role", "ceo", "coding", "debugging", "assistant", "gateway", "agent 角色"],
        "categories": [],
        "skills": ["ceo-agent", "coding-agent", "code-review-agent", "debugging-agent", "assistant-agent", "gateway-agent"],
    },

            })

    return skills


# ─── 分类函数 ─────────────────────────────────────────

def classify_skill(skill: dict) -> dict:
    """分类：核心层 / 工具层（场景层为工具层组合引用，不再单独分类）"""
    name = skill["name"].lower()
    dir_name = skill["dir_name"].lower()
    desc = skill["description"].lower()
    tags = [t.lower() for t in skill["tags"]]

    # 动态获取核心层技能列表
    core_skills = get_core_skills()
    if skill["dir_name"] in core_skills:
        return {"tier": "core", "category": "核心"}

    for cat, (_, prefixes) in TOOLKIT_CLASSIFICATION.items():
        for prefix in prefixes:
            if name.startswith(prefix) or dir_name.startswith(prefix):
                return {"tier": "toolkit", "category": cat}

    for cat, (keywords, _) in TOOLKIT_CLASSIFICATION.items():
        full_text = f"{name} {dir_name} {desc} {' '.join(tags)}"
        for kw in keywords:
            if kw in full_text:
                return {"tier": "toolkit", "category": cat}

    # 场景专有技能：分类为 toolkit + "场景层" 类别
    # 这样分类和推荐逻辑一致（都在工具层中）
    for scene_name, scene_config in SCENARIO_CLASSIFICATION.items():
        if skill["dir_name"] in scene_config.get("skills", []):
            return {"tier": "toolkit", "category": scene_name}

    return {"tier": "toolkit", "category": "其他工具"}


def get_indexed_skills_by_category(skills):
    """按分类索引技能 dir_name"""
    cat_map = {}
    for s in skills:
        c = classify_skill(s)
        if c["tier"] == "toolkit":
            cat = c["category"]
            if cat not in cat_map:
                cat_map[cat] = []
            cat_map[cat].append(s["dir_name"])
    return cat_map


def get_existing_dir_names(skills):
    """返回已扫描技能的 dir_name 集合"""
    return {s["dir_name"] for s in skills}


# ─── Emoji 清理辅助（Windows 兼容） ────────────────────

def _sanitize_scene_name(name: str) -> str:
    """去掉场景名的 emoji 前缀

    覆盖范围：
    - 主 emoji 区块 U+1F000-U+1FFFF
    - 符号区块 U+2600-U+27BF
    - 变体选择符 U+FE00-U+FE0F
    - 零宽连接符 U+200D（emoji 序列分隔符）
    """
    return re.sub(r'[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE00-\uFE0F\u200D]', '', name).strip()


# ─── 中文分词辅助 ──────────────────────────────────────

def tokenize(text: str) -> list:
    """分词：中文按 2-4 字词汇拆，英文按单词拆

    降噪策略：
    - 中文每 2 步滑动一次 2 字词组（减少 50% 噪音）
    - 保留 3-4 字完整词组（覆盖常见中文词汇）
    - 去重保留唯一 token（同一个词不重复出现）
    """
    if JIEBA_AVAILABLE:
        return list(jieba.cut(text.lower()))
    tokens = []
    seen = set()
    for chunk in re.findall(r'[\u4e00-\u9fff]+|[a-zA-Z0-9_]+', text.lower()):
        if re.match(r'[\u4e00-\u9fff]', chunk):
            chunk_len = len(chunk)
            if chunk_len <= 2:
                _add_token(chunk, tokens, seen)
                continue
            # 2字词组：每 2 步滑一次（减少重叠噪音）
            for i in range(0, chunk_len - 1, 2):
                _add_token(chunk[i:i+2], tokens, seen)
            # 4字词组：仅保留开头（避免"录扫描"类噪音）
            if chunk_len >= 4:
                _add_token(chunk[:4], tokens, seen)
        else:
            _add_token(chunk, tokens, seen)
    return tokens


def _add_token(token: str, tokens: list, seen: set):
    """添加 token，自动去重"""
    if token not in seen:
        seen.add(token)
        tokens.append(token)


# ─── 根据任务推荐 Skill ───────────────────────────────

def recommend_skills(task: str, skills: list):
    """根据任务描述推荐适配 Skill"""
    task_lower = task.lower()
    recommendations = {
        "core": [],
        "toolkit": [],
        "scenario": [],
    }

    existing = get_existing_dir_names(skills)
    cat_map = get_indexed_skills_by_category(skills)

    # 场景专有技能集合（用于后续场景层推荐）
    scene_specific_skills = {}
    for scene_name, scene_config in SCENARIO_CLASSIFICATION.items():
        for s in scene_config.get("skills", []):
            scene_specific_skills[s] = scene_name

    for skill in skills:
        classification = classify_skill(skill)
        tier = classification["tier"]
        name_lower = skill["name"].lower()
        dir_lower = skill["dir_name"].lower()

        if tier == "core":
            recommendations["core"].append(skill["dir_name"])
            continue

        cat = classification["category"]

        # 场景专有技能：分类为 toolkit + scene_name，但推荐时归入场景层
        if cat in scene_specific_skills:
            # 场景专有技能单独收集，稍后在场景层推荐中处理
            scene_name = cat
            if scene_name not in recommendations["scenario"]:
                recommendations["scenario"] = []
            # 场景专有技能先不加入 toolkit，留到场景层处理
            continue

        # 工具层技能：仅对 TOOLKIT_CLASSIFICATION 中的分类进行关键词匹配
        score = 0
        if cat in TOOLKIT_CLASSIFICATION:
            keywords, prefixes = TOOLKIT_CLASSIFICATION[cat]
            matched_kws = set()
            for kw in keywords:
                if kw in task_lower:
                    matched_kws.add(kw)
            score += len(matched_kws)
            for p in prefixes:
                if p in name_lower or p in dir_lower:
                    score += 1

        if skill["description"]:
            desc_lower = skill["description"].lower()
            desc_matches = set()
            for word in tokenize(task_lower):
                word = word.strip()
                if len(word) > 1 and word in desc_lower:
                    desc_matches.add(word)
            score += len(desc_matches)

        if score > 0:
            recommendations["toolkit"].append((skill["dir_name"], cat, score))

    for scene_name, scene_config in SCENARIO_CLASSIFICATION.items():
        matched_kws = set()
        for kw in scene_config["keywords"]:
            if kw in task_lower:
                matched_kws.add(kw)

        is_auto_match = False
        if not matched_kws:
            for toolkit_name, toolkit_cat, toolkit_score in recommendations["toolkit"]:
                if toolkit_cat in scene_config.get("categories", []):
                    matched_kws.add("auto")
                    is_auto_match = True
                    break

        if not matched_kws:
            continue

        score = len(matched_kws)
        if is_auto_match:
            score = 0.5

        # 场景层技能 = 工具层分类技能 + 场景专有技能
        scene_skill_set = set()

        # 1. 工具层分类技能
        for cat_name in scene_config.get("categories", []):
            if cat_name in cat_map:
                scene_skill_set.update(cat_map[cat_name])

        # 2. 场景专有技能（现在分类为 toolkit + scene_name）
        for extra_skill in scene_config.get("skills", []):
            if extra_skill in existing:
                scene_skill_set.add(extra_skill)

        # 去重：场景专有技能如果已在工具层推荐中，标记为重叠
        toolkit_recommended = {s[0] for s in recommendations["toolkit"]}
        scene_only_skills = scene_skill_set - toolkit_recommended
        scene_overlap_skills = scene_skill_set & toolkit_recommended

        if scene_only_skills or scene_overlap_skills:
            recommendations["scenario"].append(
                (scene_name, score, sorted(scene_only_skills), sorted(scene_overlap_skills))
            )

    max_recommend = int(os.environ.get("SKILL_MANAGER_MAX_RECOMMEND", "5"))
    toolkit_sorted = sorted(recommendations["toolkit"], key=lambda x: -x[2])
    scenario_sorted = sorted(recommendations["scenario"], key=lambda x: -x[1])
    recommendations["toolkit"] = toolkit_sorted[:max(5, max_recommend)]
    # 场景层 tuple: (name, score, only_skills, overlap_skills)
    recommendations["scenario"] = scenario_sorted[:max(3, max_recommend // 2)]

    return recommendations


# ─── 生成目录 ─────────────────────────────────────────

def generate_catalog(skills: list = None):
    """生成 CURRENT_CATALOG.md
    
    优先从 registry.json 生成（保证多 Agent 清单一致），
    如果 registry.json 不存在，则从本地扫描结果生成。
    """
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
    except IOError:
        pass

    # 优先从 registry.json 读取（多 Agent 共享清单）
    use_registry = False
    core_skills = []
    toolkit_skills = {}
    scenario_data = {}

    if skills is None:
        skills = scan_skills()

    # 尝试从 registry.json 读取（加文件锁）
    try:
        with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
            if HAS_FLOCK:
                fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                registry = json.load(f)
            finally:
                if HAS_FLOCK:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        if registry.get("skills"):
            use_registry = True
            # 从 registry 构建技能列表
            registry_skills = []
            for name, info in registry["skills"].items():
                if info.get("status") == "deleted":
                    continue
                registry_skills.append({
                    "name": info.get("name", name),
                    "dir_name": name,
                    "path": info.get("path", ""),
                    "description": info.get("description", ""),
                    "tags": info.get("tags", []),
                    "content": "",
                })
            skills = registry_skills

            # 按 registry 中的 tier/category 分类
            for skill in skills:
                name = skill["dir_name"]
                info = registry["skills"].get(name, {})
                tier = info.get("tier", "toolkit")
                cat = info.get("category", "其他工具")
                
                if tier == "core":
                    core_skills.append(skill)
                elif tier == "toolkit":
                    if cat not in toolkit_skills:
                        toolkit_skills[cat] = []
                    toolkit_skills[cat].append(skill)

            # 场景层从 registry 中筛选
            existing = {s["dir_name"] for s in skills}
            for scene_name, scene_config in SCENARIO_CLASSIFICATION.items():
                scene_set = set()
                # 场景专有技能
                for extra in scene_config.get("skills", []):
                    if extra in existing:
                        scene_set.add(extra)
                scenario_data[scene_name] = sorted(scene_set)
    except (IOError, json.JSONDecodeError):
        use_registry = False

    # 如果 registry.json 不存在或为空，从本地扫描结果生成
    if not use_registry and skills:
        for skill in skills:
            c = classify_skill(skill)
            if c["tier"] == "core":
                core_skills.append(skill)
            elif c["tier"] == "toolkit":
                cat = c["category"]
                if cat not in toolkit_skills:
                    toolkit_skills[cat] = []
                toolkit_skills[cat].append(skill)

        cat_map = get_indexed_skills_by_category(skills)
        existing = get_existing_dir_names(skills)
        for scene_name, scene_config in SCENARIO_CLASSIFICATION.items():
            scene_set = set()
            for cat_name in scene_config["categories"]:
                if cat_name in cat_map:
                    scene_set.update(cat_map[cat_name])
            for extra in scene_config["skills"]:
                if extra in existing:
                    scene_set.add(extra)
            scenario_data[scene_name] = sorted(scene_set)

    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    except Exception:
        timestamp = "unknown"

    lines = [
        f"# 当前 Skill 目录 ({len(skills)} 个技能)",
        f"",
        f"> 更新时间: {timestamp}",
        f"> 加载策略: core(始终) -> toolkit(按需) -> scenario(场景)",
        f"",
        f"---",
        f"",
        f"## 核心层 (Core) - 始终加载 - {len(core_skills)} 个",
        f"",
    ]

    for s in core_skills:
        desc = s["description"][:60] if s["description"] else "无描述"
        lines.append(f"- **{s['dir_name']}** - {desc}")

    lines += ["", "---", "", "## 工具层 (Toolkit) - 按任务按需加载", ""]

    for cat in sorted(toolkit_skills.keys()):
        skills_list = toolkit_skills[cat]
        lines.append(f"### {cat} - {len(skills_list)} 个")
        for s in skills_list:
            desc = s["description"][:60] if s["description"] else "无描述"
            lines.append(f"  - `{s['dir_name']}` - {desc}")
        lines.append("")

    lines += ["---", "", "## 场景层 (Scenario) - 按主题场景加载", ""]
    lines += ["> 场景层引用工具层分类 + 场景专有技能", ""]

    for scene_name in sorted(scenario_data.keys()):
        skill_list = scenario_data[scene_name]
        lines.append(f"### {_sanitize_scene_name(scene_name)} - {len(skill_list)} 个")
        for sn in skill_list:
            lines.append(f"  - `{sn}`")
        lines.append("")

    lines += ["", "---"]
    lines += ["", "## 推荐命令", ""]
    lines += ["```bash", "python3 classifier.py match \"你的任务\"", "python3 classifier.py be-integrate \"你的任务\"", "```"]

    content = "\n".join(lines)

    # 内容变更检测：仅当内容变化时才写文件
    try:
        if os.path.exists(CATALOG_FILE):
            with open(CATALOG_FILE, 'r', encoding='utf-8') as f:
                existing_content = f.read()
            if existing_content == content:
                # 内容无变化，跳过写文件
                return core_skills, toolkit_skills, scenario_data
    except IOError:
        pass

    try:
        with open(CATALOG_FILE, 'w', encoding='utf-8') as f:
            f.write(content)
    except IOError as e:
        print(f"警告: 无法写入目录文件: {e}")

    return core_skills, toolkit_skills, scenario_data


# ─── 注册表生成 ───────────────────────────────────────

def generate_registry(skills: list, merge_global: bool = True):
    """生成 registry.json
    
    Args:
        skills: 扫描到的技能列表
        merge_global: 是否合并全局注册表（跨 Agent 去重）
    
    注意：推荐使用 update_registry() 代替此函数，它支持多 Agent 同步和冲突解决。
    """
    if merge_global:
        # 使用 update_registry 更新注册表
        return update_registry("", force=False)

    # 不合并：仅生成当前扫描结果
    registry = {
        "generated_at": "",
        "total": len(skills),
        "skills": {},
    }

    try:
        registry["generated_at"] = datetime.now().isoformat()
    except Exception:
        registry["generated_at"] = "unknown"

    for skill in skills:
        c = classify_skill(skill)
        skill_name = skill["dir_name"]
        registry["skills"][skill_name] = {
            "name": skill["name"],
            "description": skill["description"],
            "tier": c["tier"],
            "category": c["category"],
            "path": skill["path"],
            "tags": skill["tags"],
        }

    try:
        with open(REGISTRY_FILE, 'w', encoding='utf-8') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)
    except IOError as e:
        print(f"警告: 无法写入注册表文件: {e}")

    return registry
def get_global_registry():
    """读取全局注册表（带文件锁，Windows 兼容）"""
    try:
        if os.path.exists(REGISTRY_FILE):
            with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
                if HAS_FLOCK:
                    fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                try:
                    return json.load(f)
                finally:
                    if HAS_FLOCK:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except (IOError, json.JSONDecodeError):
        pass
    return {"skills": {}}


def update_registry(agent: str = "", force: bool = False, resolve: bool = False, lock: bool = False, unlock: bool = False, skip_if_unchanged: bool = True, check_duplicates: bool = True):
    """更新共享注册表（单 Agent 扫描后自动更新）
    
    由于 registry.json 是共享的（WSL 和 Windows 读写同一份文件），
    每次扫描后自动更新注册表，无需手动同步。
    
    Args:
        agent: 执行更新的 Agent 名称（如 "xiaobao", "xiaocong"），用于追踪来源
        force: 强制更新（忽略分类锁定，用当前扫描结果覆盖）
        resolve: 采用扫描方的分类覆盖已注册分类（最新优先）
        lock: 强制锁定当前所有分类，后续冲突忽略
        unlock: 解除所有技能的锁定状态，允许重新分类
        skip_if_unchanged: 如果内容无变化则跳过写文件（避免重复同步）
        check_duplicates: 扫描后自动检查重复注册（默认 True）
    
    规则：
    1. 新技能：直接添加
    2. 已存在技能：更新描述、路径等信息
    3. 已删除技能：标记为 deleted（方便恢复）
    4. 分类冲突：使用优先级机制（核心 > 安全 > 代码 > 其他）
    5. 锁定状态：locked=True 的分类不再被覆盖
    6. 重复检测：自动检查本地技能与注册表的一致性
    """
    skills = scan_skills()
    global_reg = get_global_registry()
    updated = False
    
    # 如果指定了 unlock，清除所有锁定状态
    if unlock:
        for name, info in global_reg.get("skills", {}).items():
            if "locked" in info:
                del info["locked"]
                updated = True
            if "locked_at" in info:
                del info["locked_at"]
                updated = True
            if "locked_by" in info:
                del info["locked_by"]
                updated = True
        print("🔓 已解除所有技能分类锁定")

    for skill in skills:
        name = skill["dir_name"]
        c = classify_skill(skill)
        current_agent = agent or os.environ.get("AGENT_NAME", "unknown")
        
        if name not in global_reg["skills"]:
            priority_score = get_priority_score(c["tier"], c["category"])
            global_reg["skills"][name] = {
                "name": skill["name"],
                "description": skill["description"],
                "tier": c["tier"],
                "category": c["category"],
                "path": skill["path"],
                "tags": skill["tags"],
                "status": "active",
                "updated_at": datetime.now().isoformat(),
                "first_registered_by": current_agent,
                "last_agent": current_agent,
                "priority_score": priority_score,
            }
            updated = True
        else:
            existing = global_reg["skills"][name]
            
            # 变更检测：仅当实际数据变化时才更新
            existing_changed = False
            if existing.get("name") != skill["name"]:
                existing["name"] = skill["name"]
                existing_changed = True
            if existing.get("description") != skill["description"]:
                existing["description"] = skill["description"]
                existing_changed = True
            if existing.get("path") != skill["path"]:
                existing["path"] = skill["path"]
                existing_changed = True
            if existing.get("tags") != skill["tags"]:
                existing["tags"] = skill["tags"]
                existing_changed = True
            if existing.get("status") != "active":
                existing["status"] = "active"
                existing_changed = True
            
            if existing_changed:
                existing["updated_at"] = datetime.now().isoformat()
                updated = True
            
            existing["last_agent"] = current_agent
            
            # 分类变更检测
            tier_diff = existing.get("tier") != c["tier"]
            cat_diff = existing.get("category") != c["category"]
            
            if tier_diff or cat_diff:
                existing_tier = existing.get("tier", "toolkit")
                existing_cat = existing.get("category", "其他工具")
                
                # 记录冲突（总是记录，用于追踪历史）
                if "conflicts" not in existing:
                    existing["conflicts"] = []
                existing["conflicts"].append({
                    "field": "tier/category",
                    "registered": f"{existing_tier}/{existing_cat}",
                    "scanned": f"{c['tier']}/{c['category']}",
                    "by_agent": current_agent,
                    "at": datetime.now().isoformat(),
                })
                if len(existing["conflicts"]) > 10:
                    existing["conflicts"] = existing["conflicts"][-10:]
                
                # 有冲突记录时标记为已更新（即使未覆盖分类）
                updated = True
                
                # 是否更新分类？
                should_update = False
                
                if force or resolve:
                    # force/resolve: 覆盖为当前扫描分类
                    should_update = True
                elif unlock:
                    # unlock: 解除锁定后重新应用当前分类
                    should_update = True
                elif existing.get("locked"):
                    # 已锁定：不更新，保留锁定分类
                    should_update = False
                else:
                    # 优先级机制：高优先级可以覆盖低优先级
                    new_score = get_priority_score(c["tier"], c["category"])
                    old_score = existing.get("priority_score", get_priority_score(existing_tier, existing_cat))
                    if new_score > old_score:
                        should_update = True
                
                if should_update:
                    existing["tier"] = c["tier"]
                    existing["category"] = c["category"]
                    existing["priority_score"] = get_priority_score(c["tier"], c["category"])
                    existing["last_classified_by"] = current_agent
                    existing["last_classified_at"] = datetime.now().isoformat()
                    updated = True

    # 标记已删除的技能
    for name in list(global_reg["skills"].keys()):
        existing_names = {s["dir_name"] for s in skills}
        if name not in existing_names:
            if global_reg["skills"][name].get("status") != "deleted":
                global_reg["skills"][name]["status"] = "deleted"
                global_reg["skills"][name]["deleted_at"] = datetime.now().isoformat()
                updated = True

    if updated:
        global_reg["total"] = len(skills)
        global_reg["last_updated_at"] = datetime.now().isoformat()
        
        try:
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            with open(REGISTRY_FILE, 'w', encoding='utf-8', newline='') as f:
                if HAS_FLOCK:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    json.dump(global_reg, f, ensure_ascii=False, indent=2)
                finally:
                    if HAS_FLOCK:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
            print(f"✅ 注册表已更新，共 {len(global_reg['skills'])} 个技能")
        except IOError as e:
            print(f"⚠️ 无法保存注册表: {e}")
    else:
        print(f"ℹ️ 注册表无需更新")
    
    # 自动检查重复注册（如果 check_duplicates=True）
    if check_duplicates:
        _check_duplicate_registrations(skills, global_reg)

    return global_reg

def _check_duplicate_registrations(skills: list, registry: dict):
    """检查本地技能与注册表的一致性，输出警告"""
    skill_names = {s["dir_name"] for s in skills}
    registry_names = set(registry.get("skills", {}).keys())
    
    missing_in_registry = skill_names - registry_names
    missing_in_local = registry_names - skill_names
    
    if missing_in_registry:
        print(f"⚠️ 重复注册检查：{len(missing_in_registry)} 个本地技能未注册")
        for name in sorted(missing_in_registry)[:5]:
            print(f"   - {name}")
        if len(missing_in_registry) > 5:
            print(f"   ... 还有 {len(missing_in_registry) - 5} 个")
    
    if missing_in_local:
        deleted_count = sum(1 for n in missing_in_local if registry["skills"][n].get("status") == "deleted")
        if deleted_count < len(missing_in_local):
            print(f"ℹ️ 重复注册检查：{len(missing_in_local) - deleted_count} 个已注册技能本地不存在（非删除状态）")
            for name in sorted(missing_in_local)[:5]:
                info = registry["skills"][name]
                if info.get("status") != "deleted":
                    print(f"   - {name} (status: {info.get('status')})")
            if len(missing_in_local) - deleted_count > 5:
                print(f"   ... 还有 {len(missing_in_local) - deleted_count - 5} 个")
    
    if not missing_in_registry and (not missing_in_local or all(registry["skills"][n].get("status") == "deleted" for n in missing_in_local)):
        print("✅ 重复注册检查通过：本地技能与注册表一致")

def update_global_registry(skill_name: str, tier: str, category: str, agent: str = "", write_now: bool = True):
    """更新全局注册表（带文件锁，跨 Agent 去重）
    
    ⚠️ 警告：此函数不是原子操作！
    读-改-写之间有窗口期，其他 Agent 可能在此期间修改。
    如需原子操作，请使用 update_registry_atomic()。
    
    如果技能已注册，不重复添加；如果 tier 不同，更新为最新分类。
    
    Args:
        skill_name: 技能名
        tier: 层级
        category: 分类
        agent: Agent 名称
        write_now: 是否立即写文件（默认 True，写入文件）
    """
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        registry = get_global_registry()
        changed = False
        
        if skill_name not in registry["skills"]:
            registry["skills"][skill_name] = {
                "tier": tier,
                "category": category,
                "registered_by": agent,
                "registered_at": datetime.now().isoformat(),
            }
            changed = True
        else:
            # 技能已注册，更新分类信息（可能跨 Agent 重新分类）
            if registry["skills"][skill_name]["tier"] != tier:
                registry["skills"][skill_name]["tier"] = tier
                registry["skills"][skill_name]["category"] = category
                registry["skills"][skill_name]["updated_by"] = agent
                registry["skills"][skill_name]["updated_at"] = datetime.now().isoformat()
                changed = True
        
        # 只有 write_now=True 时才写文件，避免频繁 I/O
        if write_now and changed:
            with open(REGISTRY_FILE, 'w', encoding='utf-8', newline='') as f:
                if HAS_FLOCK:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    json.dump(registry, f, ensure_ascii=False, indent=2)
                finally:
                    if HAS_FLOCK:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        
        return changed
    except IOError as e:
        print(f"警告: 无法更新全局注册表: {e}")
        return False



def update_registry_atomic(agent: str = "", force: bool = False, skip_if_unchanged: bool = True,
                           check_duplicates: bool = True, resolve: bool = False) -> dict:
    """原子更新全局注册表（读-改-写在同一个锁内）
    
    这是解决竞态条件的正确方式：
    1. 打开文件并加锁
    2. 读取当前内容
    3. 修改内容
    4. 写回文件
    5. 释放锁
    
    整个过程在同一个锁内完成，其他 Agent 无法在此期间修改。
    
    Args:
        agent: Agent 名称
        force: 强制更新（即使无变化也写入）
        skip_if_unchanged: 无变化时跳过写入
        check_duplicates: 是否检查重复注册
        resolve: 采用扫描方的分类覆盖已注册分类（解决冲突）
    
    Returns:
        dict: 更新后的注册表
    """
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        
        # 原子读-改-写
        with open(REGISTRY_FILE, 'r+', encoding='utf-8') as f:
            if HAS_FLOCK:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                # 读取当前内容
                try:
                    registry = json.load(f)
                except json.JSONDecodeError:
                    registry = {"skills": {}}
                
                # 记录修改前的状态
                original_count = len(registry.get("skills", {}))
                
                # 扫描技能并更新注册表（与 update_registry 相同的逻辑）
                skills = scan_skills()
                updated = False
                
                for skill in skills:
                    name = skill["dir_name"]
                    c = classify_skill(skill)
                    current_agent = agent or os.environ.get("AGENT_NAME", "unknown")
                    
                    if name not in registry["skills"]:
                        priority_score = get_priority_score(c["tier"], c["category"])
                        registry["skills"][name] = {
                            "name": skill["name"],
                            "description": skill["description"],
                            "tier": c["tier"],
                            "category": c["category"],
                            "path": skill["path"],
                            "tags": skill["tags"],
                            "status": "active",
                            "updated_at": datetime.now().isoformat(),
                            "first_registered_by": current_agent,
                            "last_agent": current_agent,
                            "priority_score": priority_score,
                        }
                        updated = True
                    else:
                        existing = registry["skills"][name]
                        existing_changed = False
                        
                        if existing.get("name") != skill["name"]:
                            existing["name"] = skill["name"]
                            existing_changed = True
                        if existing.get("description") != skill["description"]:
                            existing["description"] = skill["description"]
                            existing_changed = True
                        if existing.get("path") != skill["path"]:
                            existing["path"] = skill["path"]
                            existing_changed = True
                        if existing.get("tags") != skill["tags"]:
                            existing["tags"] = skill["tags"]
                            existing_changed = True
                        if existing.get("status") != "active":
                            existing["status"] = "active"
                            existing_changed = True
                        
                        # 处理分类冲突（resolve 参数）
                        if resolve and (existing.get("tier") != c["tier"] or existing.get("category") != c["category"]):
                            # 采用扫描方的分类覆盖已注册分类
                            existing["tier"] = c["tier"]
                            existing["category"] = c["category"]
                            existing["updated_at"] = datetime.now().isoformat()
                            existing_changed = True
                        elif not resolve:
                            # 优先级机制：高优先级覆盖低优先级
                            new_priority = get_priority_score(c["tier"], c["category"])
                            existing_priority = existing.get("priority_score", 0)
                            if new_priority > existing_priority:
                                existing["tier"] = c["tier"]
                                existing["category"] = c["category"]
                                existing["priority_score"] = new_priority
                                existing["updated_at"] = datetime.now().isoformat()
                                existing_changed = True
                        
                        if existing_changed:
                            existing["updated_at"] = datetime.now().isoformat()
                            updated = True
                        
                        existing["last_agent"] = current_agent
                
                # 标记已删除的技能
                for name in list(registry["skills"].keys()):
                    existing_names = {s["dir_name"] for s in skills}
                    if name not in existing_names:
                        if registry["skills"][name].get("status") != "deleted":
                            registry["skills"][name]["status"] = "deleted"
                            registry["skills"][name]["deleted_at"] = datetime.now().isoformat()
                            updated = True
                
                # 检查是否有变化
                new_count = len(registry.get("skills", {}))
                changed = new_count != original_count or updated
                
                if changed or force:
                    # 写回文件
                    f.seek(0)
                    f.truncate()
                    json.dump(registry, f, ensure_ascii=False, indent=2)
                    print(f"✅ 注册表已更新，共 {new_count} 个技能")
                elif not skip_if_unchanged:
                    # 即使无变化也写入（用于强制刷新）
                    f.seek(0)
                    f.truncate()
                    json.dump(registry, f, ensure_ascii=False, indent=2)
                    print(f"ℹ️ 注册表已刷新（无变化）")
                else:
                    print(f"ℹ️ 注册表无需更新")
                
                return registry
            finally:
                if HAS_FLOCK:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except IOError as e:
        print(f"⚠️ 无法更新全局注册表: {e}")
        return {"skills": {}}

def is_skill_registered(skill_name: str) -> bool:
    """检查技能是否已在全局注册表中注册"""
    registry = get_global_registry()
    return skill_name in registry.get("skills", {})

def get_registered_tier(skill_name: str) -> str:
    """获取技能在全局注册表中的 tier"""
    registry = get_global_registry()
    return registry.get("skills", {}).get(skill_name, {}).get("tier", "toolkit")


# ─── 已加载技能管理（behavior-engine 集成）────────────

def get_loaded_skills():
    """读取已加载的技能列表（带文件锁）"""
    try:
        if os.path.exists(LOADED_SKILLS_FILE):
            with open(LOADED_SKILLS_FILE, 'r', encoding='utf-8') as f:
                if HAS_FLOCK:
                    fcntl.flock(f.fileno(), fcntl.LOCK_SH)
                try:
                    return json.load(f)
                finally:
                    if HAS_FLOCK:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except (IOError, json.JSONDecodeError):
        pass
    return {"core": [], "toolkit": [], "scenario": [], "task_id": ""}


def save_loaded_skills(data: dict):
    """保存已加载的技能列表（带文件锁）"""
    try:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        with open(LOADED_SKILLS_FILE, 'w', encoding='utf-8', newline='') as f:
            if HAS_FLOCK:
                fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                json.dump(data, f, ensure_ascii=False, indent=2)
            finally:
                if HAS_FLOCK:
                    fcntl.flock(f.fileno(), fcntl.LOCK_UN)
    except IOError as e:
        print(f"警告: 无法保存已加载技能列表: {e}")


def load_skills(skill_names: list, task_id: str = "", force_scenario: bool = False, agent: str = ""):
    """标记技能为已加载
    
    force_scenario=True 时强制归入场景层（场景层技能本质是工具层，
    但管理器需要标记它们属于哪个场景以便清理时正确回收）
    
    自动去重：
    1. 跨层级去重：同一技能不会重复加载到不同层级
    2. 跨 Agent 去重：通过全局注册表检查，避免多 Agent 重复注册
    """
    loaded = get_loaded_skills()
    skills = scan_skills()
    skill_lookup = {s["dir_name"]: s for s in skills}

    # 收集所有已加载的技能名（跨层级去重）
    all_loaded = set(loaded.get("core", []) + loaded.get("toolkit", []) + loaded.get("scenario", []))

    for name in skill_names:
        if name in skill_lookup:
            # 跨层级去重：如果已在任何层级加载，跳过
            if name in all_loaded:
                continue
            
            # 跨 Agent 去重：检查全局注册表
            # 如果技能已注册且 tier 不同，记录警告但不阻止加载
            reg_tier = get_registered_tier(name)
            if reg_tier != "toolkit" and reg_tier != "scenario":
                print(f"⚠️ 技能 {name} 已在全局注册表中注册为 tier={reg_tier}，当前加载为 tier={reg_tier}")

            if force_scenario:
                tier = "scenario"
            else:
                c = classify_skill(skill_lookup[name])
                tier = c["tier"]
            
            if tier in loaded:
                loaded[tier].append(name)
                all_loaded.add(name)
                # 更新全局注册表（确保跨 Agent 同步）
                update_global_registry(name, tier, c["category"], agent=agent, write_now=True)

    if task_id:
        loaded["task_id"] = task_id
    save_loaded_skills(loaded)
    
    # 加载后自动同步注册表（仅当有实际变更时写入）
    update_registry(agent, force=False, skip_if_unchanged=True)
    
    return loaded


def unload_skills(skill_names: list = None, tier: str = None, allow_core: bool = False):
    """卸载指定技能

    Args:
        skill_names: 要卸载的技能名列表。None=卸载整层，[] 视为 None（卸载整层）
        tier: 指定层级（toolkit/scenario）。core 不可卸载，除非 allow_core=True
        allow_core: 允许卸载核心层（默认 False，core 受保护）
    """
    loaded = get_loaded_skills()
    default_tiers = ["toolkit", "scenario"]
    if tier:
        if tier == "core" and not allow_core:
            print("⚠️ 核心层不可卸载，如需强制卸载请设置 allow_core=True")
            return loaded
        tiers = [tier]
    else:
        tiers = default_tiers
    # skill_names 为 None 或空列表 → 卸载整层
    if not skill_names:
        for t in tiers:
            if t in loaded:
                loaded[t] = []
    else:
        # 指定具体技能名 → 从指定层级中移除
        for t in tiers:
            if t in loaded:
                loaded[t] = [s for s in loaded[t] if s not in skill_names]
    save_loaded_skills(loaded)
    # 卸载后同步注册表
    update_registry(agent="", force=False, skip_if_unchanged=True)
    return loaded


def cleanup_skills(task_id: str = None, keep_core: bool = True):
    """清理 toolkit/scenario 技能，core 永远不清理

    Args:
        task_id: 仅清理匹配 task_id 的加载记录（按任务清理）
        keep_core: 保留核心层（始终为 True，core 不可卸载）
    """
    loaded = get_loaded_skills()
    # 按任务清理：仅清理匹配 task_id 的记录
    if task_id and loaded.get("task_id") == task_id:
        loaded["toolkit"] = []
        loaded["scenario"] = []
        loaded["task_id"] = ""
        save_loaded_skills(loaded)
        return True
    # 全局清理：core 始终保留，仅清理 toolkit/scenario
    loaded["toolkit"] = []
    loaded["scenario"] = []
    loaded["task_id"] = ""
    save_loaded_skills(loaded)
    # 清理后同步注册表
    update_registry(agent="", force=False, skip_if_unchanged=True)
    return True


# ─── 主动晒清单（suggest）─────────────────────────────

def suggest_active():
    """基于当前已加载的技能，推荐可扩展加载的相关技能

    改进：
    1. 排除已加载的分类（如果该分类所有技能都已加载）
    2. 添加场景层扩展推荐
    3. 按分类优先级排序（核心 > 工具层 > 场景层）
    """
    loaded = get_loaded_skills()
    skills = scan_skills()
    skill_lookup = {s["dir_name"]: s for s in skills}

    all_loaded = set(loaded.get("core", []) + loaded.get("toolkit", []) + loaded.get("scenario", []))

    loaded_categories = set()
    for name in loaded.get("toolkit", []):
        if name in skill_lookup:
            c = classify_skill(skill_lookup[name])
            loaded_categories.add(c["category"])

    # 计算每个分类的已加载比例
    cat_map = get_indexed_skills_by_category(skills)
    loaded_cat_ratio = {}
    for cat, cat_skills in cat_map.items():
        loaded_count = sum(1 for s in cat_skills if s in all_loaded)
        loaded_cat_ratio[cat] = loaded_count / len(cat_skills) if cat_skills else 0

    suggestions = []
    for s in skills:
        if s["dir_name"] in all_loaded:
            continue
        c = classify_skill(s)
        if c["tier"] == "toolkit":
            cat = c["category"]
            # 只推荐未加载完的分类
            if cat in loaded_categories and loaded_cat_ratio.get(cat, 0) < 1.0:
                suggestions.append((s["dir_name"], cat, "toolkit"))
        elif c["tier"] == "scenario":
            # 场景层扩展推荐：推荐同场景的其他技能
            scene_name = c["category"]
            if scene_name in loaded_categories:
                suggestions.append((s["dir_name"], scene_name, "scenario"))

    # 按分类优先级排序：工具层 > 场景层，同分类内按字母序
    priority = {"toolkit": 0, "scenario": 1}
    suggestions.sort(key=lambda x: (priority.get(x[2], 2), x[1], x[0]))

    return {
        "loaded": loaded,
        "total_loaded": len(all_loaded),
        "suggestions_count": len(suggestions),
        "suggestions": [(name, cat) for name, cat, _ in suggestions],
    }


# ─── behavior-engine 集成推荐 ─────────────────────────

def be_integrate(task: str, skills: list) -> dict:
    """为 behavior-engine 生成结构化推荐结果
    
    场景层推荐逻辑改进：
    1. 场景专有技能已分类为 toolkit + scene_name
    2. 场景层推荐 = 工具层分类技能 + 场景专有技能
    3. 重叠技能标记为 overlap_with_toolkit
    """
    recs = recommend_skills(task, skills)

    result = {
        "task": task,
        "is_task": True,
        "recommendations": {
            "core": recs["core"],
            "toolkit": [],
            "scenario": [],
        }
    },

    toolkit_sorted = sorted(recs["toolkit"], key=lambda x: -x[2])
    for name, cat, score in toolkit_sorted:
        result["recommendations"]["toolkit"].append({
            "name": name, "category": cat, "score": score
        })

    scenario_sorted = sorted(recs["scenario"], key=lambda x: -x[1])
    for scene_name, score, only_skills, overlap_skills in scenario_sorted:
        scene_config = SCENARIO_CLASSIFICATION.get(scene_name, {})
        display_name = re.sub(r'[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE00-\uFE0F]', '', scene_name).strip()
        
        # 获取场景层完整技能列表（包括重叠技能）
        scene_config_skills = scene_config.get("skills", [])
        scene_categories = scene_config.get("categories", [])
        
        # 从 registry 获取场景专有技能的分类信息
        scene_skill_details = []
        for skill_name in only_skills + overlap_skills:
            scene_skill_details.append({
                "name": skill_name,
                "is_overlap": skill_name in overlap_skills,
            })
        
        result["recommendations"]["scenario"].append({
            "name": display_name,
            "key": scene_config.get("key", display_name),
            "based_on_categories": scene_categories,
            "score": score,
            "skills": only_skills,
            "overlap_with_toolkit": overlap_skills,
            "total_skills": len(only_skills) + len(overlap_skills),
            "skill_details": scene_skill_details,
        })

    return result


# ─── 统计 ─────────────────────────────────────────────

def print_stats(skills: list):
    """打印统计信息"""
    core_count = 0
    toolkit_count = 0
    cat_counts = {}
    scenario_extra_skills = set()

    for s in skills:
        c = classify_skill(s)
        if c["tier"] == "core":
            core_count += 1
        elif c["tier"] == "toolkit":
            toolkit_count += 1
            cat = c["category"]
            cat_counts[cat] = cat_counts.get(cat, 0) + 1

    for scene_config in SCENARIO_CLASSIFICATION.values():
        for es in scene_config.get("skills", []):
            scenario_extra_skills.add(es)

    print(f"\nSkill 统计")
    print(f"{'='*40}")
    print(f"  总技能数:      {len(skills)}")
    print(f"  核心层:     {core_count} (始终加载)")
    print(f"  工具层:     {toolkit_count} (按需加载)")
    for cat in sorted(cat_counts):
        print(f"    ├─ {cat}: {cat_counts[cat]} 个")
    print(f"  场景层:     {len(SCENARIO_CLASSIFICATION)} 个场景配置")
    for sname, sconf in sorted(SCENARIO_CLASSIFICATION.items()):
        total = len(sconf.get("categories", [])) + len(sconf.get("skills", []))
        print(f"    ├─ {_sanitize_scene_name(sname)}: {total} 个引用")
    print(f"  场景专有技能: {len(scenario_extra_skills)} 个 (仅场景层使用)")
    print(f"{'='*40}")
    print(f"  catalog: {CATALOG_FILE}")
    print(f"  registry: {REGISTRY_FILE}")


# ─── 主入口 ───────────────────────────────────────────

def main():
    try:
        if sys.platform == "win32":
            try:
                sys.stdout.reconfigure(encoding='utf-8')
            except AttributeError:
                pass

        # 检测 --skip-sync 参数（无参数模式下的选项）
        skip_sync = "--skip-sync" in sys.argv
        if skip_sync:
            sys.argv.remove("--skip-sync")
        
        if len(sys.argv) < 2:
            print("扫描 Skill 目录...")
            skills = scan_skills()
            print(f"   发现 {len(skills)} 个技能")

            print("\n分类中...")
            for s in skills:
                c = classify_skill(s)
                tier_icon = {"core": "C", "toolkit": "T", "scenario": "S"}.get(c["tier"], "?")
                cat_info = c["category"]
                print(f"  {tier_icon} {s['dir_name']:30s} -> [{c['tier']}] {cat_info}")

            if not skip_sync:
                print("\n生成目录（从注册表）...")
                generate_catalog()

                print("\n同步注册表（多 Agent 兼容）...")
                update_registry(skip_if_unchanged=True)

            print_stats(skills)
            print("\n完成")
            if skip_sync:
                print("   (--skip-sync 模式：跳过目录生成和注册表同步)")
            return

        cmd = sys.argv[1]

        # Windows 兼容性提示
        if sys.platform == "win32":
            print("⚠️ 运行在 Windows 平台，部分功能可能受限：")
            print("   - 文件锁使用 Windows API（非 fcntl）")
            print("   - 路径使用反斜杠格式")
            print("   - 建议通过 WSL 运行以获得完整功能")
            print()

        if cmd == "stats":
            skills = scan_skills()
            print_stats(skills)
            return

        if cmd == "match":
            if len(sys.argv) < 3:
                print("用法: python3 classifier.py match \"你的任务描述\"")
                sys.exit(1)
            task = sys.argv[2]
            skills = scan_skills()
            recs = recommend_skills(task, skills)

            print(f"\n任务: \"{task}\"")
            print(f"{'='*50}")

            print(f"\n[核心层] 始终可用:")
            for s in recs["core"]:
                print(f"  + {s}")

            toolkit_sorted = sorted(recs["toolkit"], key=lambda x: -x[2])
            print(f"\n[工具层] 推荐 ({len(toolkit_sorted)} 个):")
            for name, cat, score in toolkit_sorted:
                print(f"  # {name} [{cat}] (匹配度: {score})")

            scenario_sorted = sorted(recs["scenario"], key=lambda x: -x[1])
            print(f"\n[场景层] 推荐 ({len(scenario_sorted)} 个):")
            for name, score, only_skills, overlap_skills in scenario_sorted:
                display_name = re.sub(r'[\U0001F000-\U0001FFFF\u2600-\u27BF\uFE00-\uFE0F]', '', name).strip()
                skill_str = ', '.join(only_skills[:5])
                if len(only_skills) > 5:
                    skill_str += '...'
                extra = ""
                if overlap_skills:
                    extra = f", 工具层已推荐: {', '.join(overlap_skills[:3])}"
                print(f"  @ {display_name} (匹配度: {score}, 技能: {skill_str}{extra})")

            print(f"\n推荐加载命令:")
            toolkit_names = [s[0] for s in toolkit_sorted[:3]]
            if toolkit_names:
                print(f"  python3 classifier.py load {' '.join(toolkit_names)}")
            print(f"  python3 classifier.py cleanup")
            return

        if cmd == "be-integrate":
            if len(sys.argv) < 3:
                print(json.dumps({"error": "需要任务描述", "is_task": False}, ensure_ascii=False))
                sys.exit(1)
            task = sys.argv[2]
            skills = scan_skills()
            result = be_integrate(task, skills)
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if cmd == "load":
            skills = scan_skills()
            skill_names = sys.argv[2:] if len(sys.argv) > 2 else []
            task_id = ""
            force_scenario = False
            agent = ""

            if not skill_names:
                print("用法: python3 classifier.py load skill1 skill2 ...")
                print("      python3 classifier.py load --all")
                print("      python3 classifier.py load --scenario skill1 skill2 ...")
                print("      python3 classifier.py load --agent xiaobao skill1 skill2 ...")
                return

            if "--all" in skill_names:
                skill_names.remove("--all")
                skill_names = [s["dir_name"] for s in skills]

            if "--scenario" in skill_names:
                skill_names.remove("--scenario")
                force_scenario = True

            if "--agent" in skill_names:
                idx = skill_names.index("--agent")
                if idx + 1 < len(skill_names):
                    agent = skill_names[idx + 1]
                    skill_names.pop(idx)
                    skill_names.pop(idx)  # Remove the agent name too

            load_skills(skill_names, task_id, force_scenario, agent)

            loaded = get_loaded_skills()
            print(f"已加载: core={len(loaded['core'])} toolkit={len(loaded['toolkit'])} scenario={len(loaded['scenario'])}")
            if loaded["toolkit"]:
                print(f"  工具层: {', '.join(loaded['toolkit'])}")
            if loaded["scenario"]:
                print(f"  场景层: {', '.join(loaded['scenario'])}")
            return

        if cmd == "loaded":
            loaded = get_loaded_skills()
            print(f"\n当前已加载技能")
            print(f"{'='*40}")
            print(f"  核心层 ({len(loaded['core'])}): {', '.join(loaded['core']) if loaded['core'] else '无'}")
            print(f"  工具层 ({len(loaded['toolkit'])}): {', '.join(loaded['toolkit']) if loaded['toolkit'] else '无'}")
            print(f"  场景层 ({len(loaded['scenario'])}): {', '.join(loaded['scenario']) if loaded['scenario'] else '无'}")
            if loaded.get("task_id"):
                print(f"  当前任务: {loaded['task_id']}")
            return

        if cmd == "cleanup":
            task_id = None
            keep_core = True
            args = sys.argv[2:] if len(sys.argv) > 2 else []
            if "--keep-core" in args or "--keep core" in " ".join(args):
                keep_core = True
                args = [a for a in args if a not in ("--keep-core", "--keep", "core")]
            if args:
                task_id = args[0]
            cleanup_skills(task_id, keep_core)
            print("已清理未用技能")
            return



        if cmd == "check-conflicts":
            """检查分类冲突
            
            支持参数：
              --json: 以 JSON 格式输出（便于程序处理）
              --all: 显示所有冲突记录（不限于最近 3 条）
              --agent NAME: 按 Agent 名筛选冲突
            """
            args = sys.argv[2:] if len(sys.argv) > 2 else []
            output_json = "--json" in args
            show_all = "--all" in args
            filter_agent = None
            if "--agent" in args:
                idx = args.index("--agent")
                if idx + 1 < len(args):
                    filter_agent = args[idx + 1]
            
            registry = get_global_registry()
            
            # 收集冲突信息
            conflict_skills = {}  # name -> {current, conflicts, agents, locked}
            for name, info in registry.get("skills", {}).items():
                if "conflicts" in info and info["conflicts"]:
                    # 按 Agent 筛选
                    if filter_agent:
                        filtered = [c for c in info["conflicts"] if c.get("by_agent", "") == filter_agent]
                        if not filtered:
                            continue
                    else:
                        filtered = info["conflicts"]
                    
                    # 收集涉及的 Agent
                    agents_involved = set()
                    for c in info["conflicts"]:
                        ag = c.get("by_agent", "unknown")
                        if ag:
                            agents_involved.add(ag)
                    
                    conflict_skills[name] = {
                        "current_tier": info.get("tier", "?"),
                        "current_category": info.get("category", "?"),
                        "conflicts": filtered,
                        "total_conflicts": len(info["conflicts"]),
                        "agents_involved": sorted(agents_involved),
                        "locked": info.get("locked", False),
                        "locked_by": info.get("locked_by", ""),
                        "last_agent": info.get("last_agent", ""),
                    }
            
            if output_json:
                result = {
                    "total_conflict_skills": len(conflict_skills),
                    "total_conflict_count": sum(s["total_conflicts"] for s in conflict_skills.values()),
                    "conflict_skills": {},
                }
                for name, data in conflict_skills.items():
                    result["conflict_skills"][name] = {
                        "current_classification": f"{data['current_tier']}/{data['current_category']}",
                        "total_conflicts": data["total_conflicts"],
                        "agents_involved": data["agents_involved"],
                        "locked": data["locked"],
                        "locked_by": data["locked_by"],
                        "recent_conflicts": [
                            {"scanned": c["scanned"], "by": c.get("by_agent", ""), "at": c["at"]}
                            for c in data["conflicts"][-3:]
                        ],
                    }
                print(json.dumps(result, ensure_ascii=False, indent=2))
                return
            
            # 文本输出
            if conflict_skills:
                total_agents = set()
                for data in conflict_skills.values():
                    total_agents.update(data["agents_involved"])
                
                print(f"{'='*55}")
                print(f"🔀 分类冲突报告")
                print(f"{'='*55}")
                print(f"  冲突技能数:   {len(conflict_skills)}")
                print(f"  总冲突次数:   {sum(s['total_conflicts'] for s in conflict_skills.values())}")
                print(f"  涉及 Agent:   {', '.join(sorted(total_agents)) if total_agents else '无记录'}")
                print(f"  已锁定:       {sum(1 for s in conflict_skills.values() if s['locked'])} 个")
                print(f"{'='*55}")
                print()
                
                for name, data in sorted(conflict_skills.items()):
                    lock_icon = "🔒" if data["locked"] else " "
                    print(f"  {lock_icon} {name}")
                    print(f"    当前分类: {data['current_tier']}/{data['current_category']}")
                    print(f"    冲突次数: {data['total_conflicts']} 次")
                    print(f"    涉及Agent: {', '.join(data['agents_involved'])}")
                    if data["locked"] and data["locked_by"]:
                        print(f"    锁定者: {data['locked_by']}")
                    
                    # 显示冲突详情
                    limit = 10 if show_all else 3
                    for c in data["conflicts"][-limit:]:
                        agent_info = f" by {c.get('by_agent', '?')}" if c.get("by_agent") else ""
                        print(f"    扫描分类: {c['scanned']}{agent_info} (at {c['at']})")
                    if not show_all and data["total_conflicts"] > 3:
                        print(f"    ... 还有 {data['total_conflicts'] - 3} 条历史冲突 (--all 查看全部)")
                    print()
                
                print(f"{'='*55}")
                print(f"解决冲突命令:")
                print(f"  classifier.py resolve --agent xiaobao   # 采用 xiaobao 的分类")
                print(f"  classifier.py lock skill-name          # 锁定该技能分类")
                print(f"  classifier.py unlock skill-name        # 解锁该技能分类")
                print(f"  classifier.py check-conflicts --json   # JSON 输出")
                print(f"{'='*55}")
            else:
                print("✅ 未发现分类冲突")
            return

        if cmd == "resolve":
            """解决分类冲突（采用扫描方的分类）
            
            用法：
              classifier.py resolve                    # 采用当前扫描分类覆盖所有冲突
              classifier.py resolve --agent xiaobao    # 仅解决该 Agent 相关的冲突
            """
            args = sys.argv[2:] if len(sys.argv) > 2 else []
            agent = ""
            if "--agent" in args:
                idx = args.index("--agent")
                if idx + 1 < len(args):
                    agent = args[idx + 1]
            
            registry = get_global_registry()
            skills = scan_skills()
            skill_lookup = {s["dir_name"]: s for s in skills}
            resolved = 0
            
            for name, info in registry.get("skills", {}).items():
                if "conflicts" not in info or not info["conflicts"]:
                    continue
                
                # 按 Agent 筛选
                if agent:
                    filtered = [c for c in info["conflicts"] if c.get("by_agent", "") == agent]
                    if not filtered:
                        continue
                
                # 解析当前扫描分类
                if name in skill_lookup:
                    c = classify_skill(skill_lookup[name])
                    info["tier"] = c["tier"]
                    info["category"] = c["category"]
                    info["priority_score"] = get_priority_score(c["tier"], c["category"])
                    info["last_classified_by"] = agent or "resolve_command"
                    info["last_classified_at"] = datetime.now().isoformat()
                    
                    # 清除旧冲突记录（resolve 后从头开始）
                    if "conflicts" in info:
                        del info["conflicts"]
                    
                    resolved += 1
            
            if resolved:
                registry["last_updated_at"] = datetime.now().isoformat()
                try:
                    with open(REGISTRY_FILE, 'w', encoding='utf-8', newline='') as f:
                        if HAS_FLOCK:
                            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                        try:
                            json.dump(registry, f, ensure_ascii=False, indent=2)
                        finally:
                            if HAS_FLOCK:
                                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    print(f"✅ 已解决 {resolved} 个技能的分类冲突")
                except IOError as e:
                    print(f"⚠️ 保存注册表失败: {e}")
            else:
                print("ℹ️ 未发现需要解决的冲突")
            return

        if cmd == "lock":
            """锁定技能分类，阻止后续冲突覆盖
            
            用法：
              classifier.py lock skill-name1 skill-name2  # 锁定指定技能
              classifier.py lock --all                    # 锁定所有技能
            """
            args = sys.argv[2:] if len(sys.argv) > 2 else []
            if not args:
                print("用法: classifier.py lock skill-name1 [skill-name2 ...]")
                print("      classifier.py lock --all")
                return
            
            registry = get_global_registry()
            locked = 0
            agent = os.environ.get("AGENT_NAME", "cli")
            
            if "--all" in args:
                for name, info in registry.get("skills", {}).items():
                    info["locked"] = True
                    info["locked_by"] = agent
                    info["locked_at"] = datetime.now().isoformat()
                    locked += 1
            else:
                for name in args:
                    if name == "--all":
                        continue
                    if name in registry.get("skills", {}):
                        registry["skills"][name]["locked"] = True
                        registry["skills"][name]["locked_by"] = agent
                        registry["skills"][name]["locked_at"] = datetime.now().isoformat()
                        locked += 1
                    else:
                        print(f"⚠️ 技能 '{name}' 不在注册表中")
            
            if locked:
                registry["last_updated_at"] = datetime.now().isoformat()
                try:
                    with open(REGISTRY_FILE, 'w', encoding='utf-8', newline='') as f:
                        if HAS_FLOCK:
                            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                        try:
                            json.dump(registry, f, ensure_ascii=False, indent=2)
                        finally:
                            if HAS_FLOCK:
                                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    print(f"🔒 已锁定 {locked} 个技能的分类")
                except IOError as e:
                    print(f"⚠️ 保存注册表失败: {e}")
            return

        if cmd == "unlock":
            """解除技能分类锁定
            
            用法：
              classifier.py unlock skill-name1 skill-name2  # 解锁指定技能
              classifier.py unlock --all                    # 解锁所有技能
            """
            args = sys.argv[2:] if len(sys.argv) > 2 else []
            if not args:
                print("用法: classifier.py unlock skill-name1 [skill-name2 ...]")
                print("      classifier.py unlock --all")
                return
            
            registry = get_global_registry()
            unlocked = 0
            
            if "--all" in args:
                for name, info in registry.get("skills", {}).items():
                    if info.get("locked"):
                        del info["locked"]
                        if "locked_by" in info:
                            del info["locked_by"]
                        if "locked_at" in info:
                            del info["locked_at"]
                        unlocked += 1
            else:
                for name in args:
                    if name == "--all":
                        continue
                    if name in registry.get("skills", {}):
                        info = registry["skills"][name]
                        if info.get("locked"):
                            del info["locked"]
                            if "locked_by" in info:
                                del info["locked_by"]
                            if "locked_at" in info:
                                del info["locked_at"]
                            unlocked += 1
                        else:
                            print(f"ℹ️ 技能 '{name}' 未被锁定")
                    else:
                        print(f"⚠️ 技能 '{name}' 不在注册表中")
            
            if unlocked:
                registry["last_updated_at"] = datetime.now().isoformat()
                try:
                    with open(REGISTRY_FILE, 'w', encoding='utf-8', newline='') as f:
                        if HAS_FLOCK:
                            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                        try:
                            json.dump(registry, f, ensure_ascii=False, indent=2)
                        finally:
                            if HAS_FLOCK:
                                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                    print(f"🔓 已解锁 {unlocked} 个技能的分类")
                except IOError as e:
                    print(f"⚠️ 保存注册表失败: {e}")
            return

        if cmd == "sync":
            """同步注册表（多 Agent 共享）
            
            用法：
              classifier.py sync                          # 同步注册表
              classifier.py sync --agent xiaobao          # 标记本次同步的 Agent
              classifier.py sync --resolve                # 同步时采用当前分类解决冲突
              classifier.py sync --force                  # 强制覆盖
            """
            args = sys.argv[2:] if len(sys.argv) > 2 else []
            agent = ""
            force = False
            resolve = False
            
            if "--agent" in args:
                idx = args.index("--agent")
                if idx + 1 < len(args):
                    agent = args[idx + 1]
            if "--force" in args:
                force = True
            if "--resolve" in args:
                resolve = True
            
            update_registry_atomic(agent=agent, force=force, skip_if_unchanged=True, resolve=resolve)
            print(f"   Agent: {agent or 'default'}")
            print(f"   策略: {'force' if force else 'resolve' if resolve else 'priority'}")
            return

        if cmd == "audit":
            """审计技能注册表，检查重复注册和分类冲突"""
            registry = get_global_registry()
            skills = scan_skills()
            skill_names = {s["dir_name"] for s in skills}
            registry_names = set(registry.get("skills", {}).keys())
            
            issues = []
            
            # 1. 检查本地有但注册表没有的技能
            missing_in_registry = skill_names - registry_names
            if missing_in_registry:
                issues.append(f"⚠️ {len(missing_in_registry)} 个技能在本地存在但未注册:")
                for name in sorted(missing_in_registry)[:10]:
                    issues.append(f"   - {name}")
                if len(missing_in_registry) > 10:
                    issues.append(f"   ... 还有 {len(missing_in_registry) - 10} 个")
            
            # 2. 检查注册表有但本地没有的技能
            missing_in_local = registry_names - skill_names
            if missing_in_local:
                issues.append(f"ℹ️ {len(missing_in_local)} 个技能已注册但本地不存在:")
                for name in sorted(missing_in_local)[:10]:
                    info = registry["skills"][name]
                    status = info.get("status", "unknown")
                    issues.append(f"   - {name} (status: {status})")
                if len(missing_in_local) > 10:
                    issues.append(f"   ... 还有 {len(missing_in_local) - 10} 个")
            
            # 3. 检查分类冲突
            conflict_count = 0
            for name, info in registry.get("skills", {}).items():
                if "conflicts" in info and info["conflicts"]:
                    conflict_count += 1
            if conflict_count > 0:
                issues.append(f"⚠️ {conflict_count} 个技能存在分类冲突:")
                for name, info in registry.get("skills", {}).items():
                    if "conflicts" in info and info["conflicts"]:
                        latest = info["conflicts"][-1]
                        issues.append(f"   - {name}: 注册={info.get('tier')}/{info.get('category')}, 扫描={latest['scanned']}")
            
            # 4. 检查重复注册（同一技能被多次注册）
            # 通过检查 registered_by 和 updated_by 字段
            multi_agent_skills = []
            for name, info in registry.get("skills", {}).items():
                agents = set()
                if "registered_by" in info:
                    agents.add(info["registered_by"])
                if "updated_by" in info:
                    agents.add(info["updated_by"])
                if "last_classified_by" in info:
                    agents.add(info["last_classified_by"])
                if len(agents) > 1:
                    multi_agent_skills.append((name, agents))
            
            if multi_agent_skills:
                issues.append(f"ℹ️ {len(multi_agent_skills)} 个技能被多 Agent 注册/更新:")
                for name, agents in multi_agent_skills[:10]:
                    issues.append(f"   - {name}: {', '.join(agents)}")
                if len(multi_agent_skills) > 10:
                    issues.append(f"   ... 还有 {len(multi_agent_skills) - 10} 个")
            
            # 输出结果
            if issues:
                print("🔍 审计结果:")
                print()
                for issue in issues:
                    print(issue)
                print()
                print(f"总计: {len(skill_names)} 个本地技能, {len(registry_names)} 个注册技能")
            else:
                print("✅ 审计通过：未发现重复注册或分类冲突")
                print(f"   本地技能: {len(skill_names)} 个")
                print(f"   注册技能: {len(registry_names)} 个")
            return

        if cmd == "catalog":
            # 从 registry.json 生成目录（保证多 Agent 清单一致）
            generate_catalog()
            print(f"目录已生成: {CATALOG_FILE}")
            print("   (从共享注册表生成，多 Agent 清单一致)")
            return

        if cmd == "suggest":
            result = suggest_active()
            loaded = result["loaded"]
            print(f"\n当前已加载: {result['total_loaded']} 个技能")
            print(f"{'='*40}")
            print(f"  核心层 ({len(loaded['core'])}): {', '.join(loaded['core']) if loaded['core'] else '无'}")
            print(f"  工具层 ({len(loaded['toolkit'])}): {', '.join(loaded['toolkit']) if loaded['toolkit'] else '无'}")
            print(f"  场景层 ({len(loaded['scenario'])}): {', '.join(loaded['scenario']) if loaded['scenario'] else '无'}")
            if loaded.get("task_id"):
                print(f"  当前任务: {loaded['task_id']}")

            if result["suggestions"]:
                print(f"\n💡 建议额外加载 ({result['suggestions_count']} 个):")
                for name, cat in result["suggestions"]:
                    print(f"  + {name} [{cat}]")
                names = ' '.join(s[0] for s in result["suggestions"][:5])
                print(f"\n  python3 classifier.py load {names}")
            else:
                print("\n暂无额外推荐")
            return

        if cmd == "prune":
            """清理长期未使用的技能

            用法：
              classifier.py prune                       # 清理 90 天未更新的技能
              classifier.py prune --older-than 30d      # 自定义天数
              classifier.py prune --dry-run             # 仅显示要清理的内容，不执行
              classifier.py prune --remove-files        # 同时删除旧目录
            """
            args = sys.argv[2:] if len(sys.argv) > 2 else []
            older_than = 90  # 默认 90 天
            dry_run = "--dry-run" in args
            remove_files = "--remove-files" in args

            if "--older-than" in args:
                idx = args.index("--older-than")
                if idx + 1 < len(args):
                    val = args[idx + 1]
                    if val.endswith("d"):
                        older_than = int(val[:-1])
                    elif val.endswith("m"):
                        older_than = int(val[:-1]) * 30
                    else:
                        older_than = int(val)

            registry = get_global_registry()
            cutoff = datetime.now().timestamp() - older_than * 86400
            skills = scan_skills()
            skill_lookup = {s["dir_name"]: s for s in skills}

            stale = []
            for name, info in registry.get("skills", {}).items():
                # 检查 last_updated_at / last_classified_at
                last_updated = info.get("last_updated_at", "")
                if last_updated:
                    try:
                        t = datetime.fromisoformat(last_updated).timestamp()
                    except:
                        t = 0
                else:
                    t = 0

                # 也检查路径是否还在
                path = info.get("path", "")
                path_exists = path and Path(path).exists()

                if t > 0 and t < cutoff and not path_exists:
                    stale.append({
                        "name": name,
                        "tier": info.get("tier", "?"),
                        "category": info.get("category", "?"),
                        "last_updated": last_updated,
                        "path": path,
                        "path_exists": path_exists,
                    })

            if not stale:
                print(f"✅ 没有超过 {older_than} 天未更新的过时技能")
                return

            print(f"\n📦 过时技能 ({len(stale)} 个，超过 {older_than} 天未更新):")
            print(f"{'='*55}")
            for s in stale:
                age = (datetime.now().timestamp() - datetime.fromisoformat(s['last_updated']).timestamp()) / 86400
                icon = "🗑️" if not s['path_exists'] else "⚠️"
                print(f"  {icon} {s['name']:30s} [{s['tier']}/{s['category']}] (未更新 {age:.0f} 天)")
                if s['path']:
                    print(f"     路径: {s['path']} {'✅' if s['path_exists'] else '❌ 不存在'}")

            if dry_run:
                print(f"\nℹ️  --dry-run 模式，未执行任何操作")
                return

            # 确认
            print(f"\n⚠️  是否要从注册表中移除这 {len(stale)} 个技能？")
            print(f"   输入 y 确认，n 取消，或指定要保留的技能名（逗号分隔）")
            return

        print(f"未知命令: {cmd}")
        print("用法:")
        print("  python3 classifier.py                        # 扫描+分类+生成")
        print("  python3 classifier.py match \"任务\"          # 推荐技能")
        print("  python3 classifier.py be-integrate \"任务\"    # 输出 JSON")
        print("  python3 classifier.py load skill1 skill2       # 加载技能")
        print("  python3 classifier.py loaded                  # 查看已加载")
        print("  python3 classifier.py suggest                 # 主动晒清单")
        print("  python3 classifier.py cleanup                 # 清理未用技能")
        print("  python3 classifier.py stats                   # 统计")
        print("  python3 classifier.py catalog                 # 仅生成目录")
        print("  python3 classifier.py sync --agent xiaobao    # 同步注册表")
        print("  python3 classifier.py check-conflicts         # 查看分类冲突")
        print("  python3 classifier.py resolve                 # 解决分类冲突")
        print("  python3 classifier.py lock skill-name         # 锁定分类")
        print("  python3 classifier.py unlock skill-name       # 解锁分类")
        print("  python3 classifier.py prune                   # 清理过时技能")

    except KeyboardInterrupt:
        print("\n用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n错误: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

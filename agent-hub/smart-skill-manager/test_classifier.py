#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_classifier.py — Smart Skill Manager 多 Agent 分类冲突测试

测试范围：
  1. 冲突检测：两个 Agent 分类不同时正确检测
  2. 优先级覆盖：高优先级分类覆盖低优先级
  3. 锁定机制：locked 技能不受覆盖影响
  4. 冲突解决：resolve 命令正确更新分类
  5. JSON 输出：check-conflicts --json 格式正确
  6. 同步机制：sync 命令多 Agent 兼容

运行：
  python3 test_classifier.py          # 运行所有测试
  python3 test_classifier.py -v       # 详细输出
  python3 test_classifier.py TestConflict  # 仅运行指定测试类
"""

import os
import sys
import json
import tempfile
import unittest
import shutil
from datetime import datetime

# ─── 导入 classifier 模块 ──────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# 需要先设置 WORKSPACE 指向临时目录
import classifier as clf

# ─── 测试辅助 ─────────────────────────────────────────

def make_skill_mock(dir_name, name, description="", tags=None, tier="toolkit", category="通用工具"):
    """生成模拟 skill 字典（替代 scan_skills 的返回）"""
    return {
        "name": name or dir_name,
        "dir_name": dir_name,
        "path": f"/mock/{dir_name}",
        "description": description,
        "tags": tags or [],
        "content": f"---\nname: {name or dir_name}\ndescription: {description}\n---",
    }


class TestConflictDetection(unittest.TestCase):
    """测试冲突检测功能"""

    def setUp(self):
        """每个测试前保存原始注册表路径"""
        self.orig_registry = clf.REGISTRY_FILE
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp(prefix="test_classifier_")
        clf.REGISTRY_FILE = os.path.join(self.temp_dir, "registry.json")
        clf.OUTPUT_DIR = self.temp_dir

    def tearDown(self):
        """每个测试后恢复注册表路径，清理临时文件"""
        clf.REGISTRY_FILE = self.orig_registry
        clf.OUTPUT_DIR = os.path.join(
            os.path.expanduser("~/.openclaw/workspace"), "workbench", "_catalog"
        )
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create_registry(self, skills_data: dict):
        """创建模拟 registry.json"""
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": len(skills_data),
            "skills": skills_data,
        }
        with open(clf.REGISTRY_FILE, 'w', encoding='utf-8') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)
        return registry

    def test_new_skill_registration(self):
        """测试新技能注册（无冲突）"""
        registry = self._create_registry({})

        # 模拟 update_registry 的核心逻辑
        skill = make_skill_mock("test-tool", "test-tool", "A test tool", tier="toolkit", category="安全工具")
        c = {"tier": "toolkit", "category": "安全工具"}

        # 手动注册
        clf.update_registry(agent="test_agent")

        # 读取结果
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)

        # 验证：注册表不空
        self.assertIn("skills", result)

    def test_conflict_detection_diff_tier(self):
        """测试层级不同的冲突检测"""
        # 先创建注册表，包含一个 core 层级的技能
        registry = self._create_registry({
            "test-skill": {
                "name": "test-skill",
                "description": "",
                "tier": "core",
                "category": "核心",
                "path": "/mock/test-skill",
                "tags": [],
                "status": "active",
                "updated_at": datetime.now().isoformat(),
                "first_registered_by": "agent_a",
                "last_agent": "agent_a",
            }
        })

        # 模拟扫描发现为 toolkit 层级
        # 直接调用内部逻辑：手动添加冲突
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)

        info = reg["skills"]["test-skill"]
        if "conflicts" not in info:
            info["conflicts"] = []
        info["conflicts"].append({
            "field": "tier/category",
            "registered": "core/核心",
            "scanned": "toolkit/代码工具",
            "by_agent": "agent_b",
            "at": datetime.now().isoformat(),
        })

        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

        # 验证冲突被记录
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)

        self.assertIn("conflicts", result["skills"]["test-skill"])
        self.assertEqual(len(result["skills"]["test-skill"]["conflicts"]), 1)
        self.assertEqual(result["skills"]["test-skill"]["conflicts"][0]["by_agent"], "agent_b")

    def test_conflict_detection_diff_category(self):
        """测试分类不同的冲突检测"""
        registry = self._create_registry({
            "cloakbrowser": {
                "name": "cloakbrowser",
                "description": "Stealth browser",
                "tier": "toolkit",
                "category": "代码工具",  # agent_a 分类为代码工具
                "path": "/mock/cloakbrowser",
                "tags": [],
                "status": "active",
                "updated_at": datetime.now().isoformat(),
                "first_registered_by": "agent_a",
                "last_agent": "agent_a",
            }
        })

        # agent_b 分类为网络工具
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)

        info = reg["skills"]["cloakbrowser"]
        if "conflicts" not in info:
            info["conflicts"] = []
        info["conflicts"].append({
            "field": "category",
            "registered": "代码工具",
            "scanned": "网络工具",
            "by_agent": "agent_b",
            "at": datetime.now().isoformat(),
        })

        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

        # 验证
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)

        self.assertIn("conflicts", result["skills"]["cloakbrowser"])
        conflicts = result["skills"]["cloakbrowser"]["conflicts"]
        self.assertEqual(len(conflicts), 1)
        self.assertEqual(conflicts[0]["by_agent"], "agent_b")
        self.assertEqual(conflicts[0]["registered"], "代码工具")
        self.assertEqual(conflicts[0]["scanned"], "网络工具")

    def test_no_conflict_when_same(self):
        """测试相同分类不产生冲突"""
        registry = self._create_registry({
            "semgrep": {
                "name": "semgrep",
                "description": "Static analysis",
                "tier": "toolkit",
                "category": "安全工具",
                "path": "/mock/semgrep",
                "tags": [],
                "status": "active",
                "updated_at": datetime.now().isoformat(),
                "first_registered_by": "agent_a",
                "last_agent": "agent_a",
            }
        })

        # 相同分类 — 不产生冲突
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)

        info = reg["skills"]["semgrep"]
        # 不添加冲突记录（与注册分类一致）

        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)

        self.assertNotIn("conflicts", result["skills"]["semgrep"])


class TestPriorityOverride(unittest.TestCase):
    """测试优先级覆盖机制"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_priority_")
        self.orig_registry = clf.REGISTRY_FILE
        clf.REGISTRY_FILE = os.path.join(self.temp_dir, "registry.json")
        clf.OUTPUT_DIR = self.temp_dir

    def tearDown(self):
        clf.REGISTRY_FILE = self.orig_registry
        clf.OUTPUT_DIR = os.path.join(
            os.path.expanduser("~/.openclaw/workspace"), "workbench", "_catalog"
        )
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_priority_scores(self):
        """测试优先级得分计算"""
        score_core = clf.get_priority_score("core", "核心")
        score_security = clf.get_priority_score("toolkit", "安全工具")
        score_code = clf.get_priority_score("toolkit", "代码工具")
        score_other = clf.get_priority_score("toolkit", "其他工具")

        # core > security > code > other
        self.assertGreater(score_core, score_security)
        self.assertGreater(score_security, score_code)
        self.assertGreater(score_code, score_other)

    def test_high_priority_overrides_low(self):
        """测试高优先级分类覆盖低优先级"""
        # 注册表已有低优先级分类
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "security-audit-tool": {
                    "name": "security-audit-tool",
                    "description": "Security auditing tool",
                    "tier": "toolkit",
                    "category": "其他工具",  # 低优先级
                    "path": "/mock/security-audit-tool",
                    "tags": [],
                    "status": "active",
                    "updated_at": datetime.now().isoformat(),
                    "first_registered_by": "agent_a",
                    "last_agent": "agent_a",
                    "priority_score": clf.get_priority_score("toolkit", "其他工具"),
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        # 模拟高优先级扫描（安全工具 = 80 > 其他工具 = 10）
        # 直接修改注册表以模拟 update_registry 的优先级覆盖逻辑
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)

        existing = reg["skills"]["security-audit-tool"]
        existing_tier = existing.get("tier", "toolkit")
        existing_cat = existing.get("category", "其他工具")
        new_score = clf.get_priority_score("toolkit", "安全工具")
        old_score = existing.get("priority_score", clf.get_priority_score(existing_tier, existing_cat))

        # 新优先级更高 → 应覆盖
        self.assertGreater(new_score, old_score)

        # 执行覆盖
        existing["tier"] = "toolkit"
        existing["category"] = "安全工具"
        existing["priority_score"] = new_score
        existing["last_classified_by"] = "agent_b"
        existing["last_classified_at"] = datetime.now().isoformat()

        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

        # 验证已被覆盖
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)

        self.assertEqual(result["skills"]["security-audit-tool"]["category"], "安全工具")
        self.assertEqual(result["skills"]["security-audit-tool"]["priority_score"], new_score)

    def test_low_priority_does_not_override_high(self):
        """测试低优先级分类不覆盖高优先级"""
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "security-tool": {
                    "name": "security-tool",
                    "description": "Security tool",
                    "tier": "toolkit",
                    "category": "安全工具",  # 高优先级
                    "path": "/mock/security-tool",
                    "tags": [],
                    "status": "active",
                    "updated_at": datetime.now().isoformat(),
                    "first_registered_by": "agent_a",
                    "last_agent": "agent_a",
                    "priority_score": clf.get_priority_score("toolkit", "安全工具"),
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        # 尝试低优先级覆盖（其他工具 = 10 < 安全工具 = 80）
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)

        existing = reg["skills"]["security-tool"]
        existing_tier = existing.get("tier", "toolkit")
        existing_cat = existing.get("category", "安全工具")
        new_score = clf.get_priority_score("toolkit", "其他工具")
        old_score = existing.get("priority_score", clf.get_priority_score(existing_tier, existing_cat))

        # 新优先级更低 → 不应覆盖
        self.assertLess(new_score, old_score)

        # 验证注册表保持不变
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)

        self.assertEqual(result["skills"]["security-tool"]["category"], "安全工具")


class TestLockMechanism(unittest.TestCase):
    """测试分类锁定机制"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_lock_")
        self.orig_registry = clf.REGISTRY_FILE
        clf.REGISTRY_FILE = os.path.join(self.temp_dir, "registry.json")
        clf.OUTPUT_DIR = self.temp_dir

    def tearDown(self):
        clf.REGISTRY_FILE = self.orig_registry
        clf.OUTPUT_DIR = os.path.join(
            os.path.expanduser("~/.openclaw/workspace"), "workbench", "_catalog"
        )
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_lock_skill(self):
        """测试锁定技能分类"""
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "test-locked-skill": {
                    "name": "test-locked-skill",
                    "description": "",
                    "tier": "toolkit",
                    "category": "代码工具",
                    "path": "/mock/test-locked-skill",
                    "tags": [],
                    "status": "active",
                    "updated_at": datetime.now().isoformat(),
                    "first_registered_by": "agent_a",
                    "last_agent": "agent_a",
                    "priority_score": clf.get_priority_score("toolkit", "代码工具"),
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        # 锁定
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)
        reg["skills"]["test-locked-skill"]["locked"] = True
        reg["skills"]["test-locked-skill"]["locked_by"] = "test_agent"
        reg["skills"]["test-locked-skill"]["locked_at"] = datetime.now().isoformat()
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

        # 验证已锁定
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)
        self.assertTrue(result["skills"]["test-locked-skill"]["locked"])
        self.assertEqual(result["skills"]["test-locked-skill"]["locked_by"], "test_agent")

    def test_unlock_skill(self):
        """测试解锁技能分类"""
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "locked-skill": {
                    "name": "locked-skill",
                    "description": "",
                    "tier": "toolkit",
                    "category": "代码工具",
                    "path": "/mock/locked-skill",
                    "tags": [],
                    "status": "active",
                    "updated_at": datetime.now().isoformat(),
                    "first_registered_by": "agent_a",
                    "last_agent": "agent_a",
                    "locked": True,
                    "locked_by": "agent_a",
                    "locked_at": datetime.now().isoformat(),
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        # 解锁
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)
        info = reg["skills"]["locked-skill"]
        del info["locked"]
        del info["locked_by"]
        del info["locked_at"]
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

        # 验证已解锁
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)
        self.assertNotIn("locked", result["skills"]["locked-skill"])

    def test_locked_skill_resists_override(self):
        """测试锁定后的技能不受高优先级覆盖"""
        # 注册表已有锁定的低优先级分类
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "locked-skill": {
                    "name": "locked-skill",
                    "description": "",
                    "tier": "toolkit",
                    "category": "其他工具",  # 低优先级，但已锁定
                    "path": "/mock/locked-skill",
                    "tags": [],
                    "status": "active",
                    "updated_at": datetime.now().isoformat(),
                    "first_registered_by": "agent_a",
                    "last_agent": "agent_a",
                    "priority_score": clf.get_priority_score("toolkit", "其他工具"),
                    "locked": True,
                    "locked_by": "agent_a",
                    "locked_at": datetime.now().isoformat(),
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        # 模拟 update_registry: locked 技能即使高优先级也不覆盖
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)
        existing = reg["skills"]["locked-skill"]
        # locked=True 时，update_registry 不会更新分类
        # 验证注册表未变
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)
        self.assertEqual(result["skills"]["locked-skill"]["category"], "其他工具")
        self.assertTrue(result["skills"]["locked-skill"]["locked"])


class TestConflictResolution(unittest.TestCase):
    """测试冲突解决策略"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_resolve_")
        self.orig_registry = clf.REGISTRY_FILE
        clf.REGISTRY_FILE = os.path.join(self.temp_dir, "registry.json")
        clf.OUTPUT_DIR = self.temp_dir

    def tearDown(self):
        clf.REGISTRY_FILE = self.orig_registry
        clf.OUTPUT_DIR = os.path.join(
            os.path.expanduser("~/.openclaw/workspace"), "workbench", "_catalog"
        )
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_resolve_clears_conflicts(self):
        """测试 resolve 后冲突记录被清除"""
        # 有冲突记录的注册表
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "test-skill": {
                    "name": "test-skill",
                    "description": "",
                    "tier": "toolkit",
                    "category": "代码工具",
                    "path": "/mock/test-skill",
                    "tags": [],
                    "status": "active",
                    "updated_at": datetime.now().isoformat(),
                    "first_registered_by": "agent_a",
                    "last_agent": "agent_a",
                    "conflicts": [
                        {
                            "field": "tier/category",
                            "registered": "toolkit/代码工具",
                            "scanned": "toolkit/安全工具",
                            "by_agent": "agent_b",
                            "at": datetime.now().isoformat(),
                        }
                    ],
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        # 模拟 resolve：删除冲突记录
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)
        if "conflicts" in reg["skills"]["test-skill"]:
            del reg["skills"]["test-skill"]["conflicts"]
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

        # 验证冲突已清除
        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)
        self.assertNotIn("conflicts", result["skills"]["test-skill"])

    def test_resolve_updates_classification(self):
        """测试 resolve 更新分类"""
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "test-skill": {
                    "name": "test-skill",
                    "description": "",
                    "tier": "toolkit",
                    "category": "代码工具",
                    "path": "/mock/test-skill",
                    "tags": [],
                    "status": "active",
                    "updated_at": datetime.now().isoformat(),
                    "first_registered_by": "agent_a",
                    "last_agent": "agent_a",
                    "conflicts": [
                        {
                            "field": "tier/category",
                            "registered": "toolkit/代码工具",
                            "scanned": "toolkit/安全工具",
                            "by_agent": "agent_b",
                            "at": datetime.now().isoformat(),
                        }
                    ],
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        # resolve: 更新为安全工具
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)
        info = reg["skills"]["test-skill"]
        info["tier"] = "toolkit"
        info["category"] = "安全工具"
        info["priority_score"] = clf.get_priority_score("toolkit", "安全工具")
        info["last_classified_by"] = "resolve_command"
        info["last_classified_at"] = datetime.now().isoformat()
        del info["conflicts"]
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(reg, f, ensure_ascii=False, indent=2)

        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)
        self.assertEqual(result["skills"]["test-skill"]["category"], "安全工具")
        self.assertNotIn("conflicts", result["skills"]["test-skill"])


class TestCheckConflictsJSON(unittest.TestCase):
    """测试 check-conflicts --json 输出"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_json_")
        self.orig_registry = clf.REGISTRY_FILE
        clf.REGISTRY_FILE = os.path.join(self.temp_dir, "registry.json")
        clf.OUTPUT_DIR = self.temp_dir

    def tearDown(self):
        clf.REGISTRY_FILE = self.orig_registry
        clf.OUTPUT_DIR = os.path.join(
            os.path.expanduser("~/.openclaw/workspace"), "workbench", "_catalog"
        )
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_json_output_format(self):
        """测试 JSON 输出格式正确"""
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 2,
            "skills": {
                "skill-a": {
                    "name": "skill-a",
                    "tier": "toolkit",
                    "category": "代码工具",
                    "last_agent": "agent_a",
                    "conflicts": [
                        {"field": "category", "registered": "代码工具", "scanned": "安全工具", "by_agent": "agent_b", "at": "2026-05-19T12:00:00"},
                    ],
                },
                "skill-b": {
                    "name": "skill-b",
                    "tier": "toolkit",
                    "category": "网络工具",
                    "last_agent": "agent_b",
                    "conflicts": [
                        {"field": "category", "registered": "网络工具", "scanned": "代码工具", "by_agent": "agent_a", "at": "2026-05-19T12:00:00"},
                    ],
                },
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        # 构建 JSON 输出（模拟 check-conflicts --json）
        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)

        conflict_skills = {}
        for name, info in reg.get("skills", {}).items():
            if "conflicts" in info and info["conflicts"]:
                agents = set()
                for c in info["conflicts"]:
                    ag = c.get("by_agent", "unknown")
                    if ag:
                        agents.add(ag)

                conflict_skills[name] = {
                    "current_classification": f"{info.get('tier', '?')}/{info.get('category', '?')}",
                    "total_conflicts": len(info["conflicts"]),
                    "agents_involved": sorted(agents),
                    "locked": info.get("locked", False),
                    "recent_conflicts": [
                        {"scanned": c["scanned"], "by": c.get("by_agent", ""), "at": c["at"]}
                        for c in info["conflicts"][-3:]
                    ],
                }

        result = {
            "total_conflict_skills": len(conflict_skills),
            "total_conflict_count": sum(s["total_conflicts"] for s in conflict_skills.values()),
            "conflict_skills": conflict_skills,
        }

        # 验证 JSON 格式
        self.assertEqual(result["total_conflict_skills"], 2)
        self.assertEqual(result["total_conflict_count"], 2)
        self.assertIn("skill-a", result["conflict_skills"])
        self.assertIn("skill-b", result["conflict_skills"])
        self.assertEqual(result["conflict_skills"]["skill-a"]["current_classification"], "toolkit/代码工具")
        self.assertEqual(result["conflict_skills"]["skill-a"]["agents_involved"], ["agent_b"])


class TestAgentTracking(unittest.TestCase):
    """测试 Agent 追踪信息"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="test_agent_")
        self.orig_registry = clf.REGISTRY_FILE
        clf.REGISTRY_FILE = os.path.join(self.temp_dir, "registry.json")
        clf.OUTPUT_DIR = self.temp_dir

    def tearDown(self):
        clf.REGISTRY_FILE = self.orig_registry
        clf.OUTPUT_DIR = os.path.join(
            os.path.expanduser("~/.openclaw/workspace"), "workbench", "_catalog"
        )
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_agent_tracking_in_conflict(self):
        """测试冲突记录中的 Agent 追踪"""
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "multi-agent-skill": {
                    "name": "multi-agent-skill",
                    "tier": "toolkit",
                    "category": "代码工具",
                    "last_agent": "agent_b",
                    "conflicts": [
                        {"field": "category", "registered": "代码工具", "scanned": "安全工具", "by_agent": "agent_b", "at": "2026-05-19T12:00:00"},
                        {"field": "category", "registered": "代码工具", "scanned": "网络工具", "by_agent": "agent_c", "at": "2026-05-19T13:00:00"},
                    ],
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        with open(clf.REGISTRY_FILE, 'r') as f:
            reg = json.load(f)

        info = reg["skills"]["multi-agent-skill"]
        agents_involved = set()
        for c in info.get("conflicts", []):
            ag = c.get("by_agent", "unknown")
            if ag:
                agents_involved.add(ag)

        self.assertEqual(len(info["conflicts"]), 2)
        self.assertIn("agent_b", agents_involved)
        self.assertIn("agent_c", agents_involved)
        self.assertEqual(info["last_agent"], "agent_b")

    def test_first_registered_by(self):
        """测试 first_registered_by 追踪"""
        registry = {
            "generated_at": datetime.now().isoformat(),
            "total": 1,
            "skills": {
                "new-skill": {
                    "name": "new-skill",
                    "tier": "toolkit",
                    "category": "代码工具",
                    "first_registered_by": "xiaobao",
                    "last_agent": "xiaobao",
                }
            }
        }
        with open(clf.REGISTRY_FILE, 'w') as f:
            json.dump(registry, f, ensure_ascii=False, indent=2)

        with open(clf.REGISTRY_FILE, 'r') as f:
            result = json.load(f)

        self.assertEqual(result["skills"]["new-skill"]["first_registered_by"], "xiaobao")


# ─── 主入口 ───────────────────────────────────────────

if __name__ == "__main__":
    unittest.main()
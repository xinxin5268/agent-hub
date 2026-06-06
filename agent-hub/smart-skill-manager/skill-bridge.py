#!/usr/bin/env python3
"""Agent Hub Skill Bridge — wraps classifier.py calls as JSON for the Registry daemon."""
import json, sys, os, subprocess, pathlib

BASE = pathlib.Path(__file__).parent
CLASSIFIER = BASE / "classifier.py"
WORKBENCH = pathlib.Path(os.path.expanduser("~/.openclaw/workspace/workbench/_catalog"))
REGISTRY_PATH = WORKBENCH / "registry.json"
CORE_SKILLS_PATH = WORKBENCH / "core-skills.json"
LOADED_SKILLS_PATH = WORKBENCH / "loaded_skills.json"

def cmd_scan():
    result = subprocess.run([sys.executable, str(CLASSIFIER)], capture_output=True, text=True, timeout=120)
    return {"ok": result.returncode == 0, "stdout": result.stdout, "stderr": result.stderr}

def cmd_list():
    if not REGISTRY_PATH.exists():
        return {"ok": False, "error": "registry.json not found — run scan first"}
    data = json.loads(REGISTRY_PATH.read_text())
    registry = data.get("skills", {})
    skills = []
    for name, info in registry.items():
        info["name"] = name
        skills.append(info)
    return {"ok": True, "skills": skills, "categories": data.get("categories", {}), "total": data.get("total_skills", 0), "last_updated": data.get("updated", data.get("last_updated_at", ""))}

def cmd_match(task):
    result = subprocess.run([sys.executable, str(CLASSIFIER), "match", task], capture_output=True, text=True, timeout=60)
    lines = result.stdout.split("\n")
    matches = []
    seen = set()
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("=") or stripped.startswith("---"):
            continue
        if stripped.startswith("+ "):
            skill = stripped[2:].strip()
            if skill and skill not in seen:
                seen.add(skill)
                matches.append({"rank": len(matches)+1, "skill": skill, "tier": "core", "category": "Core", "score": "100", "reason": "Always available"})
        elif stripped.startswith("# "):
            rest = stripped[2:]
            parts = rest.split("[")
            skill_name = parts[0].strip()
            if skill_name in seen:
                continue
            seen.add(skill_name)
            category = parts[1].split("]")[0].strip() if len(parts) > 1 and "]" in parts[1] else ""
            score = parts[1].split("]")[1] if len(parts) > 1 and "]" in parts[1] else ""
            score = score.replace("(", "").replace(")", "").replace("匹配度:", "").strip()
            matches.append({"rank": len(matches)+1, "skill": skill_name, "tier": "toolkit", "category": category, "score": score, "reason": ""})
        elif stripped.startswith("@ "):
            rest = stripped[2:]
            name = rest.split("(")[0].strip() if "(" in rest else rest
            score = rest.split("匹配度:")[1].split(")")[0].strip() if "匹配度:" in rest else ""
            key = f"scenario:{name}"
            if key in seen:
                continue
            seen.add(key)
            matches.append({"rank": len(matches)+1, "skill": f"[Scenario] {name}", "tier": "scenario", "category": name, "score": score, "reason": ""})
    return {"ok": True, "task": task, "matches": matches, "raw": result.stdout}

def cmd_stats():
    core = json.loads(CORE_SKILLS_PATH.read_text()) if CORE_SKILLS_PATH.exists() else []
    loaded = json.loads(LOADED_SKILLS_PATH.read_text()) if LOADED_SKILLS_PATH.exists() else {}
    return {"ok": True, "core_count": len(core), "loaded_count": len(loaded)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps(cmd_scan()))
    elif sys.argv[1] == "list":
        print(json.dumps(cmd_list()))
    elif sys.argv[1] == "match" and len(sys.argv) >= 3:
        print(json.dumps(cmd_match(sys.argv[2])))
    elif sys.argv[1] == "stats":
        print(json.dumps(cmd_stats()))
    else:
        print(json.dumps({"ok": False, "error": f"Unknown command: {' '.join(sys.argv[1:])}"}))

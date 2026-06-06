#!/usr/bin/env python3
"""Agent 技能同步脚本 — 把 Agent 注册信息同步到共享 skill 管理器"""
import json, os, sys

REGISTRY_PATH = os.path.expanduser("~/.openclaw/workspace/workbench/_catalog/registry.json")

def sync_skills(agents: list):
    """根据 Agent 列表更新共享技能注册表"""
    if not os.path.exists(REGISTRY_PATH):
        return {"ok": False, "error": "registry.json not found"}
    
    with open(REGISTRY_PATH) as f:
        data = json.load(f)
    
    skills = data.get("skills", {})
    online_agents = [a for a in agents if a.get("status") in ("online", "busy")]
    
    # 根据在线 Agent 更新技能状态
    for agent in online_agents:
        agent_skills = agent.get("skills", [])
        for skill_name in agent_skills:
            if skill_name in skills:
                skills[skill_name]["last_agent"] = agent.get("id", "")
                skills[skill_name]["status"] = "active"
    
    data["skills"] = skills
    with open(REGISTRY_PATH, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    return {"ok": True, "synced": len(online_agents)}

if __name__ == "__main__":
    if len(sys.argv) > 1:
        agents = json.loads(sys.argv[1])
        result = sync_skills(agents)
        print(json.dumps(result))
    else:
        print(json.dumps({"ok": False, "error": "usage: sync-agent-skills.py '[agents_json]'"}))

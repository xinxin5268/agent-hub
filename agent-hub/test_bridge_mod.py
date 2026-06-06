import sys, json
sys.path.insert(0, "/home/chenxin520/.openclaw/workspace/agent-hub/smart-skill-manager")
# Import as module (strip the .py extension)
import importlib.util
spec = importlib.util.spec_from_file_location("skill_bridge", "/home/chenxin520/.openclaw/workspace/agent-hub/smart-skill-manager/skill-bridge.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

result = mod.cmd_list()
print("OK=" + str(result.get("ok")) + ", total=" + str(len(result.get("skills", []))))
